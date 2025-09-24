# CLAUDE.md

Bu dosya Claude Code (claude.ai/code) için bu repository'de çalışırken kullanılacak rehberlik sağlar.

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
9. Nginx reverse proxy kurulumu
10. SSL sertifikası sağlama
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
- UI ve API arasında WebSocket bağlantısı
- Canlı sistem kaynak izleme

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