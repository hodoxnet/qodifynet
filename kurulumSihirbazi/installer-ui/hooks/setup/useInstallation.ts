import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { io as socketIO, Socket } from 'socket.io-client';
import { SetupConfig, InstallStatus, CompletedInfo, InstallStep, InstallStepKey } from '@/lib/types/setup';

export function useInstallation() {
  const [installProgress, setInstallProgress] = useState<string[]>([]);
  const [installStatus, setInstallStatus] = useState<InstallStatus>("idle");
  const [completedInfo, setCompletedInfo] = useState<CompletedInfo | null>(null);
  const [steps, setSteps] = useState<InstallStep[]>([]);
  const [buildLogs, setBuildLogs] = useState<{ service: string; type: 'stdout' | 'stderr'; content: string; timestamp: Date }[]>([]);

  const API_URL = process.env.NEXT_PUBLIC_INSTALLER_API_URL || "http://localhost:3031";

  const getAuthHeaders = useCallback(() => {
    let token = null;
    try {
      token = localStorage.getItem("qid_access");
    } catch {}

    return {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json"
    };
  }, []);

  const isLocalDomain = useCallback((domain: string) => {
    return domain.endsWith('.local') ||
           domain === 'localhost' ||
           !domain.includes('.') ||
           domain.startsWith('test') ||
           domain.startsWith('local');
  }, []);

  const startInstallation = useCallback(async (config: SetupConfig) => {
    setInstallStatus("running");
    setInstallProgress([]);
    // Adım listesi başlangıç durumu
    const initialSteps: InstallStep[] = [
      { key: 'checkTemplates', label: "📦 Template'ler kontrol ediliyor...", status: 'pending' },
      { key: 'createDatabase', label: "🗄️ Veritabanı oluşturuluyor...", status: 'pending' },
      { key: 'extractTemplates', label: "📂 Template'ler çıkarılıyor...", status: 'pending' },
      { key: 'configureEnvironment', label: "⚙️ Ortam değişkenleri yapılandırılıyor...", status: 'pending' },
      { key: 'installDependencies', label: "📥 Bağımlılıklar yükleniyor (bu biraz zaman alabilir)...", status: 'pending' },
      { key: 'runMigrations', label: "🔄 Veritabanı tabloları oluşturuluyor...", status: 'pending' },
      { key: 'buildApplications', label: "🏗️ Uygulamalar derleniyor...", status: 'pending' },
      { key: 'configureServices', label: "🚀 Servisler yapılandırılıyor...", status: 'pending' },
      { key: 'finalize', label: "✅ Kurulum tamamlanıyor...", status: 'pending' },
    ];
    setSteps(initialSteps);

    const mark = (key: InstallStepKey, status: InstallStep['status'], error?: string) => {
      setSteps(prev => prev.map(s => {
        if (s.key !== key) return s;
        const now = new Date().toISOString();
        if (status === 'running') {
          return { ...s, status, startedAt: now };
        }
        if (status === 'success' || status === 'error') {
          const started = s.startedAt ? new Date(s.startedAt).getTime() : Date.now();
          const durationMs = Date.now() - started;
          return { ...s, status, endedAt: now, durationMs, error };
        }
        return { ...s, status };
      }));
    };

    const isLocal = isLocalDomain(config.domain);
    let socket: Socket | null = null;

    try {
      // WebSocket bağlantısı kur
      socket = socketIO(API_URL, {
        // Allow websocket + fallback polling (proxy/firewall uyumluluğu)
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socket.on("connect", () => {
        socket!.emit("subscribe-deployment", config.domain);
      });

      // Hata tanılamayı kolaylaştır
      socket.on("connect_error", (err: any) => {
        console.error("Socket connect_error:", err?.message || err);
      });

      socket.on("setup-progress", (data: { message: string; step?: string; percent?: number; type?: string; details?: any }) => {
        // Log mesajına timestamp ekle
        const timestamp = new Date().toLocaleTimeString('tr-TR');
        const formattedMessage = `[${timestamp}] ${data.message}`;
        setInstallProgress(prev => [...prev, formattedMessage]);
        const map: Record<string, InstallStepKey> = {
          dependencies: 'installDependencies',
          build: 'buildApplications',
          extract: 'extractTemplates',
          database: 'createDatabase',
          migration: 'runMigrations',
          configure: 'configureEnvironment',
          service: 'configureServices',
          template: 'checkTemplates',
          finalize: 'finalize'
        };

        if (data.step && map[data.step]) {
          const key = map[data.step];
          setSteps(prev => prev.map(s => s.key === key ? {
            ...s,
            status: s.status === 'pending' ? 'running' : s.status,
            progress: typeof data.percent === 'number' ? data.percent : s.progress
          } : s));
        }
      });

      // Backend build log detayları için özel event
      socket.on("build-log", (data: { service: string; message: string; type: 'stdout' | 'stderr' }) => {
        const prefix = data.type === 'stderr' ? '⚠️' : '▶';
        const serviceTag = `[${data.service.toUpperCase()}]`;
        const logMessage = `${prefix} ${serviceTag} ${data.message}`;
        setInstallProgress(prev => [...prev, logMessage]);

        // Build loglarını ayrıca sakla
        setBuildLogs(prev => [...prev, {
          service: data.service,
          type: data.type,
          content: data.message,
          timestamp: new Date()
        }]);
      });

      // Build output (stdout/stderr) için detaylı event
      socket.on("build-output", (data: {
        service: string;
        output: string;
        type: 'stdout' | 'stderr';
        isError?: boolean;
        errorType?: 'heap' | 'syntax' | 'module' | 'other';
      }) => {
        // Terminal'e detaylı log ekle
        const lines = data.output.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          let prefix = '';
          if (data.type === 'stderr') {
            prefix = '❌';
          } else if (line.includes('ERROR') || line.includes('Error')) {
            prefix = '🔴';
          } else if (line.includes('WARNING') || line.includes('Warning')) {
            prefix = '🟡';
          } else if (line.includes('SUCCESS') || line.includes('✓')) {
            prefix = '🟢';
          } else {
            prefix = '🔹';
          }

          const logMessage = `${prefix} [BUILD:${data.service.toUpperCase()}] ${line}`;
          setInstallProgress(prev => [...prev, logMessage]);
        });

        // Heap memory hatası tespiti
        if (data.output.includes('JavaScript heap out of memory') ||
            data.output.includes('FATAL ERROR') ||
            data.output.includes('Allocation failed')) {
          const errorMsg = '🚨 KRITİK: Node.js bellek yetersizliği! Build işlemi başarısız. NODE_OPTIONS="--max-old-space-size=4096" ile tekrar deneyin.';
          setInstallProgress(prev => [...prev, errorMsg]);

          // Build step'ını hata olarak işaretle
          setSteps(prev => prev.map(s =>
            s.key === 'buildApplications' ? {
              ...s,
              status: 'error',
              error: 'Node.js heap memory yetersizliği'
            } : s
          ));
        }
      });

      // Dependency installation detayları
      socket.on("dependency-log", (data: { package: string; version?: string; status: 'installing' | 'installed' | 'error' }) => {
        const statusIcon = data.status === 'installed' ? '✅' : data.status === 'error' ? '❌' : '📦';
        const versionInfo = data.version ? `@${data.version}` : '';
        const logMessage = `${statusIcon} ${data.package}${versionInfo} - ${data.status}`;
        setInstallProgress(prev => [...prev, logMessage]);
      });

      // Database operation logs
      socket.on("database-log", (data: { operation: string; table?: string; status: 'success' | 'error'; message?: string }) => {
        const statusIcon = data.status === 'success' ? '✅' : '❌';
        const tableInfo = data.table ? ` [${data.table}]` : '';
        const logMessage = `${statusIcon} DB: ${data.operation}${tableInfo} ${data.message || ''}`;
        setInstallProgress(prev => [...prev, logMessage]);
      });

      // 1. Template kontrolü
      mark('checkTemplates', 'running');
      setInstallProgress(prev => [...prev, "📦 Template'ler kontrol ediliyor..."]);
      setInstallProgress(prev => [...prev, `📁 Template sürümü: ${config.templateVersion || 'latest'}`]);
      await axios.post(`${API_URL}/api/setup/check-templates`,
        { version: config.templateVersion },
        { headers: getAuthHeaders(), withCredentials: true }
      );
      setInstallProgress(prev => [...prev, "✅ Template'ler hazır"]);
      mark('checkTemplates', 'success');

      // 2. Veritabanı oluştur
      mark('createDatabase', 'running');
      setInstallProgress(prev => [...prev, "🗄️ Veritabanı oluşturuluyor..."]);
      setInstallProgress(prev => [...prev, `📊 Host: ${config.dbHost}:${config.dbPort}`]);
      setInstallProgress(prev => [...prev, `📊 Database: ${config.dbName}`]);
      await axios.post(`${API_URL}/api/setup/create-database`, {
        dbConfig: {
          host: config.dbHost,
          port: config.dbPort,
          user: config.dbUser,
          password: config.dbPassword
        },
        dbName: config.dbName,
        appUser: config.appDbUser,
        appPassword: config.appDbPassword
      }, { headers: getAuthHeaders(), withCredentials: true });
      setInstallProgress(prev => [...prev, "✅ Veritabanı başarıyla oluşturuldu"]);
      mark('createDatabase', 'success');

      // 3. Template'leri çıkar
      mark('extractTemplates', 'running');
      setInstallProgress(prev => [...prev, "📂 Template'ler çıkarılıyor..."]);
      await axios.post(`${API_URL}/api/setup/extract-templates`, {
        domain: config.domain,
        version: config.templateVersion
      }, { headers: getAuthHeaders(), withCredentials: true });
      mark('extractTemplates', 'success');

      // 4. Ortam değişkenlerini yapılandır
      mark('configureEnvironment', 'running');
      setInstallProgress(prev => [...prev, "⚙️ Ortam değişkenleri yapılandırılıyor..."]);
      const envResponse = await axios.post(`${API_URL}/api/setup/configure-environment`, {
        domain: config.domain,
        dbName: config.dbName,
        dbUser: config.appDbUser,
        dbPassword: config.appDbPassword,
        dbHost: config.dbHost,
        dbPort: config.dbPort,
        redisHost: config.redisHost,
        redisPort: config.redisPort,
        storeName: config.storeName
      }, { headers: getAuthHeaders(), withCredentials: true });

      const ports = envResponse.data.ports;
      mark('configureEnvironment', 'success');

      // 5. Bağımlılıkları yükle
      mark('installDependencies', 'running');
      setInstallProgress(prev => [...prev, "📥 Bağımlılıklar yükleniyor (bu biraz zaman alabilir)..."]);
      setInstallProgress(prev => [...prev, "📦 Backend bağımlılıkları yükleniyor..."]);
      setInstallProgress(prev => [...prev, "📦 Admin panel bağımlılıkları yükleniyor..."]);
      setInstallProgress(prev => [...prev, "📦 Store bağımlılıkları yükleniyor..."]);
      await axios.post(`${API_URL}/api/setup/install-dependencies`, {
        domain: config.domain
      }, { headers: getAuthHeaders(), withCredentials: true });
      setInstallProgress(prev => [...prev, "✅ Tüm bağımlılıklar başarıyla yüklendi"]);
      mark('installDependencies', 'success');

      // 6. Migration'ları çalıştır
      mark('runMigrations', 'running');
      setInstallProgress(prev => [...prev, "🔄 Veritabanı tabloları oluşturuluyor..."]);
      await axios.post(`${API_URL}/api/setup/run-migrations`, {
        domain: config.domain
      }, { headers: getAuthHeaders(), withCredentials: true });
      mark('runMigrations', 'success');

      // 7. Uygulamaları derle
      mark('buildApplications', 'running');
      setInstallProgress(prev => [...prev, "🏗️ Uygulamalar derleniyor..."]);
      setInstallProgress(prev => [...prev, "🔨 Backend API derleniyor..."]);
      setInstallProgress(prev => [...prev, "🔨 Admin paneli derleniyor (Next.js production build)..."]);
      setInstallProgress(prev => [...prev, "🔨 Store frontend derleniyor (Next.js production build)..."]);
      setInstallProgress(prev => [...prev, "💡 İpucu: Build logları Terminal sekmesinde görüntüleniyor..."]);

      try {
        await axios.post(`${API_URL}/api/setup/build-applications`, {
          domain: config.domain,
          isLocal,
          heapMB: config.buildHeapMB,
          streamOutput: true // Backend'e build output'ları stream etmesini söyle
        }, { headers: getAuthHeaders(), withCredentials: true });
        setInstallProgress(prev => [...prev, "✅ Tüm uygulamalar başarıyla derlendi"]);
        mark('buildApplications', 'success');
      } catch (buildError: any) {
        // Build hatasını detaylı logla
        const errorDetail = buildError.response?.data?.buildLog || buildError.response?.data?.message || 'Build başarısız';
        setInstallProgress(prev => [...prev, `❌ BUILD HATASI: ${errorDetail}`]);

        // Eğer build log varsa göster
        if (buildError.response?.data?.stdout) {
          const stdoutLines = buildError.response.data.stdout.split('\n').slice(-20); // Son 20 satır
          stdoutLines.forEach((line: string) => {
            if (line.trim()) setInstallProgress(prev => [...prev, `  📝 ${line}`]);
          });
        }
        if (buildError.response?.data?.stderr) {
          const stderrLines = buildError.response.data.stderr.split('\n').slice(-20); // Son 20 satır
          stderrLines.forEach((line: string) => {
            if (line.trim()) setInstallProgress(prev => [...prev, `  ⚠️ ${line}`]);
          });
        }
        throw buildError;
      }

      // 8. PM2 ve Nginx yapılandır
      mark('configureServices', 'running');
      setInstallProgress(prev => [...prev, "🚀 Servisler yapılandırılıyor..."]);
      await axios.post(`${API_URL}/api/setup/configure-services`, {
        domain: config.domain,
        ports,
        isLocal
      }, { headers: getAuthHeaders(), withCredentials: true });
      mark('configureServices', 'success');

      // 9. Kurulumu tamamla
      mark('finalize', 'running');
      setInstallProgress(prev => [...prev, "✅ Kurulum tamamlanıyor..."]);
      const finalResponse = await axios.post(`${API_URL}/api/setup/finalize`, {
        domain: config.domain,
        ports,
        dbName: config.dbName,
        dbUser: config.appDbUser,
        dbHost: config.dbHost,
        dbPort: config.dbPort,
        redisHost: config.redisHost,
        redisPort: config.redisPort,
        storeName: config.storeName,
        isLocal
      }, { headers: getAuthHeaders(), withCredentials: true });

      setCompletedInfo(finalResponse.data);
      mark('finalize', 'success');
      setInstallStatus("completed");
      toast.success("Kurulum başarıyla tamamlandı!");

    } catch (error: any) {
      // Hata anında o an koşan adımı 'error' yapmaya çalış
      const lastRunning = steps.find(s => s.status === 'running');
      if (lastRunning) {
        mark(lastRunning.key, 'error', error.response?.data?.message || error.message || 'Bilinmeyen hata');
      }

      // Hata loglarını ekle
      const errorMessage = error.response?.data?.message || error.message || "Kurulum sırasında hata oluştu";
      setInstallProgress(prev => [...prev, `❌ HATA: ${errorMessage}`]);

      if (error.response?.data?.details) {
        setInstallProgress(prev => [...prev, `📋 Detaylar: ${JSON.stringify(error.response.data.details)}`]);
      }

      if (error.response?.data?.suggestion) {
        setInstallProgress(prev => [...prev, `💡 Öneri: ${error.response.data.suggestion}`]);
      }

      setInstallStatus("error");
      toast.error(errorMessage);
      console.error(error);
    } finally {
      if (socket) {
        socket.disconnect();
      }
    }
  }, [API_URL, getAuthHeaders, isLocalDomain, steps]);

  return {
    installProgress,
    installStatus,
    completedInfo,
    steps,
    buildLogs,
    startInstallation,
    isLocalDomain
  };
}
