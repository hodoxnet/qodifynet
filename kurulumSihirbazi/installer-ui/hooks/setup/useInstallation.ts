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

      socket.on("setup-progress", (data: { message: string; step?: string; percent?: number }) => {
        setInstallProgress(prev => [...prev, data.message]);
        const map: Record<string, InstallStepKey> = {
          dependencies: 'installDependencies',
          build: 'buildApplications',
          extract: 'extractTemplates',
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

      // 1. Template kontrolü
      mark('checkTemplates', 'running');
      setInstallProgress(prev => [...prev, "📦 Template'ler kontrol ediliyor..."]);
      await axios.post(`${API_URL}/api/setup/check-templates`,
        { version: config.templateVersion },
        { headers: getAuthHeaders(), withCredentials: true }
      );
      mark('checkTemplates', 'success');

      // 2. Veritabanı oluştur
      mark('createDatabase', 'running');
      setInstallProgress(prev => [...prev, "🗄️ Veritabanı oluşturuluyor..."]);
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
      await axios.post(`${API_URL}/api/setup/install-dependencies`, {
        domain: config.domain
      }, { headers: getAuthHeaders(), withCredentials: true });
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
      await axios.post(`${API_URL}/api/setup/build-applications`, {
        domain: config.domain,
        isLocal
      }, { headers: getAuthHeaders(), withCredentials: true });
      mark('buildApplications', 'success');

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
      setInstallStatus("error");
      toast.error(error.response?.data?.message || "Kurulum sırasında hata oluştu");
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
    startInstallation,
    isLocalDomain
  };
}
