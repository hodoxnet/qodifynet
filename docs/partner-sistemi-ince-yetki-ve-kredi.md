# Partner Sistemi – İnce Yetki ve Kredi Bazlı Kurulum

Bu doküman, partner (iş ortağı) kullanıcılarının yalnızca yetkilendirildikleri işlemleri yapabildiği, müşterilerini yalnızca kendileri görebildiği ve kurulum başına kredi düşümü yapılan ince taneli yetkilendirme yapısının tasarımını ve uygulama planını tanımlar.

## Amaç
- Partnerlerin (ör. Web Ofisi LTD. ŞTİ.) sisteme giriş yapıp yalnızca kendilerine tanımlı yetkiler dahilinde kurulum yapabilmesi.
- Partnerin yalnızca “kendi müşterilerini” görebilmesi; Süper Admin’in tüm müşterileri görebilmesi.
- Kredi bazlı lisanslama: Partnerin cüzdanından her kurulumda kredinin otomatik düşmesi; kredi yetersiz ise kurulumun engellenmesi.
- Dosya sistemi ve sistem yönetimi (templates, PM2, DNS, sistem durumu vb.) gibi kritik kaynaklara partnerlerin erişiminin tamamen engellenmesi.

## Mevcut Durum Özeti (Güncel)
- Kimlik doğrulama: JWT access/refresh + Session tablosu (rotasyon eklendi).
- Roller: `VIEWER`, `OPERATOR`, `ADMIN`, `SUPER_ADMIN` (sistem içi personel rolleri) + partner kullanıcıları için scope’lar.
- Müşteriler (kontrol-plane): Prisma `Customer` tablosunda tutulur; `partnerId` ilişkisi aktiftir. Eski `data/customers.json` kullanılmaz.
- Sistem/Template/DNS/PM2 uçları ADMIN ile kısıtlı; partner tarafı scope bazlıdır (örn. `setup.run`).

## Terminoloji
- Partner: İş ortağı kurumu veya kişi (örn. ajans/bayi).
- Partner Üyesi: Partner’e bağlı kullanıcı. Alt roller: `PARTNER_ADMIN`, `PARTNER_INSTALLER`.
- Müşteri (Customer): Deploy edilen kurulumun sahibi firma/marka.
- Kredi: Kurulum başına tüketilen sanal birim.
- Kurulum: Setup akışının başarılı tamamlanması (nihai adımda kredi düşümü).

## Yetki Modeli (RBAC + Scope)
Mevcut sistem rolleri “personel” (staff) içindir. Partner tarafı için ilave roller ve scope’lar tanımlanır.

- Sistem Rolleri (staff): `VIEWER`, `OPERATOR`, `ADMIN`, `SUPER_ADMIN`.
- Partner Rolleri: `PARTNER_ADMIN`, `PARTNER_INSTALLER`.
- Scope’lar (örnek):
  - `setup.run` (Kurulum akışını yürütme)
  - `customer.read:own` (Sadece kendi partner’ına ait müşterileri görme)
  - `customer.create:own` (Kendi partner’ı adına müşteri oluşturma)
  - `credit.view:own` (Kendi kredilerini görme)
  - `credit.manage:any` (Süper admin kredi atama)
  - `partner.manage:any` (Partner oluştur/üyelik onayla)

Rol → Scope önerilen eşleşmeler:
- `SUPER_ADMIN`: tüm scope’lar.
- `ADMIN`: sistem ve operasyon scope’ları; `credit.manage:any` hariç kısıtlı olabilir (isteğe bağlı).
- `PARTNER_ADMIN`: `customer.read:own`, `customer.create:own`, `setup.run`, `credit.view:own`.
- `PARTNER_INSTALLER`: `customer.read:own`, `setup.run`.

JWT içinde partner kullanıcıları için `partnerId` ve `scopes` claim’leri taşınır. Staff kullanıcılarında `partnerId` boş olur.

## Veri Modeli (Prisma)
Yeni tablolar ve alanlar eklenir. Aşağıda özet şema taslağıdır (örnek, isimler değişebilir):

