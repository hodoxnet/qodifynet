# AGENTS.md

Bu dosya, bu repository'de çalışan ajanlar için çalışma rehberidir.

## Önemli Kural
**Bu projede Türkçe kullanılmaktadır. Tüm açıklamalar, yorumlar ve iletişim Türkçe olmalıdır.**

## Proje Genel Bakış

Bu, her müşteri için izole edilmiş Qodify instance'ları oluşturan ve yöneten multi-tenant e-ticaret platformu deployment sistemidir (Qodify Kurulum Sihirbazı). Sistem, Next.js admin paneli ve Node.js/Express API backend'inden oluşur.

## Geliştirme Komutları

### Installer UI (Next.js Admin Paneli - Port 3030)
```bash
cd installer-ui
npm install          # Bağımlılıkları yükle
npm run dev          # Turbo ile geliştirme sunucusunu 3030 portunda başlat
npm run build        # Production build oluştur
npm run start        # Production sunucusunu başlat
npm run lint         # ESLint çalıştır
```

### Installer API (Node.js Backend - Port 3031)
```bash
cd installer-api
npm install          # Bağımlılıkları yükle
npm run dev          # ts-node-dev ile geliştirme sunucusunu başlat
npm run build        # TypeScript'i dist/ klasörüne derle
npm run start        # Production sunucusunu dist/'ten başlat
npm run lint         # TypeScript dosyaları için ESLint çalıştır
```

### Ortam Kurulumu
```bash
# API için örnek ortam dosyasını kopyala
cp installer-api/.env.example installer-api/.env
# .env dosyasını veritabanı bilgilerin ve yollarınla düzenle
```

## Mimari

