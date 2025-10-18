import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { PARTNER_HEAP_MB } from '@/lib/constants';
import { toast } from 'sonner';
import { SetupConfig, InstallStatus, CompletedInfo, InstallStep } from '@/lib/types/setup';

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
    setSteps([]);
    setBuildLogs([]);
    setReservationLedgerId(undefined);

    if (!config.gitRepoUrl) {
      const message = "Git deposu adresi gerekli";
      setInstallProgress(prev => [...prev, `❌ ${message}`]);
      toast.error(message);
      setInstallStatus("error");
      return;
    }

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

      const jobConfig = {
        storeName: config.storeName,
        adminEmail: config.adminEmail || '',
        adminPassword: config.adminPassword || '',
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
        // Git
        repoUrl: config.gitRepoUrl,
        branch: config.gitBranch,
        accessToken: config.gitAccessToken,
        username: config.gitUsername,
        depth: config.gitDepth,
        commit: config.gitCommit,
      };

      const response = await axios.post(`${API_URL}/api/setup-queue/queue`, {
        domain: config.domain,
        type: 'git',
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

      setTimeout(() => {
        window.location.href = `/setup/${jobId}`;
      }, 1000);

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Kurulum kuyruğa eklenemedi";
      setInstallProgress(prev => [...prev, `❌ HATA: ${errorMessage}`]);

      await cancelReservation();
      setReservationLedgerId(undefined);

      if (errorMessage.includes('JOB_EXISTS')) {
        toast.error('Bu domain için zaten aktif bir kurulum var!');
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
    }
  }, [API_URL, cancelReservation, ensureCsrfToken, getAuthHeaders, isLocalDomain]);

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
