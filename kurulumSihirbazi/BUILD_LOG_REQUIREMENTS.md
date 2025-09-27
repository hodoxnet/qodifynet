# Build Log İyileştirmeleri - Backend API Gereksinimleri

## Problem
Kurulum sırasında `npm run build` gibi komutlar çalıştırılıyor ancak bu komutların gerçek çıktıları (stdout/stderr) frontend'e iletilmiyor. Özellikle Node.js heap memory hatası gibi kritik hatalar tespit edilemiyor.

## Çözüm

### 1. Build Komutlarında Stream Output

`installer-api/src/controllers/setup.controller.ts` veya ilgili dosyada build komutlarını çalıştırırken:

```typescript
// Örnek: Build application endpoint'inde
import { spawn } from 'child_process';

async function buildApplication(domain: string, service: 'backend' | 'admin' | 'store', io: any) {
  const servicePath = path.join(CUSTOMERS_DIR, domain, service);

  return new Promise((resolve, reject) => {
    // spawn kullanarak gerçek zamanlı output al
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: servicePath,
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=4096' // RAM limiti arttır
      },
      shell: true
    });

    let stdout = '';
    let stderr = '';

    // STDOUT - Normal çıktılar
    buildProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;

      // WebSocket ile frontend'e gönder
      io.to(`deployment-${domain}`).emit('build-output', {
        service,
        output,
        type: 'stdout'
      });

      // Progress yüzdesini parse et (eğer varsa)
      const progressMatch = output.match(/(\d+)%/);
      if (progressMatch) {
        io.to(`deployment-${domain}`).emit('setup-progress', {
          message: `${service} derleniyor...`,
          step: 'build',
          percent: parseInt(progressMatch[1])
        });
      }
    });

    // STDERR - Hata çıktıları
    buildProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;

      // Heap memory hatası kontrolü
      const isHeapError = output.includes('JavaScript heap out of memory') ||
                          output.includes('FATAL ERROR') ||
                          output.includes('Allocation failed');

      // WebSocket ile frontend'e gönder
      io.to(`deployment-${domain}`).emit('build-output', {
        service,
        output,
        type: 'stderr',
        isError: true,
        errorType: isHeapError ? 'heap' : 'other'
      });

      if (isHeapError) {
        io.to(`deployment-${domain}`).emit('setup-progress', {
          message: `⚠️ ${service.toUpperCase()} build'i bellek yetersizliğinden başarısız oldu!`,
          step: 'build',
          type: 'error'
        });
      }
    });

    // Process tamamlandığında
    buildProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, stdout, stderr });
      } else {
        reject({
          message: `Build failed with code ${code}`,
          stdout: stdout.slice(-5000), // Son 5000 karakter
          stderr: stderr.slice(-5000),
          code
        });
      }
    });

    // Timeout ekle (10 dakika)
    setTimeout(() => {
      buildProcess.kill();
      reject({
        message: 'Build timeout (10 minutes)',
        stdout: stdout.slice(-5000),
        stderr: stderr.slice(-5000)
      });
    }, 600000);
  });
}
```

### 2. Hata Durumunda Detaylı Response

Build başarısız olduğunda, hata response'una build loglarını ekleyin:

```typescript
app.post('/api/setup/build-applications', async (req, res) => {
  try {
    const { domain, isLocal, streamOutput } = req.body;

    // Build işlemlerini çalıştır
    await buildApplication(domain, 'backend', io);
    await buildApplication(domain, 'admin', io);
    await buildApplication(domain, 'store', io);

    // Dist kontrolü
    const backendDist = path.join(CUSTOMERS_DIR, domain, 'backend', 'dist', 'main.js');
    if (!fs.existsSync(backendDist)) {
      // Build loglarını kontrol et ve gönder
      const buildLogPath = path.join(CUSTOMERS_DIR, domain, 'backend', 'build.log');
      let buildLog = '';

      if (fs.existsSync(buildLogPath)) {
        buildLog = fs.readFileSync(buildLogPath, 'utf-8');
      }

      return res.status(500).json({
        error: 'Backend build failed',
        message: 'Backend build bulunamadı (dist/main.js tespit edilemedi)',
        buildLog: buildLog.slice(-10000), // Son 10KB log
        suggestion: 'Build loglarını kontrol edin. Heap memory hatası varsa NODE_OPTIONS ile RAM limitini arttırın.'
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      error: 'Build failed',
      message: error.message,
      stdout: error.stdout,
      stderr: error.stderr,
      suggestion: error.errorType === 'heap'
        ? 'Node.js bellek yetersizliği. Sunucu RAM\'ini arttırın veya NODE_OPTIONS="--max-old-space-size=4096" kullanın.'
        : 'Build loglarını kontrol edin'
    });
  }
});
```

### 3. PM2 Ecosystem Config'de Memory Limit

`ecosystem.config.js` oluştururken memory limit ekleyin:

```javascript
module.exports = {
  apps: [
    {
      name: `backend-${domain}`,
      script: './dist/main.js',
      cwd: backendPath,
      max_memory_restart: '1G', // Daha yüksek limit
      node_args: '--max-old-space-size=1024', // Node.js heap limit
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=1024'
      }
    }
  ]
};
```

### 4. WebSocket Event'leri

Socket.IO tarafında yeni event'ler ekleyin:

```typescript
io.on('connection', (socket) => {
  socket.on('subscribe-deployment', (domain) => {
    socket.join(`deployment-${domain}`);

    // Deployment loglarını takip et
    socket.on('disconnect', () => {
      socket.leave(`deployment-${domain}`);
    });
  });
});
```

### 5. Dependency Installation Logları

Bağımlılık kurulumunda da benzer yaklaşım:

```typescript
async function installDependencies(domain: string, service: string, io: any) {
  const servicePath = path.join(CUSTOMERS_DIR, domain, service);

  return new Promise((resolve, reject) => {
    const npmProcess = spawn('npm', ['install', '--production'], {
      cwd: servicePath,
      env: process.env,
      shell: true
    });

    npmProcess.stdout.on('data', (data) => {
      const output = data.toString();

      // Package kurulumlarını parse et
      const packageMatch = output.match(/\+ (.+)@(.+)/);
      if (packageMatch) {
        io.to(`deployment-${domain}`).emit('dependency-log', {
          package: packageMatch[1],
          version: packageMatch[2],
          status: 'installed'
        });
      }
    });

    // ... error handling
  });
}
```

## Frontend Entegrasyonu

Frontend tarafında bu event'leri dinlemek için `useInstallation.ts` hook'u güncellenmiştir:

- `build-output` event'i: Build stdout/stderr logları
- `build-log` event'i: Özel build mesajları
- `dependency-log` event'i: Package kurulum detayları

## Test Senaryoları

1. **Normal Build**: Başarılı build'de progress ve loglar görünmeli
2. **Heap Memory Hatası**: RAM yetersizliğinde özel hata mesajı
3. **Syntax Error**: Kod hatalarında detaylı log gösterimi
4. **Timeout**: 10 dakikayı aşan build'lerde timeout hatası

## Öneriler

1. Build işlemleri için ayrı bir worker process kullanın
2. Build loglarını dosyaya da yazın (debugging için)
3. RAM yetersizliği durumunda otomatik retry mekanizması
4. Build cache kullanarak tekrar build sürelerini azaltın

## Kritik Notlar

- **NODE_OPTIONS** environment variable'ı mutlaka set edilmeli
- Build process'lerinde timeout mutlaka olmalı
- Büyük projeler için swap memory aktif edilmeli
- PM2 config'de memory limit'ler makul seviyelerde tutulmalı