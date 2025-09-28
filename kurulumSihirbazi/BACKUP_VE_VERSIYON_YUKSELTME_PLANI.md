# Qodify Kurulum Sihirbazı - Müşteri Yedekleme ve Versiyon Yükseltme Geliştirme Planı

## 1. Giriş
- Amaç: Her müşteri instance'ı için güvenilir yedekleme mekanizması ve çok sürümlü (v1, v2, ...) template yönetimi ile kontrollü versiyon yükseltme akışı tasarlamak.
- Kapsam: `installer-api`, `installer-ui`, müşteri dosya sistemi (`/var/qodify/customers/[domain]`), template deposu (`/var/qodify/templates`) ve PostgreSQL veritabanları.

## 2. Mevcut Durum Analizi
- **Sürüm Yapısı**: Templates klasörü v1 (2.4.0) zip paketleri içeriyor. Versiyon bilgisi müşteri kayıtlarında açık şekilde tutulmuyor; `ImprovedSetupService` deployment sırasında hangi zip kullanıldığını biliyor ancak kalıcı meta yok.
- **Müşteri Dosya Yapısı**: Her müşteri altında backend/admin/store kaynakları, `.env` dosyaları, PM2 ekosistem dosyaları ve log klasörleri bulunuyor. Dosya yapısı tek sürüme bağlı.
- **Veritabanı**: PostgreSQL üzerinde `hodox_customer_[id]` şemasına sahip bağımsız veritabanları, Prisma migration akışı ile yönetiliyor, fakat yedekleme otomasyonu yok.
- **Yedekleme**: README manuel `pg_dump` ve `tar` komutları öneriyor; otomatik veya UI tabanlı yedek alma/restorasyon bulunmuyor.
- **Rollback/Upgrade**: Yeni template ekleme elle kopyalama ile yapılıyor; müşteri tarafında sürüm yükseltme veya rollback senaryosu tanımlı değil.

## 3. Hedefler
- **Yedekleme**
  - Müşteri bazlı tam yedek (dosyalar + veritabanı) ve isteğe bağlı servis bazlı yedek oluşturmak.
  - Yedekleri `customers/[domain]/backups/` altında tarih damgalı klasörlerde saklamak; isteğe göre alternatif lokasyona kopyalama (S3, NFS) için hook sağlamak.
  - Yedekleme başarısını, süresini ve boyutlarını izlemek; UI üzerinden tetikleme ve indirme desteği.
- **Versiyon Yükseltme**
  - Template sürümlerini tanımlayan meta katman (ör: `templates/releases.json`).
  - Müşteri kayıtlarında mevcut sürüm + hedef sürüm alanları.
  - Kontrollü yükseltme akışı (önce yedek al, servisleri durdur, yeni template ile güncelle, migration çalıştır, doğrula, servisleri başlat).
  - Rollback desteği (son yedeği geri yükleme).

## 4. Tasarım İlkeleri
- **İzlenebilirlik**: Her işlem audit log'a kaydedilmeli (başlangıç/bitiş zamanı, sonuç, tetikleyen kullanıcı).
- **Atomiklik**: Yedek + upgrade süreçleri yarım kalırsa otomatik geri alma veya güvenli durdurma.
- **İzolasyon**: Müşteri verisi başka müşterinin yedeğine karışmamalı; dizin ve izinler korunmalı.
- **Performans**: Büyük dosya kopyalamalarında stream tabanlı arşivleme, gerekli durumlarda throttling.
- **Güvenlik**: Şifreler `.env` dahil arşivde kalacağından yedek dosyaları şifreleme opsiyonu (ör: gpg) olarak ele alınmalı.

## 5. Yedekleme Çözümü Tasarımı
### 5.1 Kapsam
- **Dosyalar**: Backend, admin, store klasörleri, `.env` ve PM2 ekosistem dosyaları zorunlu; log klasörleri isteğe bağlı.
- **Veritabanı**: `pg_dump --format=custom` ile sıkıştırılmış dump.
- **Metadata**: JSON manifest (`backup.json`) → servis sürümleri, template adı, Node sürümü, backup türü, süre.

