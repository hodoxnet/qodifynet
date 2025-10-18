import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { PARTNER_HEAP_MB } from '@/lib/constants';
import { toast } from 'sonner';
import { io as socketIO, Socket } from 'socket.io-client';
import { SetupConfig, InstallStatus, CompletedInfo, InstallStep, InstallStepKey } from '@/lib/types/setup';

export function useInstallation() {
  const [installProgress, setInstallProgress] = useState<string[]>([]);
  const [installStatus, setInstallStatus] = useState<InstallStatus>("idle");
  const [completedInfo, setCompletedInfo] = useState<CompletedInfo | null>(null);
  const [steps, setSteps] = useState<InstallStep[]>([]);
  const [buildLogs, setBuildLogs] = useState<{ service: string; type: 'stdout' | 'stderr'; content: string; timestamp: Date }[]>([]);
  const [reservationLedgerId, setReservationLedgerId] = useState<string | undefined>(undefined);
  const statusRef = useRef<InstallStatus>("idle");
  const ledgerRef = useRef<string | undefined>(undefined);

  useEffect(() => { statusRef.current = installStatus; }, [installStatus]);
  useEffect(() => { ledgerRef.current = reservationLedgerId; }, [reservationLedgerId]);

  const API_URL = process.env.NEXT_PUBLIC_INSTALLER_API_URL || "http://localhost:3031";

  const CSRF_KEY = 'qid_csrf_token';
  const ensureCsrfToken = useCallback(async () => {
    try {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(CSRF_KEY) : null;
      if (cached) return cached;
      const res = await fetch(`${API_URL}/api/csrf-token`, { credentials: 'include' });
      if (!res.ok) return null;
      const j = await res.json();
      const tok = j?.token as string | undefined;
      if (tok) {
        try { localStorage.setItem(CSRF_KEY, tok); } catch {}
        return tok;
      }
      return null;
    } catch { return null; }
  }, [API_URL]);

  const getAuthHeaders = useCallback(() => {
    let token = null;
    try {
      token = localStorage.getItem("qid_access");
    } catch {}

    const headers: Record<string, string> = {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json"
    };
    try { const csrf = localStorage.getItem(CSRF_KEY); if (csrf) headers['x-csrf-token'] = csrf; } catch {}
    return headers;
  }, []);

  const isLocalDomain = useCallback((domain: string) => {
    return domain.endsWith('.local') ||
           domain === 'localhost' ||
           !domain.includes('.') ||
           domain.startsWith('test') ||
           domain.startsWith('local');
  }, []);

  const cancelReservation = useCallback(async (keepalive: boolean = false) => {
    try {
      const body = JSON.stringify({ ledgerId: ledgerRef.current });
      const headers = getAuthHeaders();
      await fetch(`${API_URL}/api/setup/cancel-reservation`, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
        keepalive,
      });
    } catch {}
  }, [API_URL, getAuthHeaders]);

  const startInstallation = useCallback(async (config: SetupConfig) => {
    setInstallStatus("running");
    setInstallProgress([]);
    setReservationLedgerId(undefined);
    // Job Queue'ya kurulum ekle
    try {
      await ensureCsrfToken();

      const isLocal = isLocalDomain(config.domain);
      let ledgerId: string | undefined;

      setInstallProgress(prev => [...prev, '💳 Kredi/oturum rezervasyonu yapılıyor...']);
      try {
        const reserveResponse = await axios.post(`${API_URL}/api/setup/reserve-credits`, {
          domain: config.domain,
          isLocal
        }, {
          headers: getAuthHeaders(),
          withCredentials: true
        });

        ledgerId = reserveResponse.data?.ledgerId;
        setReservationLedgerId(ledgerId);

        if (ledgerId) {
          setInstallProgress(prev => [...prev, '✅ Kredi rezervasyonu tamamlandı']);
        } else {
          setInstallProgress(prev => [...prev, '✅ Oturum kilidi alındı']);
        }
      } catch (reserveError: any) {
        const reserveMessage = reserveError.response?.data?.message || reserveError.message || 'Kredi rezervasyonu başarısız';
        setInstallProgress(prev => [...prev, `❌ ${reserveMessage}`]);

        if (reserveError?.response?.status === 402) {
          toast.error('Kredi yetersiz. Lütfen bakiyenizi kontrol edin.');
        } else if (reserveError?.response?.status === 409) {
          toast.error(reserveMessage || 'Devam eden bir kurulum var');
        } else {
          toast.error(reserveMessage);
        }

        setInstallStatus('error');
        console.error('Kredi rezervasyon hatası:', reserveError);
        return;
      }

      setInstallProgress(prev => [...prev, "🚀 Kurulum kuyruğa ekleniyor..."]);

      // Prepare job configuration
      const jobConfig = {
        storeName: config.storeName,
        adminEmail: config.adminEmail || '',
        adminPassword: config.adminPassword || '',
        templateVersion: config.templateVersion || 'latest',
        version: config.templateVersion || 'latest',
        initialData: config.initialData || 'empty',
        dbPrefix: config.dbPrefix,
        dbConfig: {
          host: config.dbHost,
          port: config.dbPort,
          user: config.dbUser,
          password: config.dbPassword,
        },
        redisConfig: {
          host: config.redisHost,
          port: config.redisPort,
          password: config.redisPassword,
        },
        isLocal,
        sslEnable: config.sslEnable || false,
        sslEmail: config.sslEmail || config.adminEmail || '',
        importDemo: config.importDemo || false,
        demoPackName: config.demoPackName,

        // Git specific
        repoUrl: config.gitRepoUrl,
        branch: config.gitBranch,
        accessToken: config.gitAccessToken,
        username: config.gitUsername,
        depth: config.gitDepth,
        commit: config.gitCommit,
      };

      // Create job in queue
      const response = await axios.post(`${API_URL}/api/setup-queue/queue`, {
        domain: config.domain,
        type: config.installSource === 'git' ? 'git' : 'template',
        config: jobConfig,
        reservationLedgerId: ledgerId
      }, {
        headers: getAuthHeaders(),
        withCredentials: true
      });

      if (!response.data.jobId) {
        throw new Error('Job oluşturulamadı');
      }

      const jobId = response.data.jobId;

      setInstallProgress(prev => [...prev, "✅ Kurulum başarıyla kuyruğa eklendi!"]);
      setInstallProgress(prev => [...prev, `📋 Job ID: ${jobId}`]);
      setInstallProgress(prev => [...prev, "⏳ Kurulumunuz sırada bekliyor..."]);
      setInstallProgress(prev => [...prev, "🔄 Kurulum detay sayfasına yönlendiriliyorsunuz..."]);

      toast.success('Kurulum kuyruğa eklendi! Detay sayfasına yönlendiriliyorsunuz...', {
        duration: 3000
      });
      setInstallStatus("completed");

      // Redirect to job detail page after 1 second (smoother transition)
      setTimeout(() => {
        window.location.href = `/setup/${jobId}`;
      }, 1000);

      return;

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Kurulum kuyruğa eklenemedi";
      setInstallProgress(prev => [...prev, `❌ HATA: ${errorMessage}`]);

      await cancelReservation();
      setReservationLedgerId(undefined);

      if (errorMessage.includes('JOB_EXISTS')) {
        toast.error('Bu domain için zaten aktif bir kurulum var!');
        // Redirect to active setups
        setTimeout(() => {
          window.location.href = '/setup/active';
        }, 2000);
      } else if (error.response?.status === 402) {
        toast.error('Kredi yetersiz. Lütfen bakiyenizi kontrol edin.');
      } else if (error.response?.status === 429) {
        toast.error('Çok fazla istek. Lütfen bir süre sonra tekrar deneyin.');
      } else {
        toast.error(errorMessage);
      }

      setInstallStatus("error");
      console.error(error);
      return;
    }

    // Eski kod aşağıda kalsın ama çalışmayacak (return edildi yukarıda)
    const usingGit = config.installSource === 'git';

    // Adım listesi başlangıç durumu
    const initialSteps: InstallStep[] = [
      usingGit
        ? { key: 'prepareGit' as const, label: "📥 Git deposu hazırlanıyor...", status: 'pending' as const }
        : { key: 'checkTemplates' as const, label: "📦 Template'ler kontrol ediliyor...", status: 'pending' as const },
      { key: 'createDatabase' as const, label: "🗄️ Veritabanı oluşturuluyor...", status: 'pending' as const },
      ...(!usingGit ? [{ key: 'extractTemplates' as const, label: "📂 Template'ler çıkarılıyor...", status: 'pending' as const }] : []),
      { key: 'configureEnvironment' as const, label: "⚙️ Ortam değişkenleri yapılandırılıyor...", status: 'pending' as const },
      { key: 'installDependencies' as const, label: "📥 Bağımlılıklar yükleniyor (bu biraz zaman alabilir)...", status: 'pending' as const },
      { key: 'runMigrations' as const, label: "🔄 Veritabanı tabloları oluşturuluyor...", status: 'pending' as const },
      { key: 'buildApplications' as const, label: "🏗️ Uygulamalar derleniyor...", status: 'pending' as const },
      { key: 'configureServices' as const, label: "🚀 Servisler yapılandırılıyor...", status: 'pending' as const },
      { key: 'finalize' as const, label: "✅ Kurulum tamamlanıyor...", status: 'pending' as const },
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
    const lastMetricsAt: Record<string, number> = {};

    try {
      // CSRF token hazır olsun
      await ensureCsrfToken();
      // WebSocket bağlantısı kur
      socket = socketIO(API_URL, {
        // Allow websocket + fallback polling (proxy/firewall uyumluluğu)
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      if (!socket) {
        throw new Error("WebSocket bağlantısı kurulamadı");
      }

      socket!.on("connect", () => {
        socket!.emit("subscribe-deployment", config.domain);
      });

      // Hata tanılamayı kolaylaştır
      socket!.on("connect_error", (err: any) => {
        console.error("Socket connect_error:", err?.message || err);
      });

      socket!.on("setup-progress", (data: { message: string; step?: string; percent?: number; type?: string; details?: any }) => {
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
          git: 'prepareGit',
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
      socket!.on("build-log", (data: { service: string; message: string; type: 'stdout' | 'stderr' }) => {
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
      socket!.on("build-output", (data: {
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

      // Build metrics (RAM) – throttled
      socket!.on("build-metrics", (data: { service: string; memoryMB: number; timestamp?: number }) => {
        const now = Date.now();
        const last = lastMetricsAt[data.service] || 0;
        if (now - last < 2000) return; // 2s throttling to avoid flooding
        lastMetricsAt[data.service] = now;
        const logMessage = `📈 [BUILD:${data.service.toUpperCase()}] RAM: ${data.memoryMB} MB`;
        setInstallProgress(prev => [...prev, logMessage]);
      });

      // Dependency installation detayları
      socket!.on("dependency-log", (data: { package: string; version?: string; status: 'installing' | 'installed' | 'error' }) => {
        const statusIcon = data.status === 'installed' ? '✅' : data.status === 'error' ? '❌' : '📦';
        const versionInfo = data.version ? `@${data.version}` : '';
        const logMessage = `${statusIcon} ${data.package}${versionInfo} - ${data.status}`;
        setInstallProgress(prev => [...prev, logMessage]);
      });

      // Database operation logs
      socket!.on("database-log", (data: { operation: string; table?: string; status: 'success' | 'error'; message?: string }) => {
        const statusIcon = data.status === 'success' ? '✅' : '❌';
        const tableInfo = data.table ? ` [${data.table}]` : '';
        const logMessage = `${statusIcon} DB: ${data.operation}${tableInfo} ${data.message || ''}`;
        setInstallProgress(prev => [...prev, logMessage]);
      });

      // 0. Partner kredisi (production modunda) ön-rezervasyonu
      try {
        setInstallProgress(prev => [...prev, '💳 Kredi/oturum rezervasyonu yapılıyor...']);
        const r = await axios.post(`${API_URL}/api/setup/reserve-credits`, {
          domain: config.domain,
          isLocal
        }, { headers: getAuthHeaders(), withCredentials: true });
        if (r?.data?.ledgerId) {
          setReservationLedgerId(r.data.ledgerId);
          setInstallProgress(prev => [...prev, '✅ Kredi rezervasyonu tamamlandı']);
        } else {
          setInstallProgress(prev => [...prev, '✅ Oturum kilidi alındı']);
        }
      } catch (e: any) {
        if (e?.response?.status === 402) {
          const msg = e?.response?.data?.message || 'Kredi yetersiz';
          setInstallProgress(prev => [...prev, `❌ ${msg}`]);
          mark('checkTemplates', 'error', msg);
          setInstallStatus('error');
          toast.error('Kredi yetersiz. Lütfen bakiyenizi artırın.');
          socket?.disconnect();
          return;
        } else if (e?.response?.status === 409) {
          const msg = e?.response?.data?.message || 'Devam eden kurulum var';
          setInstallProgress(prev => [...prev, `❌ ${msg}`]);
          mark('checkTemplates', 'error', msg);
          setInstallStatus('error');
          toast.error(msg);
          socket?.disconnect();
          return;
        } else {
          console.error('Kredi rezervasyon hatası:', e);
          setInstallProgress(prev => [...prev, '⚠️ Kredi/oturum rezervasyonu sırasında beklenmeyen hata']);
        }
      }

      if (usingGit) {
        if (!config.gitRepoUrl) {
          throw new Error("Git depo adresi gerekli");
        }
        mark('prepareGit', 'running');
        setInstallProgress(prev => [...prev, "📥 Git deposu klonlanıyor..."]);
        await axios.post(`${API_URL}/api/setup/prepare-git`, {
          domain: config.domain,
          repoUrl: config.gitRepoUrl,
          branch: config.gitBranch,
          depth: config.gitDepth,
          accessToken: config.gitAccessToken,
          username: config.gitUsername
        }, { headers: getAuthHeaders(), withCredentials: true });
        setInstallProgress(prev => [...prev, "✅ Git deposu hazırlandı"]);
        mark('prepareGit', 'success');
      } else {
        mark('checkTemplates', 'running');
        setInstallProgress(prev => [...prev, "📦 Template'ler kontrol ediliyor..."]);
        setInstallProgress(prev => [...prev, `📁 Template sürümü: ${config.templateVersion || 'latest'}`]);
        await axios.post(`${API_URL}/api/setup/check-templates`,
          { version: config.templateVersion },
          { headers: getAuthHeaders(), withCredentials: true }
        );
        setInstallProgress(prev => [...prev, "✅ Template'ler hazır"]);
        mark('checkTemplates', 'success');
      }

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

      if (!usingGit) {
        mark('extractTemplates', 'running');
        setInstallProgress(prev => [...prev, "📂 Template'ler çıkarılıyor..."]);
        await axios.post(`${API_URL}/api/setup/extract-templates`, {
          domain: config.domain,
          version: config.templateVersion
        }, { headers: getAuthHeaders(), withCredentials: true });
        mark('extractTemplates', 'success');
      }

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
        redisPassword: config.redisPassword,
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
          heapMB: (typeof config.buildHeapMB === 'number' ? config.buildHeapMB : PARTNER_HEAP_MB),
          skipTypeCheck: config.skipTypeCheckFrontend,
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
        isLocal,
        sslEnable: config.sslEnable,
        sslEmail: config.sslEmail
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
        redisPassword: config.redisPassword,
        storeName: config.storeName,
        isLocal,
        reservationLedgerId
      }, { headers: getAuthHeaders(), withCredentials: true });

      setCompletedInfo(finalResponse.data);
      mark('finalize', 'success');
      setInstallStatus("completed");
      toast.success("Kurulum başarıyla tamamlandı!");

    } catch (error: any) {
      // Hata anında o an koşan adımı 'error' yapmaya çalış
      const lastRunning = steps.find(s => s.status === 'running');
      if (lastRunning) {
        mark(lastRunning!.key, 'error', error.response?.data?.message || error.message || 'Bilinmeyen hata');
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
      socket?.disconnect();
    }
  }, [API_URL, cancelReservation, ensureCsrfToken, getAuthHeaders, isLocalDomain, steps]);

  // Rezervasyon iptali: kullanıcı ayrılırsa veya sayfa kapanırsa
  useEffect(() => {
    const handler = () => {
      if (statusRef.current === 'running') {
        // Attempt best-effort cancel using keepalive; no await
        cancelReservation(true);
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [cancelReservation]);

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