```
model Partner {
  id        String   @id @default(cuid())
  name      String
  status    String   @default("pending") // pending|approved|rejected|suspended
  email     String?
  phone     String?
  taxId     String?
  address   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  members   PartnerMember[]
  wallet    PartnerWallet?
  pricing   PartnerPricing?
  customers Customer[]
  applications PartnerApplication[]
}

model PartnerMember {
  id        String   @id @default(cuid())
  partner   Partner  @relation(fields: [partnerId], references: [id])
  partnerId String
  user      User     @relation(fields: [userId], references: [id])
  userId    String   @unique
  role      String   // PARTNER_ADMIN | PARTNER_INSTALLER
  createdAt DateTime @default(now())
}

model PartnerWallet {
  id        String   @id @default(cuid())
  partner   Partner  @relation(fields: [partnerId], references: [id])
  partnerId String   @unique
  balance   Int      @default(0) // toplam kredi bakiyesi
  updatedAt DateTime @updatedAt
}

model PartnerLedger {
  id         String   @id @default(cuid())
  partner    Partner  @relation(fields: [partnerId], references: [id])
  partnerId  String
  delta      Int      // +grant, -consume
  reason     String   // GRANT|CONSUME|ADJUST
  reference  String?  // ilgili kaydın id’si (örn. customerId)
  byUserId   String?  // işlemi yapan admin/sistem
  note       String?
  createdAt  DateTime @default(now())
}

model PartnerPricing {
  id           String  @id @default(cuid())
  partner      Partner @relation(fields: [partnerId], references: [id])
  partnerId    String  @unique
  setupCredits Int     // kurulum başına düşecek kredi miktarı
  updatedAt    DateTime @updatedAt
}

model PartnerApplication {
  id        String   @id @default(cuid())
  partner   Partner? @relation(fields: [partnerId], references: [id])
  partnerId String?
  form      Json
  status    String   @default("pending") // pending|approved|rejected
  createdAt DateTime @default(now())
  decidedAt DateTime?
  decidedBy String?
}

// Mevcut Customer modeline partner ilişkisi eklenir (dosya yerine DB yolunda)
// Bu repo şu an dosya tabanlı müşteriler kullanıyor. MVP’de customers.json’a partnerId alanını ekleyip
// ilerleyen aşamada Prisma Customer tablosuna geçilebilir.
```

### Dosya Tabanlı Geçici Alan (MVP)
`Customer` tipine `partnerId?: string` ve (opsiyonel) `assignedUserIds?: string[]` eklenir. Yeni müşteri oluşturulurken partner kullanıcı ise otomatik olarak bu partnerId yazılır. Filtreleme bu alanla yapılır.

## Erişim Politikaları
1) Sistem Kaynakları (system, templates, dns, pm2): Sadece staff rolleri (`ADMIN`/`SUPER_ADMIN`) erişebilir. Partner rolleri bu rotalara erişemez.
2) Müşteri Listeleme/Detay:
   - `SUPER_ADMIN` tüm müşterileri görür.
   - Staff (ADMIN/OPERATOR/VIEWER) politikanıza göre tümü/filtreli görebilir.
   - Partner rolleri yalnızca `customer.partnerId == user.partnerId` olan müşterileri görür.
3) Kurulum Akışı:
   - Partner kullanıcılar yalnızca kendi partner’larına ait müşteriler üzerinde `setup.run` yapabilir.
   - Kurulum finalize aşamasında kredi kontrolü yapılır; yeterli değilse 402/403 döner.
4) Dosya sistemindeki template dizinleri ve içerikleri partnerlara hiçbir API ile döndürülmez.

## JWT Genişletmesi
Access token payload’ına partner kullanıcıları için şu alanlar eklenir:
```
{
  sub: string,
  email: string,
  role: "PARTNER_ADMIN" | "PARTNER_INSTALLER" | existing,
  partnerId?: string,
  scopes?: string[]
}
```

## Middleware ve Guard’lar
- `authenticate`: aynı (JWT doğrular, req.user doldurur).
- `authorize(...roles)`: mevcut.
- Yeni: `requireScopes(...scopes)` – JWT’de istenen scope’ların bulunmasını zorunlu kılar.
- Yeni: `requirePartner()` – sadece partner kullanıcılarını kabul eder (staff hariç).
- Yeni: `enforcePartnerOwnership(getCustomerId)` – partner kullanıcının yalnız kendi partnerId’sine bağlı müşteri üzerinde işlem yapabildiğini doğrular.

## API Tasarımı (Öneri)
### Partner Başvuru ve Yönetimi
- `POST /api/partners/apply` (public ya da login): Başvuru formu alır, `PartnerApplication` kaydı oluşturur.
- `POST /api/partners/:applicationId/approve` (SUPER_ADMIN): Başvuruyu onaylar; `Partner` kaydını oluşturur, uygulamayı bağlar.
- `POST /api/partners/:id/members` (SUPER_ADMIN | PARTNER_ADMIN): Kullanıcı ekleme/davet (rol: PARTNER_ADMIN|PARTNER_INSTALLER).
- `DELETE /api/partners/:id/members/:userId` (SUPER_ADMIN | PARTNER_ADMIN).

