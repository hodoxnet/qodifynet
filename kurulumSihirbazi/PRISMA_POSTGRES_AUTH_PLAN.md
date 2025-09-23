# Kurulum Sihirbazı: Prisma + PostgreSQL + Kimlik Doğrulama/RBAC Planı

Bu doküman, Kurulum Sihirbazı (installer-ui + installer-api) için kalıcı bir kontrol-düzlemi veritabanı (PostgreSQL) ile Prisma ORM kullanımını ve giriş/yetkilendirme (RBAC) altyapısını kapsamlı şekilde planlar.

## Amaçlar

- Installer için kalıcı bir “kontrol düzlemi” veritabanı kurmak (kullanıcılar, roller, müşteriler, ayarlar, audit log’lar).
- Giriş (email+şifre) ve rol tabanlı yetki: SuperAdmin, Admin, Operator, Viewer.
- Mevcut müşteri kurulum akışını (deployment) güvenli hale getirmek ve aksiyonları loglamak.
- UI (Next.js) ile API (Express) arasında güvenli oturum taşıma.

## Mimari Kararlar

- Veritabanı: PostgreSQL.
- ORM: Prisma (sadece “kontrol düzlemi” DB için). Müşteri başına oluşturulan uygulama veritabanları yine PostgreSQL; onların şema yönetimi ilgili projelerde kalmaya devam eder. Installer yalnızca bu DB’leri oluşturur/ya da siler (cluster-level işlemler için `pg` kullanımı sürer).
- Kimlik Doğrulama: API tarafında JWT tabanlı oturum (access + refresh token). Parola hash: Argon2id.
- RBAC: Basit rol enum’ı ve “policy”/middleware katmanı ile endpoint koruması.
- UI Entegrasyonu: API’nın ayarladığı httpOnly refresh cookie + kısa ömürlü access token stratejisi. CORS `credentials: true` ve spesifik origin ile.

Not: `installer-api` PostgreSQL üzerinde iki tür işlem yapar:
1) Kontrol-düzlemi DB (Prisma ile tablolar) → Kullanıcı, müşteri kaydı, audit vb.
2) Cluster-level yönetim (Prisma’nın kapsamı değil) → `pg` ile database oluşturma, user oluşturma, grant vb. (mevcut `DatabaseService` devam eder).

## Roller ve Yetkiler (RBAC)

- SuperAdmin
  - Sistem kullanıcı/rollerini yönetme
  - Sistem ayarları (DB/Redis/Nginx/SSL vs.)
  - Müşteri silme dahil tüm aksiyonlar
- Admin
  - Müşteri oluşturma/başlatma/durdurma/yedekleme
  - Audit görüntüleme
  - Sistem ayarlarını görüntüleme (kritik değişiklikler hariç)
- Operator
  - Müşteri başlat/durdur/yedek geri yükle gibi operasyonel işler
  - Oluşturma/silme yok
- Viewer
  - Sadece okuma (dashboard, listeler, durum)

Endpoint koruma örnekleri:
- System
  - GET `/api/system/status`, `/resources` → Viewer+
  - POST `/api/system/check-*`, `/install-*`, `/settings` → Admin+ (settings kaydetme için Admin+), kritik ayarlar SuperAdmin
  - POST `/api/system/test/db|redis` → Admin+
- Customers
  - GET `/api/customers*` → Viewer+
  - POST `/api/customers/deploy` → Admin+
  - POST `/api/customers/:id/(start|stop|restart)` → Operator+
  - POST `/api/customers/:id/delete` → Admin+ (veya SuperAdmin olarak sınırlandırılabilir)
  - GET `/api/customers/:id/(logs|health)` → Viewer+

## Veri Modeli (Prisma Şeması Taslağı)

`installer-api/prisma/schema.prisma` (öneri):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  SUPER_ADMIN
  ADMIN
  OPERATOR
  VIEWER
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  passwordHash String
  role         Role     @default(VIEWER)
  status       String   @default("active") // active|disabled
  lastLoginAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  sessions     Session[]
  apiKeys      ApiKey[]
  auditLogs    AuditLog[] @relation("AuditActor")
}

