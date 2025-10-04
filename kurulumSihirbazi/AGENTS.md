# Kurulum Sihirbazı – AGENTS.md

Bu dosya, `kurulumSihirbazi/` alt ağacında çalışan ajanlar ve katkıda bulunanlar için ayrıntılı çalışma rehberidir. Not: Tüm iletişim ve açıklamalar Türkçe olmalıdır.

## Kapsam ve Mimari
- Bileşenler:
  - `installer-ui/`: Next.js 15 (App Router, Tailwind, RHF) yönetim paneli.
  - `installer-api/`: Express + TypeScript API; deployment orkestrasyonu.
  - `customers/`: Müşteri başına oluşturulan çalışma dizinleri ve PM2 ekosistem dosyaları.
- Üretim yolları (varsayılan): `TEMPLATES_PATH=/var/qodify/templates`, `CUSTOMERS_PATH=/var/qodify/customers`.
- Portlar: UI `3030`, API `3031`, müşteri servisleri `4000+` (store/admin/backend).

## Çalıştırma ve Geliştirme
- UI: `cd kurulumSihirbazi/installer-ui && npm install && npm run dev`
  - Prod: `npm run build && npm run start` (3030).
- API: `cd kurulumSihirbazi/installer-api && npm install && npm run dev`
  - Prod: `npm run build && npm run start` (3031).
- Ortam değişkenleri: `cp kurulumSihirbazi/installer-api/.env.example kurulumSihirbazi/installer-api/.env` düzenleyin.
- Prisma/DB: `npm run prisma:migrate`, `npm run db:seed`, kontrol DB: `npm run db:create:control` (installer-api).

## Katmanlar ve Kaynak Yapısı (API)
- `src/controllers`: HTTP uçları (ör. `system.controller.ts`, `setup.controller.ts`).
- `src/services`: İş akışları (örn. `setup-improved.service.ts`, `nginx.service.ts`, `pm2.service.ts`).
- `src/repositories`: Veri erişimi (`customer.repository.ts`, `pm2.repository.ts`).
- `src/middleware`: `auth`, `authorize` (JWT + rol bazlı erişim).
- `src/utils`: Yardımcı araçlar (env merge, JWT, şifre, PM2 utils). 

## Önemli Akışlar
1) Kurulum sihirbazı (API: `/api/setup/*`): gereksinim → DB/Redis test → db oluşturma → template çıkarma → env yazma → bağımlılıklar → migration → build → PM2+Nginx → finalize.
2) Build iyileştirmeleri (`ImprovedSetupService`):
   - Bellek: `NODE_OPTIONS=--max-old-space-size`, frontend için varsayılan yüksek; `heapMB` ile override.
   - Tip kontrolü atlama: `skipTypeCheck` ile Next `typescript/eslint` ignore.
   - Frontend build env: `SWC_WORKER_COUNT=1`, `SWC_MINIFY=false`, `CI=1`, `IS_BUILD_PHASE=1`.
   - Gerçek zamanlı: `build-output`, `setup-progress`, `build-metrics{ service, memoryMB }` Socket.io event’leri (oda: `deployment-<domain>`).
3) Nginx + SSL (`NginxService`):
   - İlk aşama HTTP-only; sertifika sonrası 80→443 yönlendirme ve `ssl http2`.
   - Next.js statikleri için ayrı regex location eklemeyin; tüm istekleri upstream’e proxy’leyin.

## Güvenlik ve Ağ
- Müşteri servislerini `127.0.0.1`’e bind edin; yalnızca Nginx yayınlasın. 4000–4999/tcp dış erişime kapatın.
- JWT süreleri env ile: `JWT_ACCESS_EXPIRES` (60m), `JWT_REFRESH_EXPIRES` (30d). UI 401’da `/api/auth/refresh` kullanır.
- CORS varsayılan: `http://localhost:3030`; `CORS_ORIGIN` ile çoklu origin desteklenir.

## Gözlemlenebilirlik ve İşletim
- Sağlık: `GET /health` (installer-api).
- Sistem: `GET /api/system/resources`, `GET /api/system/status`, PM2 kontrol uçları.
- Kurulum güncellemeleri: Socket.io odası `deployment-<domain>`; `subscribe-deployment`/`subscribe-logs` event’leri.
- Doğrulama ipuçları: `curl -I http://<domain>` ve `https://<domain>`, `nginx -t && nginx -s reload`.

## Kod Stili ve Kurallar
- TypeScript strict; 2 boşluk girinti, LF. UI’da Next/ESLint kuralları, API’da ESLint (`npm run lint`).
- İsimlendirme: `camelCase` (değişken/fonksiyon), `PascalCase` (React bileşeni), yardımcı dosyalar `kebab-case.ts`.
- Mevcut akışı bozmayın; iyileştirmeleri `ImprovedSetupService` ve ilgili controller’lara ekleyin.

## Yaygın Komut Örnekleri
- UI loglu build: `cd installer-ui && npm run build`.
- API PM2 ekosistemi: müşteri dizini `customers/<domain>/ecosystem-<domain>.config.js`.
- SSL akışı: `configure-services` sırasında otomatik; yoksa HTTP-only devam, log’da açık uyarı.

## Hata Senaryoları ve Öneriler
- Heap OOM: `heapMB` yükseltin veya `NODE_OPTIONS=--max-old-space-size=8192` kullanın; swap etkinleştirin.
- Build çıktı yok: backend için `dist/main.js` veya `dist/src/main.js`, frontend için `.next/` ya da `out/` kontrol edilir.
- DNS/80 erişimi: Let’s Encrypt için 80/tcp dış erişim zorunlu; A/AAAA kayıtlarını doğrulayın.