### Kredi ve Ücretlendirme
- `GET /api/partners/:id/wallet` (owner veya SUPER_ADMIN): Bakiye.
- `GET /api/partners/:id/ledger` (owner veya SUPER_ADMIN): Hareketler.
- `POST /api/partners/:id/credits/grant {amount, note}` (SUPER_ADMIN): Kredi yükleme.
- `POST /api/partners/:id/pricing {setupCredits}` (SUPER_ADMIN): Partner’e özel kurulum kredisi ücreti.

### Müşteri ve Kurulum
- `GET /api/customers` (partner): partnerId filtresi otomatik uygulanır.
- `POST /api/customers` (partner): yeni müşteri oluşturup partnerId’yi set eder (MVP’de customers.json’a yazılır).
- `POST /api/setup/*` (partner): `requireScopes('setup.run')` + `enforcePartnerOwnership` + kredi kontrolü.
  - Kredi kontrol akışı:
    1) `setup.check-credits` (opsiyonel ön kontrol) – yeterli mi?
    2) `setup.finalize` (veya `extract/build` sonrası) – DB transaction içinde `PartnerWallet.balance >= price` kontrolü; `PartnerLedger`’a `CONSUME` satırı yazılır; bakiye düşülür; kurulum tamamlanır.
    3) Hata durumunda transaction rollback.

### Hata Kodları
- 401: Kimlik doğrulama yok/hatalı.
- 403: Yetki yok.
- 402: Kredi yetersiz (anlamlı kullanım için tercih edilebilir) veya 400 ile açıklama.

## UI Akışları (Öneri)
- Public/Anonim: “Partner Başvurusu” formu.
- Süper Admin Paneli:
  - Partner başvuruları listesi, onay/ret.
  - Partner listesi; kredi yükleme (grant), fiyat/kredi ayarı, hareket dökümü.
  - Kullanıcı yönetimi: Partner’e üye ekleme/çıkarma.
- Partner Paneli:
  - Bakiye ve hareketler.
  - Müşteri listesi (yalnızca kendi partnerId’si).
  - “Yeni Kurulum” akışı; finalize aşamasında kredi otomatik düşümü; yetersizse uyarı.
  - Sistem/Template/PM2/DNS menüleri görünmez.

## Güvenlik Notları
- Partner API yüzeyinde dosya sistemi erişimi yok. Template ve sistem uçları sadece `ADMIN`/`SUPER_ADMIN`.
- JWT’deki `partnerId` ve `scopes` validation’ı merkezi middleware ile zorunlu kılınır.
- AuditLog: partner kredi işlemleri, kurulumlar ve başarısız denemeler loglanır.
- Rate limit: Partner kritik uçlara (setup finalize vb.) ek limit.

## Geçiş ve Uygulama Durumu
- Yapıldı (Production-Ready):
  - Partner tabloları (Prisma) + transaction’lı rezervasyon/commit/cancel kredi akışı (ledger ile).
  - Partner başvuru/onay, kredi yükleme, pricing ve ledger uçları.
  - Setup uçları: scope-based yetki + rate limit; finalize audit log.
  - Customer kontrol‑plane verisi Prisma `Customer` tablosuna taşındı; DB tabanlı CRUD uçları eklendi.
  - Partner ownership DB’den kontrol ediliyor; eski `customers.json` kaldırıldı.

- Sıradaki (opsiyonel):
  - Audit kapsamını genişletme (başvuru onay/ret, pricing değişimi vb.).
  - UI menü ve sayfa guard’larının scope’lara göre sadeleştirilmesi.

## Kabul Kriterleri (Özet)
- Partner kullanıcıları sistem/template/pm2/dns uçlarına ulaşamaz; 403 alır.
- Partner kullanıcıları yalnızca kendi `partnerId` müşterilerini görür.
- Süper admin tüm müşterileri görür; kredi atayabilir, partner onaylayabilir.
- Kurulum finalize: kredi yetersiz ise engellenir; yeterliyse düşülür ve başarıyla tamamlanır.
- Ledger: her kredi değişimi kayıt altındadır.

## Test Senaryoları (Örnek)
- [Auth] PARTNER_INSTALLER token’ı ile `/api/system/status` → 403
- [Customers] PARTNER_ADMIN, farklı partner’a ait müşteri → 403/404
- [Setup] Kredi 0 iken finalize → 402/403 ve ledger kaydı yok
- [Setup] Yeterli kredi → ledger -N, wallet güncellendi, kurulum başarılı
- [Admin] SUPER_ADMIN kredi grant → ledger +N, wallet güncellendi

## Açık Noktalar / Kararlar
- MVP’de dosya tabanlı müşteri ile partnerId alanı kullanılacak; orta vadede Prisma’ya taşınacak.
- Hata kodu olarak 402 mi 403 mü kullanılacağı: 402 daha semantik, 403 da kabul.
- Ücretlendirme ürünleri (yalnızca setup mı, ek işlemler?) ileride genişletilebilir.