model Session {
  id           String   @id @default(cuid())
  user         User     @relation(fields: [userId], references: [id])
  userId       String
  refreshJti   String   @unique // refresh token id (revocation için)
  userAgent    String?
  ip           String?
  createdAt    DateTime @default(now())
  expiresAt    DateTime
  revokedAt    DateTime?
}

model ApiKey {
  id          String   @id @default(cuid())
  name        String
  tokenHash   String   @unique
  scopes      String[] // basit scope listesi
  user        User     @relation(fields: [userId], references: [id])
  userId      String
  lastUsedAt  DateTime?
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model Customer {
  id          String   @id @default(cuid())
  slug        String   @unique
  companyName String?
  domain      String   @unique
  mode        String   @default("local") // local|production
  // runtime info (installer yönetimi için)
  portsBackend Int
  portsAdmin   Int
  portsStore   Int
  dbName      String?
  dbUser      String?
  dbHost      String?
  dbPort      Int?
  dbSchema    String? @default("public")
  redisHost   String?
  redisPort   Int?
  redisPrefix String?
  status      String   @default("stopped") // running|stopped|error
  version     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deployments Deployment[]
}

model Deployment {
  id         String   @id @default(cuid())
  customer   Customer @relation(fields: [customerId], references: [id])
  customerId String
  step       String   // current step name
  status     String   // pending|running|failed|completed
  log        Json?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model AuditLog {
  id         String   @id @default(cuid())
  actor      User?    @relation("AuditActor", fields: [actorId], references: [id])
  actorId    String?
  action     String
  targetType String?
  targetId   String?
  metadata   Json?
  ip         String?
  userAgent  String?
  createdAt  DateTime @default(now())
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  email     String
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
}
```

Notlar:
- `customers.json` ve `settings.json` verileri orta vadede DB’ye taşınacak. Kısa vadede okuma amaçlı parallel devam edebilir.
- `DatabaseService` ile cluster-level işlemler (CREATE DATABASE, ROLE GRANT) aynı kalır.

## API Değişiklikleri

1) Bağımlılıklar (installer-api):
- `@prisma/client`, `prisma`
- `argon2` (veya `bcrypt`), `jsonwebtoken`, `zod`, `express-rate-limit`, `helmet`, `cors`

2) Ortak Yapılandırma:
- `.env` içine:
  - `DATABASE_URL=postgresql://user:pass@host:5432/qodify_installer`
  - `JWT_SECRET=...` (access için)
  - `JWT_REFRESH_SECRET=...`
  - `CORS_ORIGIN=http://localhost:3030`

3) CORS ve güvenlik middleware’leri:
- `app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }))`
- `app.use(helmet())`

4) Auth endpoints:
- `POST /api/auth/register` → İlk kullanıcı (SuperAdmin) yoksa serbest, sonrası sadece SuperAdmin.
- `POST /api/auth/login` → email+şifre, access token (header’da kullanılacak), refresh token (httpOnly cookie) üretir.
- `POST /api/auth/refresh` → refresh cookie ile yeni access verir.
- `POST /api/auth/logout` → refresh oturumunu revoke eder.
- `GET /api/auth/me` → kullanıcı profilini döner.

5) Middleware:
- `authenticate` → Authorization: Bearer <access_token> doğrulama, `req.user` doldurma.
- `authorize(...roles)` → istenen rollerden birine sahip olma kontrolü.
- Mevcut router’lara ekleme (örnek):
  - `systemRouter`: GET’ler Viewer+, POST’lar Admin+/SuperAdmin.
  - `customerRouter`: deploy Admin+, start/stop Operator+, delete Admin+.

6) Audit Log:
- Her kritik endpoint’te (deploy, delete, settings değişimi vb.) actor, action, target, metadata kaydı.

## UI Entegrasyonu (installer-ui)

