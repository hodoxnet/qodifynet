# Installer UI – Partner Sistemi, Müşteri CRUD ve Yetkilendirme Planı

Bu plan, backend’de tamamlanan partner sistemi + ince yetki (scope), kredi akışı ve DB tabanlı müşteri yönetimi için UI tarafında yapılacakları kapsar. Amaç; SUPER_ADMIN için yönetim ekranları, partner kullanıcıları için kısıtlı kurulum akışı ve tüm müşteri yönetiminin (CRUD) UI’dan yapılabilmesi.

## Hedefler
- Giriş ve oturum yönetimi: JWT access + refresh (auto‑refresh) ve kullanıcı/scope bilgisinin merkezi yönetimi.
- Menü/yetki: Roller ve scope’lara göre menü/görünürlük.
- Partner modülleri: Başvuru yönetimi (admin), partner listesi/detay, kredi yükleme, ledger, pricing, üye yönetimi.
- Müşteri modülleri: Prisma tabanlı list/detay + CRUD (create/update/delete/hard delete).
- Kurulum sihirbazı: Partner kullanıcıları için `setup.run` scope’una göre erişim ve kredi durumlarını gösterme.
- Hata/cevap standardı: Backend’in `ok/err` yanıt şemasını merkezî olarak işleme.
- UX: Rate limit/durum/ilerleme; socket log’ları.

## Bilinen Alt Yapı
- Next.js App Router (app/), Tailwind + Shadcn bileşenleri.
- Var olan bileşenler: CustomersList, DeploymentWizard, System*, TemplateManager, Nav*.
- API yardımcıları: `kurulumSihirbazi/installer-ui/lib/api.ts` (güncellenecek).

## Yetki ve Menü Matrisi (özet)
- SUPER_ADMIN: Tüm menüler; Partner Yönetimi + Müşteri CRUD + Sistem/Template sayfaları.
- ADMIN: Müşteri CRUD + Sistem/Template; Partner yönetimi yok.
- Partner (VIEWER + scopes): `setup.run`, `customer.read:own` varsa kurulum ve kendi müşterilerini görür; Sistem/Template menüleri gizlenir.

## Router / Ekranlar
1) Kimlik ve Oturum
- AuthProvider (client) – kullanıcı ve token durumu; auto‑refresh; `scopes` ve `partnerId` taşıma.
- Login sayfası: `/login` (mevcut).

2) Partner Yönetimi (SUPER_ADMIN)
- Başvurular: `/partners/applications`
  - Liste: status filtresi (pending/approved/rejected)
  - İşlemler: approve (setupCredits + kullanıcı oluştur/ata), reject (reason)
- Partner listesi: `/partners`
- Partner detay: `/partners/[id]`
  - Sekmeler: Wallet (balance + grant), Pricing (setupCredits), Members (ekle/kaldır), Ledger (liste/paging)

3) Müşteri Yönetimi (DB CRUD)
- Liste: `/customers`
  - Admin: tüm müşteriler (partnerId filtresi opsiyonel)
  - Partner: sadece kendi `partnerId`
  - Aksiyonlar: Create, Edit, Delete, Hard Delete (onaylı)
- Detay: `/customers/[id]`
  - Health, Logs, Env Config (mevcut bileşenleri yeniden kullan), Aksiyonlar (start/stop/restart), Hard Delete

4) Kurulum Sihirbazı
- Mevcut `DeploymentWizard` akışı backend’le uyarlanacak.
- Scope kontrolü: `setup.run` yoksa disabled/403 mesajları.
- Rate limit (429) ve kredi yetersiz (402) durumlarına özel ui feedback.

## API Katmanı (lib/api.ts)
- Base URL ve fetch wrapper (Authorization Bearer; refresh otomatik yenileme):
  - `apiFetch(path, { method, body })` → JSON içeren `ok: true/false` şemasını normalize et.
  - 401 için refresh denemesi ve retry.
  - 402/403/429/5xx genel hata ele alma.
- Kullanıcı bilgisi endpoints: `/api/auth/me`, login/refresh/logout akışı.

## Bileşen Güncellemeleri
- Sidebar/Nav:
  - Kullanıcı `role` ve `scopes`’a göre menü: Sistem/Template (sadece admin), Partner Yönetimi (sadece super admin), Kurulum/Müşteriler (partner + admin).
- CustomersList / CustomersTable:
  - DB tabanlı API’ler ile listeleme.
  - Create/Edit/Delete/Hard Delete dialog/formları (zod + react-hook-form).
- CustomerDetail:
  - Env Config, Logs, Health kartları.
  - Aksiyonlar: start/stop/restart; Hard Delete.
- Partner ekranları:
  - ApplicationsList: approve/reject modalları.
  - PartnerList + PartnerDetail: Wallet/Grant, Pricing, Members, Ledger.
- DeploymentWizard:
  - Kredi ve rate limit hatalarını yakalayarak kullanıcıyı yönlendir.

## Durum Yönetimi
- Minimal: React context (AuthProvider) + SWR/React Query (opsiyonel) – sayfa bazlı fetch yeterli.

## Güvenlik ve Dayanıklılık
- Tüm istekler `Authorization: Bearer` + `credentials` gerektiren refresh işleyişi.
- UI input sanitization (temel trim, pattern) + backend zaten sanitize ediyor.
- 429/402/403 durumlarında toast + rehber mesaj.

## Yapılandırma
- `.env.local`: `NEXT_PUBLIC_API_BASE=http://localhost:3031`
- `lib/api.ts`: base URL + refresh yolu (`/api/auth/refresh` cookie).

## Aşamalı Uygulama Planı
1) Altyapı
- AuthProvider, apiFetch (refresh retry), error handler, toast.
- Menü görünürlüğü (role/scope).

2) Müşteri CRUD
- /customers list + create/edit/delete/hard delete.
- /customers/[id] detay + mevcut bileşenlerle entegrasyon.

3) Partner Yönetimi (SUPER_ADMIN)
- /partners/applications (liste/approve/reject)
- /partners (liste), /partners/[id] (wallet/pricing/members/ledger)

4) Kurulum Sihirbazı
- Scope ve rate‑limit uyumları; 402 kredi mesajları.
- Realtime loglar (socket.io) – mevcut kullanımın gözden geçirilmesi.

5) Son rötuşlar
- Hata/success mesajlarının dil ve içerik düzeni (TR).
- Küçük erişilebilirlik ve yüklenme durumları.

## Kabul Kriterleri (Özet)
- Partner kullanıcıları sadece kendi müşterilerini görür ve kurulum adımlarını çalıştırabilir.
- SUPER_ADMIN tüm yönetim ekranlarına erişir; partner başvurularını yönetir; kredi/pricing ayarlar.
- Müşteri CRUD ekranları DB üzerinde çalışır; hard delete seçeneği dosya/PM2/DB temizliği yapar.
- UI, backend ok/err şemasına uygun, rate limit ve kredi yetersizliğini net gösterir.