### 5.2 Akış
1. UI'dan veya API'dan yedek isteği alınır (`POST /api/customers/:id/backups`).
2. `ImprovedSetupService` içinde yeni `BackupManager` tetiklenir.
3. Servisler durdurulmadan önce maintenance mod sinyali (opsiyonel) → dosya bütünlüğü için.
4. `pg_dump` ile veritabanı dump alınır.
5. Her servis klasörü için ayrı `.tar.gz` üretilir (`backend.tar.gz`, `admin.tar.gz`, `store.tar.gz`).
6. Manifest dosyası oluşturulur.
7. Arşivler `backups/[timestamp]/` altına yazılır.
8. Başarı durumu Socket.io `backup-status` kanalı ile yayınlanır; UI listesi güncellenir.

### 5.3 Depolama ve Retention
- Varsayılan limit: müşteri başına son 5 tam yedek tutulur; daha eski olanlar otomatik silinir.
- Harici depolama entegrasyonu için provider arayüzü (S3, SFTP) tasarlanır; ilk fazda dosya sistemi yeter.
- Büyük dosyalar için checksum (SHA256) üretilerek manifestte saklanır.

### 5.4 Restorasyon (MVP sonrası)
- Yedekten geri dönme API tasarımı (geleceğe not); upgrade planı rollback senaryosu için referans.

### 5.5 UI Gereksinimleri
- Müşteri detay sayfasında "Yedekler" sekmesi.
- Butonlar: `Yeni Yedek Oluştur`, `İndir`, `Sil`.
- Liste kolonları: Tarih, tür (tam/dosya/DB), boyut, durum, tetikleyen kullanıcı.
- İşlem sırasında gerçek zamanlı durum (progress bar veya log akışı).

### 5.6 Geliştirme Adımları (API)
1. `/api/customers/:id/backups` (POST) → yeni yedek başlat.
2. `/api/customers/:id/backups` (GET) → yedek listesi.
3. `/api/customers/:id/backups/:backupId/download` (GET) → imzalı URL veya stream.
4. `BackupManager` servisi → dosya arşivleme + pg_dump üstünde koordine.
5. `BackupRepository` → yedek manifestini veritabanına yaz (yeni tablo `customer_backups`).
6. Queue/worker (bullmq veya mevcut task sistemi) ile uzun işlemleri asenkron hale getir.
7. Socket.io eventleri (`backup-progress`, `backup-completed`).

## 6. Versiyon Yönetimi ve Yükseltme Tasarımı
### 6.1 Sürüm Metadatası
- `templates/releases.json` yapısı:
  ```json
  {
    "backend": [{ "version": "2.4.0", "file": "backend-2.4.0.zip", "requires": { "db": ">=2024-05-01" } }],
    "admin": [{ "version": "2.4.0", "file": "admin-2.4.0.zip" }],
    "store": [{ "version": "2.4.0", "file": "store-2.4.0.zip" }],
    "compatMatrix": [{ "backend": "2.5.0", "admin": "2.5.0", "store": "2.5.0" }]
  }
  ```
- Yeni sürüm (v2) eklendiğinde metadata güncellenir ve API bunu cacheleyerek kullanır.

### 6.2 Müşteri Kaydı Genişletmeleri
- `customers` tablosuna sütunlar: `current_backend_version`, `current_admin_version`, `current_store_version`, `target_version`, `last_upgrade_at`.
- Backend, admin, store versiyonlarının uyumlu olması için `customer_versions` tablosu da düşünülebilir (detaylı audit için).

