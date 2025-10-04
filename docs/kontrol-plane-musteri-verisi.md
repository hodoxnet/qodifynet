# Kontrol‑Plane Müşteri Verisi (Güncel Durum)

Bu doküman, kurulum sihirbazı kontrol‑plane tarafında müşteri verisinin nerede ve nasıl tutulduğunu özetler.

## Özet
- Artık müşteri kayıtları (ID, domain, portlar, mod, partnerId, DB/Redis bağlantı bilgileri vb.) Prisma `Customer` tablosunda tutulur.
- Eski `data/customers.json` dosyası ve file‑based repository kaldırılmıştır.
- Partner görünürlüğü `customer.partnerId` ile sağlanır; partner kullanıcıları yalnızca kendi `partnerId` müşterilerini görebilir.

## İlgili Kodlar
- Repository (DB): `kurulumSihirbazi/installer-api/src/repositories/customer.db.repository.ts`
- Service: `kurulumSihirbazi/installer-api/src/services/customer.service.ts`
- CRUD Uçları: `kurulumSihirbazi/installer-api/src/controllers/customer.controller.ts`
- Setup Finalize (Customer oluşturma): `kurulumSihirbazi/installer-api/src/controllers/setup.controller.ts`
- Ownership Kontrol (DB tabanlı): `kurulumSihirbazi/installer-api/src/middleware/scopes.ts`

## CRUD Uçları
- Liste: `GET /api/customers` (partner ise partnerId filtresi otomatik)
- Detay: `GET /api/customers/:id`
- Oluştur: `POST /api/customers` (ADMIN/SUPER_ADMIN)
- Güncelle: `PUT /api/customers/:id` (ADMIN/SUPER_ADMIN)
- Sil: `DELETE /api/customers/:id` (yalnız kontrol‑plane kaydı)
- Kalıcı Silme: `DELETE /api/customers/:id?hard=true` veya `POST /api/customers/:id/delete` (PM2, dosyalar, Nginx ve müşteri DB dahil)

## Notlar
- Setup uçları `setup.run` scope’u ile korunur; admin roller scope’tan muaftır.
- Partner kredi düşümü finalize aşamasında transaction’lı rezervasyon/commit ile yapılır (ledger kaydı).
- AuditLog: `SETUP_FINALIZE` ve partner kredi hareketleri kaydedilir.
