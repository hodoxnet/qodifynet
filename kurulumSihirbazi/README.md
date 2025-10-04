# Qodify Kurulum Sihirbazı 🚀

Multi-tenant e-ticaret platformu deployment sistemi. Her müşteri için izole edilmiş Qodify instance'ları oluşturur ve yönetir.

## 🌟 Özellikler

- ✅ Tek tıkla kurulum (sihirbaz)
- ✅ Multi-tenant mimari (ayrı DB/port/domain)
- ✅ Otomatik DNS kontrolü
- ✅ Template/versiyon yönetimi
- ✅ PM2 entegrasyonu ve izleme
- ✅ Nginx otomasyonu (reverse proxy)
- ✅ Let's Encrypt ile SSL
- ✅ Gerçek zamanlı ilerleme ve loglar

## 📁 Proje Yapısı

```
kurulumSihirbazi/
├── installer-ui/          # Next.js Admin Panel (Port: 3030)
├── installer-api/         # Node.js/Express + TypeScript API (Port: 3031)
├── customers/             # Müşteri çalışma dizinleri + PM2 ekosistem dosyaları
└── templates/             # Master ZIP dosyaları
```

## 🚀 Hızlı Başlangıç

### 1) Gereksinimler
- Node.js v18+
- PostgreSQL
- Redis
- Nginx
- PM2 (`npm install -g pm2`)

### 2) Ortam Değişkenleri

```bash
# API ortam dosyası
cp kurulumSihirbazi/installer-api/.env.example kurulumSihirbazi/installer-api/.env
# .env içindeki değerleri düzenleyin (DB, JWT, Nginx yolları vb.)

# UI ortam (gerekirse API adresini özelleştirin)
echo "NEXT_PUBLIC_INSTALLER_API_URL=http://localhost:3031" >> kurulumSihirbazi/installer-ui/.env.local
```

Örnek API `.env` anahtarları:

```
PORT=3031
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qodifynet
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres

# JWT
JWT_SECRET=changeme-access
JWT_REFRESH_SECRET=changeme-refresh

# Yollar (prod için uyarlayın)
TEMPLATES_PATH=/var/qodify/templates
CUSTOMERS_PATH=/var/qodify/customers

# Nginx ve SSL
SSL_EMAIL=admin@qodify.com.tr
NGINX_SITES_PATH=/etc/nginx/sites-available
NGINX_ENABLED_PATH=/etc/nginx/sites-enabled
```

### 3) Kurulum ve Çalıştırma

```bash
# UI
cd kurulumSihirbazi/installer-ui
npm install
npm run dev     # http://localhost:3030

# API
cd kurulumSihirbazi/installer-api
npm install
npm run dev     # http://localhost:3031

# Prod
npm run build && npm run start
```

### 4) Template Hazırlama

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

#### Health/System
- `GET /health` - API sağlık kontrolü
- `GET /api/system/status` - Sistem durumu
- `GET /api/system/resources` - Kaynak kullanımı

#### Customers
- `GET /api/customers` - Müşteri listesi
- `POST /api/customers/deploy` - Yeni müşteri kurulumu
- `POST /api/customers/:id/start` - Müşteriyi başlat
- `POST /api/customers/:id/stop` - Müşteriyi durdur

#### DNS
- `POST /api/dns/check` - Domain DNS kontrolü

### Gerçek Zamanlı Olaylar (Socket.io)
- Oda: `deployment-<domain>`
- Event'ler: `build-output`, `setup-progress`, `build-metrics`

## 🛠 Deployment Flow

1. Domain doğrulama (DNS A)
2. Template çıkarma (ZIP)
3. Database oluşturma (PostgreSQL)
4. Environment yazma (.env)
5. Bağımlılık kurulumu (npm install)
6. Migrations (Prisma)
7. Build (Prod)
8. PM2 ecosystem
9. Nginx setup (reverse proxy)
10. SSL sertifikası (Let's Encrypt)
11. Servisleri başlatma (PM2)

## 📊 İzleme

### PM2
```bash
pm2 monit
pm2 list
pm2 logs <customer-domain>
pm2 status
pm2 describe <process-name>
```

## 🔧 Bakım

### Yedekleme
```bash
# Database backup
pg_dump -U postgres hodox_customer_db > backup.sql

# Dosya yedeği
tar -czf customer-backup.tar.gz /var/qodify/customers/<customer-domain>/
```

### Template Güncelleme
```bash
cp new-version.zip /var/qodify/templates/
```

### SSL Yenileme
```bash
certbot renew
```

## 🔐 Güvenlik

- Müşteri servislerini üretimde `127.0.0.1`'e bind edin; yayın Nginx üzerinden olsun
- Her müşteri için izole database ve Redis namespace
- PM2 memory limitleri ve rate limiting (Nginx)
- SSL/TLS zorunlu

## 📝 Notlar

- Production'da `/var/qodify/` dizinleri kullanılır (templates/customers)
- Template'ler production build içermelidir
- DNS propagasyonu 24 saate kadar sürebilir
- PM2 startup script'ini kurmayı unutmayın

## 🤝 Destek

Sorun veya öneri için issue açabilirsiniz.

---

Qodify Installer – Multi-Tenant E‑Commerce Deployment Platform