### 6.3 Yükseltme Akışı
1. UI'da müşteri için "Sürüm Yükselt" butonu → hedef sürümü seç (ör. v1 → v2).
2. API `POST /api/customers/:id/upgrade` → parametreler: hedef sürüm, ön koşullar (skipTypeCheck, heapMB opsiyonları).
3. İşlem başlamadan otomatik tam yedek tetiklenir (zorunlu).
4. PM2 prosesleri sırasıyla durdurulur.
5. Yeni template zip'i ilgili müşteri klasörlerine açılır (versiyon alt klasöründe stage alanı, ör: `releases/v2`).
6. Config ve `.env` dosyaları mevcut değerlerle merge edilir (örn. `env-merger` aracı; yeni anahtarlar eklenir, eskiler korunur).
7. `npm install`/`prisma migrate deploy` çalıştırılır; `ImprovedSetupService` reuse edilir.
8. Build adımları: `NODE_OPTIONS`, `heapMB` parametreleri UI'dan alınır.
9. Nginx ve PM2 konfigürasyonları güncellenir (gerekirse).
10. Sağlık kontrolleri (HTTP 200, Socket check) → başarı → müşteri kaydı yeni sürüme güncellenir.
11. Başarısızlıkta rollback: servisler durdurulur, son yedek geri yüklenir (MVP: manuel dokümante; REST API taslağı).

### 6.4 UI Gereksinimleri
- Müşteri detayında "Sürüm Bilgisi" kartı (mevcut sürümler + hedef sürüm seçici).
- Upgrade flow modal: ön koşul listesi, otomatik yedekleme onayı, log akışı.
- Geçmiş yükseltmeler listesi (tarih, önceki sürüm, yeni sürüm, sonucu).

### 6.5 API/Veritabanı Çalışmaları
- Yeni migration: `customer_versions` tablosu, `customer_backups` tablosu.
- Release metadata fetch servisi (`TemplateRegistryService`).
- Upgrade orchestration için `UpgradeManager`; `ImprovedSetupService` içinde alt akış olarak konumlandır.
- Background queue entegrasyonu.

### 6.6 Test Stratejisi
- Unit: BackupManager (manifest üretimi, retention), UpgradeManager (akış branch'leri).
- Integration: Mock templates ile sahte müşteri klasöründe tam akış.
- E2E: Installer UI üzerinden upgrade tetikleme (Playwright + stub backend).

## 7. Operasyonel İyileştirmeler
- **Zamanlama**: CLI cron (örn. `pm2 cron`) ile periyodik yedek planlama; gelecekte UI planlayıcı.
- **Monitoring**: Prometheus metrics (yedek sayısı, başarısızlık oranı) → mevcut sistem kaynağı endpointlerine eklenebilir.
- **Bildirim**: Slack/Webhook entegrasyonu (başarısız işlemde uyarı).

## 8. Yol Haritası (Önceliklendirildi)
1. Veri modeli ve metadata hazırlığı (releases.json, migrationlar).
2. BackupManager + API + UI temel akışı (manuel tetikleme, indirme).
3. UpgradeManager temel akışı (tam yedek → upgrade → doğrulama).
4. Retention ve harici depolama adaptörü.
5. Rollback otomasyonu + zamanlanmış yedeklemeler.
6. Bildirim ve metrik entegrasyonları.

## 9. Riskler ve Açık Sorular
- Büyük müşterilerde `pg_dump` ve arşiv süreleri deployment pencerelerini uzatabilir → işlem öncesi ETA hesaplaması gerekli.
- `.env` merge sırasında manuel müdahale gerektirebilecek çakışmalar olabilir; diff aracı veya onay mekanizması gerekli mi?
- Yedeklerin aynı disk üzerinde tutulması disaster senaryosunda yeterli değil; harici depoya replikasyon için faz 2 planlanmalı.
- Rollback için tam otomasyon MVP kapsamında mı, yoksa dökümantasyon ile mi başlanacak? Karar gerekli.
- Sürüm bağımlılıkları (ör. DB schema) için migration idempotency garantisi; ek validasyon scripti gerekebilir.

## 10. Sonraki Adımlar
- Ürün sahibinden roadmap onayı ve MVP kapsamı netleştirilmesi.
- Geliştirme görevlerini issue tracker'da oluşturma (API/UI opsiyonel alt görevlerle).
- Altyapı ekibiyle yedek depolama politikasını belirleme (disk + bulut).
