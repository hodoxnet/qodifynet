// installer-api/src/controllers/setup.controller.ts için örnek build fonksiyonu
// Bu kodu backend API'ye entegre edin

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Build işlemini gerçek zamanlı log stream'i ile çalıştır
 */
async function buildApplicationWithStream(domain, service, io) {
  const CUSTOMERS_DIR = '/var/qodify/customers';
  const servicePath = path.join(CUSTOMERS_DIR, domain, service);
  const logPath = path.join(servicePath, `build-${service}.log`);

  // Log dosyasını oluştur
  const logStream = fs.createWriteStream(logPath);

  return new Promise((resolve, reject) => {
    console.log(`[${service}] Build başlatılıyor: ${servicePath}`);

    // Environment variables
    const buildEnv = {
      ...process.env,
      NODE_ENV: 'production',
      // RAM limitini arttır - heap memory hatalarını önlemek için
      NODE_OPTIONS: '--max-old-space-size=4096',
      // Next.js için telemetry'yi kapat
      NEXT_TELEMETRY_DISABLED: '1'
    };

    // Build komutu
    const buildCmd = service === 'backend' ? 'build' : 'build';
    const buildProcess = spawn('npm', ['run', buildCmd], {
      cwd: servicePath,
      env: buildEnv,
      shell: true,
      // stdin, stdout, stderr'i pipe et
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let lastProgress = 0;
    let hasError = false;

    // STDOUT handler
    buildProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      logStream.write(`[STDOUT] ${output}`);

      // Her satırı ayrı ayrı işle
      const lines = output.split('\\n').filter(line => line.trim());

      lines.forEach(line => {
        // WebSocket ile gönder
        io.to(`deployment-${domain}`).emit('build-output', {
          service,
          output: line,
          type: 'stdout'
        });

        // Progress yüzdesini çıkar
        const progressMatch = line.match(/(\\d+)%/);
        if (progressMatch) {
          const progress = parseInt(progressMatch[1]);
          if (progress > lastProgress) {
            lastProgress = progress;
            io.to(`deployment-${domain}`).emit('setup-progress', {
              message: `${service.charAt(0).toUpperCase() + service.slice(1)} derleniyor...`,
              step: 'build',
              percent: progress
            });
          }
        }

        // Next.js build aşamalarını takip et
        if (line.includes('Creating an optimized production build')) {
          io.to(`deployment-${domain}`).emit('setup-progress', {
            message: `${service}: Production build oluşturuluyor...`,
            step: 'build'
          });
        } else if (line.includes('Collecting page data')) {
          io.to(`deployment-${domain}`).emit('setup-progress', {
            message: `${service}: Sayfa verileri toplanıyor...`,
            step: 'build'
          });
        } else if (line.includes('Generating static pages')) {
          io.to(`deployment-${domain}`).emit('setup-progress', {
            message: `${service}: Statik sayfalar oluşturuluyor...`,
            step: 'build'
          });
        } else if (line.includes('Finalizing page optimization')) {
          io.to(`deployment-${domain}`).emit('setup-progress', {
            message: `${service}: Optimizasyon tamamlanıyor...`,
            step: 'build'
          });
        }

        // TypeScript build (backend için)
        if (line.includes('tsc')) {
          io.to(`deployment-${domain}`).emit('setup-progress', {
            message: `${service}: TypeScript derleniyor...`,
            step: 'build'
          });
        }
      });
    });

    // STDERR handler
    buildProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      logStream.write(`[STDERR] ${output}`);

      // Heap memory hatası kontrolü
      if (output.includes('JavaScript heap out of memory') ||
          output.includes('FATAL ERROR') ||
          output.includes('Allocation failed') ||
          output.includes('Cannot allocate memory')) {

        hasError = true;

        // Kritik hata bildirimi
        io.to(`deployment-${domain}`).emit('build-output', {
          service,
          output: '❌ KRİTİK HATA: Node.js bellek yetersizliği (heap out of memory)!',
          type: 'stderr',
          isError: true,
          errorType: 'heap'
        });

        io.to(`deployment-${domain}`).emit('build-output', {
          service,
          output: '💡 Çözüm: Sunucu RAM\'ini arttırın veya NODE_OPTIONS="--max-old-space-size=8192" kullanın',
          type: 'stderr'
        });

        // Detaylı memory bilgisi
        const memoryInfo = `
📊 Memory Bilgisi:
- Mevcut limit: ${buildEnv.NODE_OPTIONS || 'Varsayılan (~1.4GB)'}
- Önerilen: --max-old-space-size=8192 (8GB)
- Alternatif: Swap memory aktif edin
        `.trim();

        io.to(`deployment-${domain}`).emit('build-output', {
          service,
          output: memoryInfo,
          type: 'stderr'
        });
      }
      // Normal hata mesajları
      else {
        const lines = output.split('\\n').filter(line => line.trim());
        lines.forEach(line => {
          io.to(`deployment-${domain}`).emit('build-output', {
            service,
            output: line,
            type: 'stderr'
          });

          // TypeScript hataları
          if (line.includes('error TS')) {
            io.to(`deployment-${domain}`).emit('setup-progress', {
              message: `${service}: TypeScript hatası tespit edildi`,
              step: 'build',
              type: 'error'
            });
          }

          // ESLint hataları
          if (line.includes('ESLint') && line.includes('error')) {
            io.to(`deployment-${domain}`).emit('setup-progress', {
              message: `${service}: ESLint hatası tespit edildi`,
              step: 'build',
              type: 'warning'
            });
          }
        });
      }
    });

    // Process bitişi
    buildProcess.on('close', (code) => {
      logStream.end();

      console.log(`[${service}] Build tamamlandı. Exit code: ${code}`);

      if (code === 0) {
        // Başarılı - dist/out kontrolü yap
        let buildSuccess = false;
        let buildPath = '';

        if (service === 'backend') {
          buildPath = path.join(servicePath, 'dist', 'main.js');
          buildSuccess = fs.existsSync(buildPath);
        } else {
          // Next.js için .next veya out klasörü
          const nextPath = path.join(servicePath, '.next');
          const outPath = path.join(servicePath, 'out');
          buildSuccess = fs.existsSync(nextPath) || fs.existsSync(outPath);
          buildPath = fs.existsSync(nextPath) ? nextPath : outPath;
        }

        if (buildSuccess) {
          io.to(`deployment-${domain}`).emit('setup-progress', {
            message: `✅ ${service} build başarılı`,
            step: 'build',
            percent: 100
          });
          resolve({
            success: true,
            path: buildPath,
            stdout: stdout.slice(-5000),
            stderr: stderr.slice(-5000)
          });
        } else {
          // Build başarılı görünüyor ama output yok
          io.to(`deployment-${domain}`).emit('build-output', {
            service,
            output: `❌ Build tamamlandı ancak çıktı dosyaları bulunamadı (${buildPath})`,
            type: 'stderr',
            isError: true
          });
          reject({
            message: `Build output not found at ${buildPath}`,
            stdout: stdout.slice(-10000),
            stderr: stderr.slice(-10000),
            code: 'OUTPUT_NOT_FOUND'
          });
        }
      } else if (code === 137 || hasError) {
        // 137 = SIGKILL (muhtemelen OOM killer)
        reject({
          message: 'Build process killed (likely out of memory)',
          stdout: stdout.slice(-10000),
          stderr: stderr.slice(-10000),
          code: 'MEMORY_ERROR',
          errorType: 'heap'
        });
      } else {
        // Diğer hatalar
        reject({
          message: `Build failed with exit code ${code}`,
          stdout: stdout.slice(-10000),
          stderr: stderr.slice(-10000),
          code
        });
      }
    });

    // Error handler
    buildProcess.on('error', (err) => {
      logStream.end();
      console.error(`[${service}] Build process error:`, err);

      io.to(`deployment-${domain}`).emit('build-output', {
        service,
        output: `❌ Build process başlatılamadı: ${err.message}`,
        type: 'stderr',
        isError: true
      });

      reject({
        message: `Failed to start build process: ${err.message}`,
        error: err,
        code: 'SPAWN_ERROR'
      });
    });

    // Timeout - 15 dakika
    const timeout = setTimeout(() => {
      buildProcess.kill('SIGTERM');
      setTimeout(() => {
        buildProcess.kill('SIGKILL');
      }, 5000);

      io.to(`deployment-${domain}`).emit('build-output', {
        service,
        output: '⏱️ Build timeout (15 dakika). İşlem sonlandırıldı.',
        type: 'stderr',
        isError: true
      });

      reject({
        message: 'Build timeout after 15 minutes',
        stdout: stdout.slice(-10000),
        stderr: stderr.slice(-10000),
        code: 'TIMEOUT'
      });
    }, 15 * 60 * 1000);

    // Cleanup timeout when process ends
    buildProcess.on('exit', () => {
      clearTimeout(timeout);
    });
  });
}