### Sistem Bileşenleri
- **installer-ui/**: App Router, React Hook Form ve Tailwind CSS kullanan Next.js 15 admin paneli
- **installer-api/**: TypeScript ile Express API, deployment orkestrasyonunu yönetir
- **templates/stable/**: Ana ZIP dosyaları (backend-2.4.0.zip, admin-2.4.0.zip, store-2.4.0.zip)
- **customers/**: İzole veritabanları ve PM2 konfigürasyonları ile dağıtılmış müşteri instance'ları

### Deployment Akışı
Sistem 11 adımlık deployment süreci yürütür:
1. A kaydı kontrolü ile DNS doğrulama
2. ZIP dosyalarından template çıkarma
3. Müşteri başına PostgreSQL veritabanı oluşturma
4. Ortam konfigürasyonu kurulumu
5. Bağımlılık kurulumu
6. Prisma migration'ları
7. Production build oluşturma
8. PM2 ekosistem konfigürasyonu
9. Nginx reverse proxy kurulumu (önce HTTP-only)
10. SSL sertifikası sağlama (Let’s Encrypt) ve 80→443 yönlendirme
11. PM2 ile servis başlatma

### API Endpoint Yapısı
- `/api/system/*`: Sistem izleme ve kaynak takibi
- `/api/customers/*`: Müşteri CRUD ve deployment işlemleri
- `/api/dns/*`: Domain doğrulama servisleri
- `/api/templates/*`: Template yönetimi

### Müşteri Instance Yapısı
Her müşteri deployment'ı oluşturur:
- İzole PostgreSQL veritabanı (hodox_customer_[id])
- Üç PM2 prosesi: backend, admin, store
- Her servis için ayrı portlar
- Domain yönlendirmesi için Nginx konfigürasyonu
- `customers/[domain]/ecosystem-[domain].config.js` konumunda PM2 ekosistem konfigürasyonu

## Önemli Teknik Detaylar

### Port Yönetimi
- Installer UI: 3030
- Installer API: 3031
- Müşteri instance'ları: 4000+ başlayarak dinamik tahsis

### Veritabanı Mimarisi
- Her müşteri izole PostgreSQL veritabanı alır
- Veritabanı isimlendirmesi: `hodox_customer_[customer_id]`
- pg modülü ile connection pooling

### Proses Yönetimi
- Proses orkestrasyonu için PM2
- Bellek limitleri uygulanır (Backend: 500M, Admin: 300M, Store: 300M)
- Hata durumunda otomatik yeniden başlatma
- Her servis için ayrı log dosyaları

### Gerçek Zamanlı İletişim
- Deployment ilerleme güncellemeleri için Socket.io
- Build sırasında stdout/stderr loglarının akışı (event: `build-output`)
- Build sırasında hafif RAM metrikleri (event: `build-metrics` → `{ service, memoryMB }`)
- Sistem sayfası kaynakları şu anda 5 sn aralıkla HTTP polling ile alınır (socket değil)

## Production Yolları
- Templateler: `/var/qodify/templates/`
- Müşteriler: `/var/qodify/customers/`
- Nginx siteleri: `/etc/nginx/sites-available/`
- SSL sertifikaları: Certbot tarafından yönetilir

## TypeScript Konfigürasyonu
Hem UI hem de API strict TypeScript kullanır:
- Target: ES2022 (API), ES2017 (UI)
- Strict mod etkin
- Debug için source maps
- Declaration dosyaları oluşturma

---

## Son Güncellemeler (Önemli)

### Build İyileştirmeleri (installer-api)
- Build orkestrasyonu `ImprovedSetupService` üzerinden yürütülür.
- Yeni parametreler:
  - `heapMB`: Node heap limiti (`NODE_OPTIONS=--max-old-space-size`)
  - `skipTypeCheck`: Next.js tip kontrolünü build sırasında atlar (deploy sırasında daha istikrarlı)
- Frontend (admin/store) build ortamı:
  - `SWC_WORKER_COUNT=1`, `SWC_MINIFY=false`, `CI=1`, `IS_BUILD_PHASE=1`
  - `IS_BUILD_PHASE=1` ile template projelerinde build-time fetch’ler guard edilebilir.
- Build-lock: Aynı domain için gelen eşzamanlı istekler tek bir Promise sonucu paylaşır (hata yerine sonucu döndürür).
- RAM metrik yayını: Build process + child RSS toplamı 1 sn’de bir `build-metrics` ile yayınlanır.

### UI – Özet Adımı (installer-ui)
- Yeni ayarlar:
  - “Build Bellek Limiti (MB)” (öneri otomatik doldurulur)
  - “Tip kontrolünü build sırasında atla” (skip type check)
  - “Let’s Encrypt ile SSL etkinleştir” + e‑posta
- Terminal/Logs sekmesinde RAM metrikleri satırları görünür: `📈 [BUILD:ADMIN] RAM: 1234 MB`.

### SSL Otomasyonu (Nginx + Certbot)
- `configure-services` adımı production’da:
  1) HTTP-only Nginx config yazılır (webroot hazırlığı)
  2) Certbot kontrol edilir; yoksa otomatik kurulum denenir (snap → apt/dnf fallback)
  3) Sertifika alınır → 443 ssl http2 etkinleştirilir ve 80→443 yönlendirilir
- Nginx config’te Next.js statikleri için ayrıca regex location tanımı yoktur; tüm istekler upstream’e proxy edilir (/_next/* dahil). Bu, CSS/JS 404 sorunlarını engeller.

### Kimlik Doğrulama
- JWT varsayılan süreleri environment ile yönetilir:
  - `JWT_ACCESS_EXPIRES` (varsayılan: `60m`)
  - `JWT_REFRESH_EXPIRES` (varsayılan: `30d`)
- UI tarafı 401 aldığında `/api/auth/refresh` ile access token yeniler.

---

## Operasyon / Doğrulama Notları
- SSL sonrası doğrulama:
  - `curl -I http://domain` → 301/200
  - `curl -I https://domain` → 200
  - `ss -ltnp | rg ':80|:443'` → Nginx her iki portu dinliyor olmalı
- Nginx reload: Yapılandırma değişikliğinden sonra `nginx -t && nginx -s reload`.
- Certbot kurulumunun başarı durumu log’lara yazılır; yeterli yetki yoksa HTTP‑only devam eder.
- DNS A/AAAA kayıtlarının doğru IP’ye işaret ettiğini kontrol edin; 80/tcp dış erişime açık olmalı.

## Sistem Sayfası Telemetri
- Kaynaklar `/api/system/resources` ile 5 sn polling; socket kullanılmıyor.
- CPU değeri load average tabanlıdır (yüzde değildir). Yorumlarken çekirdek sayısını dikkate alın.

## Güvenlik Notu
- Upstream servis portları (ör. 4000+ aralığı) doğrudan erişime açık bırakılmamalıdır.
  - Tercih: Uygulamaları 127.0.0.1’e bind edin ve sadece Nginx üzerinden yayınlayın; ek olarak firewall’da 4000–4999/tcp dışa kapatın.

## Kod / Katkı Rehberi
- Türkçe iletişim ve açıklamalar.
- Mevcut akışı bozmayın; iyileştirmeleri `ImprovedSetupService` ve ilgili controller servislerine ekleyin.
- Nginx konfigürü yazarken Next.js statikleri için ayrı `location ~*` blokları eklemeyin; upstream’e proxy edin.
- SSL adımında certbot bulunamazsa HTTP‑only sürdürün ve log’da açık uyarı verin.
