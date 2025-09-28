# Qodify Kurulum Sihirbazı – Müşteri Yedekleme ve Versiyon Yükseltme Planı (Güncel)

## 1) Giriş
- Amaç: Müşteri instance’ları için güvenilir yedekleme ve kontrollü versiyon yükseltme (blue/green) akışı tasarlamak.
- Kapsam: `installer-api`, `installer-ui`, müşteri dosya sistemi (`/var/qodify/customers/[domain]`), PostgreSQL veritabanları.

Not: Uploads yolu doğrulandı. Mevcut yüklemeler `customers/[domain]/backend/uploads` altındadır (public dizini altında değildir).

## 2) Kararlaştırılan Varsayılanlar
- Kuyruk: BullMQ (müşteri başına tek aktif iş). 
- Yedek şifreleme: Yok (FS izinleri + yetkili indirme yeterli).
- Artefaktlar: Hariç (örn. `node_modules`, `.next`, `dist`, `logs`).
- Retention: Müşteri başına son 5 tam yedek tutulur.
- Harici depolama: Yok (ilk fazda yerel dosya sistemi).

## 3) Dizin ve Yol Yapısı
### 3.1 Mevcut Yerleşim
- `customers/[domain]/backend/...`
- `customers/[domain]/backend/uploads/...` (gerçek yüklemeler burada)
- `customers/[domain]/admin/...`
- `customers/[domain]/store/...`

### 3.2 Hedef (Blue/Green) Yerleşim
- `customers/[domain]/releases/vX/{backend,admin,store}`
- `customers/[domain]/current -> releases/vX` (symlink)
- `customers/[domain]/shared/uploads` (kalıcı içerik)
- Geçiş adımı: Mevcut `backend/uploads` içeriği `shared/uploads`’a taşınır ve `backend/uploads` symlink’e çevrilir. Böylece sürüm geçişlerinde yüklemeler korunur.

## 4) UI Akışı (Müşteri Detayı > Yedekler)
- “Yeni Yedek” butonu → iki seçenek:
  - Hızlı Yedek (önerilen): Veritabanı (`pg_dump`), `.env` dosyaları, PM2 ekosistemi, `backend/uploads`. Artefaktlar/loglar hariç.
  - Özel Yedek (gelişmiş): 
    - Veritabanı [varsayılan: açık]
    - Uploads (`backend/uploads`) [varsayılan: açık]
    - `.env` + PM2 [varsayılan: açık]
    - Loglar [varsayılan: kapalı]
    - Artefaktlar (`node_modules`, `.next`, `dist`) [varsayılan: kapalı]
- Yedek Geçmişi: Tarih, tür, boyut, süre, sonuç, tetikleyen kullanıcı.
- İşlem görünümü: Canlı durum (Socket.io `backup-progress`, `backup-completed`) ve opsiyonel iptal.
- İşlemler: `İndir` (imzalı/TTL’li), `Sil`.

## 5) API Yüzeyi
- `POST /api/customers/:id/backups`
  - Body: `{ type: "fast"|"custom", include: { db: boolean, uploads: boolean, envPm2: boolean, logs: boolean, artifacts: boolean } }`
- `GET /api/customers/:id/backups` → liste
- `GET /api/customers/:id/backups/:backupId/download` → indirme (imzalı URL veya stream)
- `DELETE /api/customers/:id/backups/:backupId` → sil
- Socket event’leri: `backup-progress`, `backup-completed`, `backup-failed`
- Eşzamanlılık: Müşteri başına tek aktif “task” (build/backup/upgrade çakışmaz) – BullMQ lock/kuyrukla uygulanır.

## 6) Yedekleme Akışı (BullMQ İş Adımları)
1. Ön kontrol: Boş disk alanı (`df`), dizin izinleri, eşzamanlı iş kilidi, retention uyarısı.
2. Çalışma dizini: `customers/[domain]/backups/<YYYYMMDD-HHMMSS>/`.
3. Veritabanı (opsiyonel `include.db`): `pg_dump -Fc -Z9 -f db.dump`.
4. Servis arşivleri: `backend.tar.gz`, `admin.tar.gz`, `store.tar.gz`.
   - Hariç: `node_modules`, `.next`, `dist`, `logs` (include.artifacts=false iken).