// Express endpoint örneği
async function handleBuildApplications(req, res, io) {
  const { domain, isLocal, streamOutput } = req.body;

  try {
    // Paralel build yerine sıralı build (memory için)
    console.log('Backend build başlatılıyor...');
    const backendResult = await buildApplicationWithStream(domain, 'backend', io);

    console.log('Admin panel build başlatılıyor...');
    const adminResult = await buildApplicationWithStream(domain, 'admin', io);

    console.log('Store build başlatılıyor...');
    const storeResult = await buildApplicationWithStream(domain, 'store', io);

    res.json({
      success: true,
      results: {
        backend: backendResult.path,
        admin: adminResult.path,
        store: storeResult.path
      }
    });

  } catch (error) {
    console.error('Build error:', error);

    // Hata tipine göre özel mesajlar
    let suggestion = 'Build loglarını kontrol edin.';

    if (error.errorType === 'heap' || error.code === 'MEMORY_ERROR') {
      suggestion = `
Node.js bellek yetersizliği tespit edildi. Çözüm önerileri:
1. Sunucu RAM'ini arttırın (en az 4GB önerilir)
2. NODE_OPTIONS="--max-old-space-size=8192" kullanın
3. Swap memory aktif edin: sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
4. Build işlemlerini sıralı yapın (paralel değil)
      `.trim();
    } else if (error.code === 'TIMEOUT') {
      suggestion = 'Build işlemi çok uzun sürdü. Daha güçlü bir sunucu kullanın veya projeyi optimize edin.';
    } else if (error.code === 'OUTPUT_NOT_FOUND') {
      suggestion = 'Build başarılı görünüyor ancak çıktı dosyaları oluşmadı. package.json build script\'ini kontrol edin.';
    }

    res.status(500).json({
      error: 'Build failed',
      message: error.message,
      stdout: error.stdout,
      stderr: error.stderr,
      code: error.code,
      errorType: error.errorType,
      suggestion,
      // Log dosyası yolu
      logFile: `/var/qodify/customers/${domain}/${error.service || 'build'}/build-*.log`
    });
  }
}

module.exports = {
  buildApplicationWithStream,
  handleBuildApplications
};