- Login sayfası (`/login`) → API `/api/auth/login`’e POST atar. Başarılı dönüşte API tarafından set edilen httpOnly refresh cookie ile çalışır. Access token’ı response body’de alıp client hafızasında tutar (veya hiç tutmadan sadece cookie + `GET /me` yaklaşımı ile yetki kontrolü yapılır).
- Global fetch wrapper: `fetch(url, { credentials: 'include', headers: { Authorization: 'Bearer ' + accessToken } })`.
- Next.js middleware (`middleware.ts`): Auth kontrolü, public yollar: `/login`, static; diğerleri auth gerektirir.
- Rol bazlı UI: Menü/aksiyonları role göre göstermeme (güvenlik için API zaten zorunlu).

## Geçiş Planı (customers.json → DB)

Faz 1 (Paralel):
- Yeni teslim edilen kurulumlar DB’de `Customer` tablosuna da yazılır; UI okuma `customers.json` üzerinden devam eder.

Faz 2 (Migration):
- Script: `node scripts/migrate-customers-to-db.ts` → `data/customers.json` içeriğini `Customer` tablosuna import eder.
- UI ve API okuma/yazma tamamen DB’ye alınır; `customers.json` sadece backup olarak kalır.

## Güvenlik Tedbirleri

- Parola: Argon2id (yüksek maliyet parametreleri ile).
- Rate limit: Login ve auth endpoint’lerinde IP-bazlı limit.
- CORS: Sadece bilinen origin, `credentials: true`.
- Cookie: `httpOnly`, `secure` (prod), `sameSite=Lax`.
- JWT ömrü: Access 10–15 dk, Refresh 7–30 gün. Refresh revocation (Session tablosu) zorunlu.
- Secrets: `.env` ile yönetim, repo’ya dahil edilmez.
- RBAC enforcement: Hem UI görünürlük hem API düzeyi zorunlu.
- Audit: Kritik aksiyonlar kayıt altında.

## Yol Haritası (Önerilen Sprintler)

Sprint 1 – Altyapı ve Şema
- Prisma init, `schema.prisma`, migrate, Prisma Client entegrasyonu
- CORS/Helmet/Rate limit ekleme, env’lerin düzenlenmesi

Sprint 2 – Auth + RBAC
- `/auth/*` endpoint’leri (login, refresh, logout, me, register)
- `authenticate` ve `authorize` middleware’leri
- Mevcut router’ların korumaya alınması
- Audit log altyapısı

Sprint 3 – UI Entegrasyonu
- `/login` sayfası ve yönlendirmeler (middleware.ts)
- Fetch wrapper ve token yenileme akışı
- Rol bazlı görünürlük

Sprint 4 – Müşteri Kayıtlarının DB’ye Alınması
- Yeni müşteri yazma yolunu DB’ye bağlama
- Migrate script ve UI/raporlama güncellemeleri

## Test Planı

- Birim test: auth servisleri (hash, jwt, refresh), RBAC middleware’leri.
- Entegrasyon: `/auth/*` ve korunan müşteri/system endpoint’leri.
- E2E: Login → Dashboard → Deploy → Logs → Logout akışları.

## Örnek Konfigürasyonlar

installer-api/.env:

```env
PORT=3031
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qodify_installer
JWT_SECRET=changeme-access
JWT_REFRESH_SECRET=changeme-refresh
CORS_ORIGIN=http://localhost:3030

# Mevcut cluster admin bilgileri (DatabaseService için)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
```

package.json (installer-api) script önerileri:

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev --name init_control_plane",
    "db:push": "prisma db push",
    "dev": "ts-node src/index.ts"
  }
}
```

## Alternatif Yaklaşım: NextAuth

UI içinde NextAuth + Prisma Adapter kullanımı da mümkündür. Ancak ayrı bir API servisiniz olduğundan JWT’yi API’da tutmak, endpoint düzeyinde RBAC uygulamak ve UI’ı sadece istemci olarak konumlandırmak entegrasyon ve güvenlik açısından daha net bir sınır sunar. Gerekirse NextAuth, UI tarafında sadece oturum yönetimi için tercih edilebilir ve API ile `getToken` paylaşımı tasarlanabilir (karmaşıklık artar).

---

Bu planı izleyerek önce kontrol-düzlemi veritabanını kurup, Auth/RBAC katmanını sağlamlaştırıp, akabinde müşteri kayıtlarını DB’ye geçirerek sürdürülebilir bir mimariye geçilebilir.

