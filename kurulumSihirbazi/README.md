# Qodify Kurulum Sihirbazı 🚀

Multi-tenant e-ticaret platformu deployment sistemi. Her müşteri için izole edilmiş Qodify instance'ları oluşturur ve yönetir.

## 🌟 Özellikler

- ✅ **Tek Tıkla Kurulum** - Yeni müşteri kurulumu wizard ile kolayca yapılır
- ✅ **Multi-Tenant Mimari** - Her müşteri için ayrı database, port ve domain
- ✅ **Otomatik DNS Kontrolü** - Domain yönlendirme doğrulaması
- ✅ **Template Sistemi** - Versiyon yönetimi ile hazır şablonlar
- ✅ **PM2 Entegrasyonu** - Process yönetimi ve monitoring
- ✅ **Nginx Otomasyonu** - Otomatik reverse proxy konfigürasyonu
- ✅ **SSL Sertifikaları** - Let's Encrypt ile otomatik HTTPS
- ✅ **Gerçek Zamanlı İzleme** - CPU, RAM ve disk kullanımı takibi

## 📁 Proje Yapısı

```
kurulum-sihirbazi/
├── installer-ui/          # Next.js Admin Panel (Port: 3030)
├── installer-api/         # Node.js Backend API (Port: 3031)
├── templates/             # Master ZIP dosyaları
├── scripts/               # Yardımcı scriptler
└── config/                # Konfigürasyon dosyaları
```

## 🚀 Hızlı Başlangıç

### 1. Gereksinimler
- Node.js v18+
- PostgreSQL
- Redis
- Nginx
- PM2 (`npm install -g pm2`)

### 2. Kurulum

```bash
# UI Dependencies
cd installer-ui
npm install
npm run dev

# API Dependencies
cd installer-api
npm install
npm run dev
```

### 3. Environment Ayarları

```bash
# installer-api/.env
PORT=3031
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
```

### 4. Template Hazırlama

```bash
# Mevcut projelerden template oluştur
cd /path/to/qodify
zip -r backend-2.4.0.zip QodifyBackend/
zip -r admin-2.4.0.zip qodify-frontend/
zip -r store-2.4.0.zip qodify-store/

# Templates klasörüne kopyala
cp *.zip /var/qodify/templates/
```

## 💻 Kullanım

### Web UI
```
http://localhost:3030
```

### API Endpoints

#### System
- `GET /api/system/status` - Sistem durumu
- `GET /api/system/resources` - Kaynak kullanımı

#### Customers
- `GET /api/customers` - Müşteri listesi
- `POST /api/customers/deploy` - Yeni müşteri kurulumu
- `POST /api/customers/:id/start` - Müşteriyi başlat
- `POST /api/customers/:id/stop` - Müşteriyi durdur

#### DNS
- `POST /api/dns/check` - Domain DNS kontrolü

## 🛠 Deployment Flow

1. **Domain Doğrulama** - DNS A kaydı kontrolü
2. **Template Extraction** - ZIP dosyalarının açılması
3. **Database Setup** - PostgreSQL database oluşturma
4. **Environment Config** - .env dosyaları ayarlama
5. **Dependencies** - npm install çalıştırma
6. **Migrations** - Prisma migrate deploy
7. **Build** - Production build oluşturma
8. **PM2 Config** - Ecosystem dosyası oluşturma
9. **Nginx Setup** - Reverse proxy ayarları
10. **SSL Certificate** - HTTPS sertifikası alma
11. **Start Services** - PM2 ile başlatma

## 📊 Monitoring

### PM2 Dashboard
```bash
pm2 monit
pm2 list
pm2 logs <customer-domain>
```

### Resource Usage
```bash
pm2 status
pm2 describe <process-name>
```

## 🔧 Maintenance

### Backup Müşteri
```bash
# Database backup
pg_dump -U postgres hodox_customer_db > backup.sql

# Files backup
tar -czf customer-backup.tar.gz /var/qodify/customers/customer-domain/
```

### Update Template
```bash
# Yeni version ekle
cp new-version.zip /var/qodify/templates/
```

### SSL Renewal
```bash
certbot renew
```

## 🔐 Güvenlik

- Her müşteri için izole database
- Ayrı Redis namespace
- PM2 memory limitleri
- Nginx rate limiting
- SSL/TLS zorunlu

## 📝 Notlar

- Production'da `/var/qodify/` klasörünü kullanın
- Template'ler production build içermeli
- DNS propagasyonu 24 saate kadar sürebilir
- PM2 startup script'i kurmayı unutmayın

## 🤝 Destek

Sorun veya öneri için issue açabilirsiniz.

---

**Qodify Installer** - Multi-Tenant E-Commerce Deployment Platform