5. Uploads (opsiyonel `include.uploads`): 
   - Mevcut yapı: `backend/uploads` → `uploads.tar.gz`.
   - Blue/green sonrası: symlink ise kaynak `shared/uploads` alınır.
6. `.env` + PM2 ekosistemi (opsiyonel `include.envPm2`): `env-pm2.tar.gz`.
7. Manifest: `backup.json` (müşteri, sürümler, Node/PG sürümü, seçenekler, checksums, toplam boyut, süre).
8. Retention: Son 5 yedeği koru, daha eskileri sil.
9. Yayın: Her kritik adımda `backup-progress` (yüzde/metin), başarıda `backup-completed`.

### 6.1 Hariç Tutma Listeleri (Örnek)
- `**/node_modules/**`
- `**/.next/**`
- `**/dist/**`
- `**/logs/**` (isteğe bağlı dahil)

### 6.2 Manifest (backup.json) İçeriği
- `customer`: domain, id
- `timestamp`, `type` (fast/custom), `include` bayrakları
- `versions`: backend/admin/store semver veya release etiketi
- `paths`: `uploadsPath` (mevcut: `backend/uploads`; blue/green sonrası: `shared/uploads`)
- `engine`: Node, paket yöneticisi, PostgreSQL sürümleri
- `artifacts`: dosya listesi + sha256 + boyut
- `stats`: toplam boyut (MB), süre (sn)

## 7) İndirme ve Güvenlik
- İndirmeler imzalı ve süreli URL veya korumalı stream ile yapılır.
- FS izinleri: yedek klasörü 700, arşivler 600.

## 8) Versiyon Yönetimi ve Blue/Green Yükseltme
- Release metadata: `templates/releases.json` (uyumluluk matrisi ile).
- Akış:
  1) Zorunlu “Hızlı Yedek” (`pre-upgrade`) otomatik tetiklenir.
  2) Yeni sürüm `releases/vTarget` altına açılır.
  3) `.env` merge (yeni anahtarlar eklenir, varolan korunur; gerekirse UI diff onayı).
  4) `npm install` / `prisma migrate deploy` / build (UI’dan gelen `heapMB`/`skipTypeCheck` desteklenir).
  5) Sağlık kontrolleri (backend health, admin/store 200, statik asset 200).
  6) `current` symlink `vTarget`’a alınır, PM2 reload.
  7) Hata olursa rollback: symlink eski sürüme alınır, PM2 reload.
- Uploads kalıcılığı: `backend/uploads` → `shared/uploads` taşıma ve symlink ile sürümler arasında korunur.

## 9) Geri Yükleme (Runbook – Taslak)
- Veritabanı: `pg_restore -Fc -d <dbname> backups/<ts>/db.dump`.
- Dosyalar: İlgili arşivleri servis dizinlerine aç; `.env` ve PM2 dosyalarını yerine yaz.
- Blue/green: Geri dönmek istediğin release’i hazırlayıp `current` symlink’i değiştir, PM2 reload.

## 10) İzleme ve Audit
- Socket tabanlı ilerleme: `backup-progress`, `backup-completed`, `backup-failed`.
- Audit log: tetikleyen kullanıcı, başlangıç/bitiş, sonuç, boyut, süre.

## 11) İlk Sprint (MVP)
- API: create/list/download/delete, BullMQ job, Socket event’leri.
- FS: exclude listeleri, `backup.json` manifest, retention (son 5).
- UI: Yedekler sekmesi; Hızlı/Özel form; canlı ilerleme; indirme/silme.
- Upgrade entegrasyonu: Yükseltme akışında otomatik `pre-upgrade` yedek.
- Dokümantasyon: Restore runbook; `releases.json` şeması/doğrulaması.

## 12) Riskler ve Notlar
- Büyük DB/Süre/Disk: Başlamadan alan kontrolü + ETA hesaplaması ve uyarı.
- Uploads tutarlılığı: Yoğun yazma varsa off-peak çalışma önerilir.
- Blue/green geçişinde ilk symlink/taşıma adımı dikkatli planlanmalı (kesintiyi minimize etmek için).

