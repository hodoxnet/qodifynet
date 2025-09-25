import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { io as socketIO, Socket } from 'socket.io-client';
import { SetupConfig, InstallStatus, CompletedInfo } from '@/lib/types/setup';

export function useInstallation() {
  const [installProgress, setInstallProgress] = useState<string[]>([]);
  const [installStatus, setInstallStatus] = useState<InstallStatus>("idle");
  const [completedInfo, setCompletedInfo] = useState<CompletedInfo | null>(null);

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

    const isLocal = isLocalDomain(config.domain);
    let socket: Socket | null = null;

    try {
      // WebSocket bağlantısı kur
      socket = socketIO(API_URL, { transports: ["websocket"] });

      socket.on("connect", () => {
        socket!.emit("subscribe-deployment", config.domain);
      });

      socket.on("setup-progress", (data: { message: string }) => {
        setInstallProgress(prev => [...prev, data.message]);
      });

      // 1. Template kontrolü
      setInstallProgress(prev => [...prev, "📦 Template'ler kontrol ediliyor..."]);
      await axios.post(`${API_URL}/api/setup/check-templates`,
        { version: config.templateVersion },
        { headers: getAuthHeaders(), withCredentials: true }
      );

      // 2. Veritabanı oluştur
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

      // 3. Template'leri çıkar
      setInstallProgress(prev => [...prev, "📂 Template'ler çıkarılıyor..."]);
      await axios.post(`${API_URL}/api/setup/extract-templates`, {
        domain: config.domain,
        version: config.templateVersion
      }, { headers: getAuthHeaders(), withCredentials: true });

      // 4. Ortam değişkenlerini yapılandır
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

      // 5. Bağımlılıkları yükle
      setInstallProgress(prev => [...prev, "📥 Bağımlılıklar yükleniyor (bu biraz zaman alabilir)..."]);
      await axios.post(`${API_URL}/api/setup/install-dependencies`, {
        domain: config.domain
      }, { headers: getAuthHeaders(), withCredentials: true });

      // 6. Migration'ları çalıştır
      setInstallProgress(prev => [...prev, "🔄 Veritabanı tabloları oluşturuluyor..."]);
      await axios.post(`${API_URL}/api/setup/run-migrations`, {
        domain: config.domain
      }, { headers: getAuthHeaders(), withCredentials: true });

      // 7. Uygulamaları derle
      setInstallProgress(prev => [...prev, "🏗️ Uygulamalar derleniyor..."]);
      await axios.post(`${API_URL}/api/setup/build-applications`, {
        domain: config.domain,
        isLocal
      }, { headers: getAuthHeaders(), withCredentials: true });

      // 8. PM2 ve Nginx yapılandır
      setInstallProgress(prev => [...prev, "🚀 Servisler yapılandırılıyor..."]);
      await axios.post(`${API_URL}/api/setup/configure-services`, {
        domain: config.domain,
        ports,
        isLocal
      }, { headers: getAuthHeaders(), withCredentials: true });

      // 9. Kurulumu tamamla
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
      setInstallStatus("completed");
      toast.success("Kurulum başarıyla tamamlandı!");

    } catch (error: any) {
      setInstallStatus("error");
      toast.error(error.response?.data?.message || "Kurulum sırasında hata oluştu");
      console.error(error);
    } finally {
      if (socket) {
        socket.disconnect();
      }
    }
  }, [API_URL, getAuthHeaders, isLocalDomain]);

  return {
    installProgress,
    installStatus,
    completedInfo,
    startInstallation,
    isLocalDomain
  };
}