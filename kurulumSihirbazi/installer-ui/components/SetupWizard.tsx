"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Database,
  HardDrive,
  Globe,
  Settings,
  Rocket,
  ArrowRight,
  ArrowLeft,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { io as socketIO } from "socket.io-client";
import axios from "axios";

interface SystemRequirement {
  name: string;
  status: "ok" | "warning" | "error";
  version?: string;
  message?: string;
  required: boolean;
}

interface SetupConfig {
  // Veritabanı
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  appDbUser: string;
  appDbPassword: string;

  // Redis
  redisHost: string;
  redisPort: number;

  // Site bilgileri
  domain: string;
  storeName: string;
  adminEmail: string;
  adminPassword: string;
  templateVersion: string;
}

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [requirements, setRequirements] = useState<SystemRequirement[]>([]);
  const [config, setConfig] = useState<SetupConfig>({
    dbHost: "localhost",
    dbPort: 5432,
    dbUser: "postgres",
    dbPassword: "",
    dbName: "",
    appDbUser: "qodify_user",
    appDbPassword: "qodify_pass",
    redisHost: "localhost",
    redisPort: 6379,
    domain: "",
    storeName: "",
    adminEmail: "",
    adminPassword: "",
    templateVersion: "latest"
  });

  const [dbTestResult, setDbTestResult] = useState<{ ok: boolean; message: string; version?: string } | null>(null);
  const [redisTestResult, setRedisTestResult] = useState<{ ok: boolean; message: string; version?: string } | null>(null);
  const [installProgress, setInstallProgress] = useState<string[]>([]);
  const [installStatus, setInstallStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
  const [completedInfo, setCompletedInfo] = useState<any>(null);

  const API_URL = process.env.NEXT_PUBLIC_INSTALLER_API_URL || "http://localhost:3031";

  // Token'ı localStorage'dan al
  const getAuthHeaders = () => {
    let token = null;
    try {
      token = localStorage.getItem("qid_access");
    } catch {}

    return {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json"
    };
  };

  // Adım 1: Sistem gereksinimlerini kontrol et
  const checkRequirements = async () => {
    setLoading(true);
    // State'i temizle
    setRequirements([]);

    try {
      const response = await axios.get(`${API_URL}/api/setup/requirements`, {
        headers: getAuthHeaders(),
        withCredentials: true,
        // Cache kullanma
        params: { t: Date.now() }
      });

      if (response.data.ok) {
        console.log("Requirements from API:", response.data.requirements);
        setRequirements(response.data.requirements);
      } else {
        toast.error("Sistem gereksinimleri alınamadı");
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error("Oturum süreniz dolmuş. Tekrar giriş yapın.");
        window.location.href = "/login";
      } else {
        toast.error("Bağlantı hatası");
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Adım 2: Veritabanı bağlantısını test et
  const testDatabase = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/setup/test-database`,
        {
          host: config.dbHost,
          port: config.dbPort,
          user: config.dbUser,
          password: config.dbPassword
        },
        { headers: getAuthHeaders(), withCredentials: true }
      );

      setDbTestResult(response.data);
      if (response.data.ok) {
        toast.success("Veritabanı bağlantısı başarılı!");
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error("Veritabanı test hatası");
      setDbTestResult({ ok: false, message: "Bağlantı kurulamadı" });
    } finally {
      setLoading(false);
    }
  };

  // Adım 3: Redis bağlantısını test et
  const testRedis = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/setup/test-redis`,
        {
          host: config.redisHost,
          port: config.redisPort
        },
        { headers: getAuthHeaders(), withCredentials: true }
      );

      setRedisTestResult(response.data);
      if (response.data.ok) {
        toast.success("Redis bağlantısı başarılı!");
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error("Redis test hatası");
      setRedisTestResult({ ok: false, message: "Bağlantı kurulamadı" });
    } finally {
      setLoading(false);
    }
  };

  // Local domain kontrolü
  const isLocalDomain = (domain: string) => {
    return domain.endsWith('.local') ||
           domain === 'localhost' ||
           !domain.includes('.') ||
           domain.startsWith('test') ||
           domain.startsWith('local');
  };

  // Kurulum sürecini başlat
  const startInstallation = async () => {
    setInstallStatus("running");
    setInstallProgress([]);
    setCurrentStep(6);  // Kurulum başladığında 6. adıma geç

    const isLocal = isLocalDomain(config.domain);

    // WebSocket bağlantısı kur
    const socket = socketIO(API_URL, { transports: ["websocket"] });
    socket.on("connect", () => {
      socket.emit("subscribe-deployment", config.domain);
    });
    socket.on("setup-progress", (data: { message: string }) => {
      setInstallProgress(prev => [...prev, data.message]);
    });

    try {
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
        adminEmail: config.adminEmail,
        adminPassword: config.adminPassword,
        isLocal
      }, { headers: getAuthHeaders(), withCredentials: true });

      setCompletedInfo(finalResponse.data);
      setInstallStatus("completed");
      setCurrentStep(6);  // 6. adıma geç
      toast.success("Kurulum başarıyla tamamlandı!");

    } catch (error: any) {
      setInstallStatus("error");
      setCurrentStep(6);  // Hata durumunda da 6. adıma geç
      toast.error(error.response?.data?.message || "Kurulum sırasında hata oluştu");
      console.error(error);
    } finally {
      socket.disconnect();
    }
  };

  useEffect(() => {
    if (currentStep === 1) {
      // Token kontrolü yap
      const token = localStorage.getItem("qid_access");
      if (!token) {
        toast.error("Oturum açmanız gerekiyor!");
        window.location.href = "/login";
        return;
      }
      checkRequirements();
    }
  }, [currentStep]);

  // Domain'e göre otomatik DB adı öner
  useEffect(() => {
    if (config.domain) {
      const dbName = `qodify_${config.domain.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      setConfig(prev => ({ ...prev, dbName }));
    }
  }, [config.domain]);

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        // Sistem Gereksinimleri
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <HardDrive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Sistem Kontrolü</h2>
              <p className="text-gray-600 mt-2">Kurulum için gerekli bileşenler kontrol ediliyor</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
              </div>
            ) : (
              <div className="space-y-3">
                {requirements.map((req) => (
                  <div
                    key={req.name}
                    className="flex items-center justify-between p-4 border rounded-lg bg-white"
                  >
                    <div className="flex items-center space-x-3">
                      {req.status === "ok" ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : req.status === "warning" ? (
                        <AlertCircle className="w-5 h-5 text-yellow-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-medium text-gray-900">
                          {req.name}
                          {!req.required && <span className="text-sm text-gray-500 ml-2">(İsteğe bağlı)</span>}
                        </div>
                        <div className="text-sm text-gray-600">{req.message}</div>
                      </div>
                    </div>
                    {req.version && (
                      <div className="text-sm text-gray-500">{req.version}</div>
                    )}
                  </div>
                ))}

                <button
                  onClick={checkRequirements}
                  className="w-full mt-4 flex items-center justify-center space-x-2 py-2 text-gray-600 hover:text-gray-900"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Yeniden Kontrol Et</span>
                </button>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-blue-800">
                💡 <strong>Not:</strong> Sarı uyarılar production kurulum için gereklidir.
                Localhost testi için sadece yeşil olan bileşenler yeterlidir.
              </p>
            </div>
          </div>
        );

      case 2:
        // Veritabanı Bağlantısı
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">PostgreSQL Yapılandırması</h2>
              <p className="text-gray-600 mt-2">Veritabanı bağlantı bilgilerini girin</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Host</label>
                <input
                  type="text"
                  value={config.dbHost}
                  onChange={(e) => setConfig({ ...config, dbHost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                  placeholder="localhost"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Port</label>
                <input
                  type="number"
                  value={config.dbPort}
                  onChange={(e) => setConfig({ ...config, dbPort: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                  placeholder="5432"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kullanıcı (Admin)</label>
                <input
                  type="text"
                  value={config.dbUser}
                  onChange={(e) => setConfig({ ...config, dbUser: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                  placeholder="postgres"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Şifre (Admin)</label>
                <input
                  type="password"
                  value={config.dbPassword}
                  onChange={(e) => setConfig({ ...config, dbPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                  placeholder="••••••"
                />
              </div>
            </div>

            <button
              onClick={testDatabase}
              disabled={loading || !config.dbUser || !config.dbPassword}
              className="w-full py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Database className="w-5 h-5" />
                  <span>Bağlantıyı Test Et</span>
                </>
              )}
            </button>

            {dbTestResult && (
              <div
                className={`p-4 rounded-lg border ${
                  dbTestResult.ok
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                <div className="flex items-center space-x-2">
                  {dbTestResult.ok ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  <span className="font-medium">{dbTestResult.message}</span>
                </div>
                {dbTestResult.version && (
                  <div className="text-sm mt-1">PostgreSQL {dbTestResult.version}</div>
                )}
              </div>
            )}
          </div>
        );

      case 3:
        // Redis Yapılandırması
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Redis Yapılandırması</h2>
              <p className="text-gray-600 mt-2">Cache sunucu bilgilerini girin</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Host</label>
                <input
                  type="text"
                  value={config.redisHost}
                  onChange={(e) => setConfig({ ...config, redisHost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                  placeholder="localhost"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Port</label>
                <input
                  type="number"
                  value={config.redisPort}
                  onChange={(e) => setConfig({ ...config, redisPort: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                  placeholder="6379"
                />
              </div>
            </div>

            <button
              onClick={testRedis}
              disabled={loading}
              className="w-full py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Database className="w-5 h-5" />
                  <span>Redis Bağlantısını Test Et</span>
                </>
              )}
            </button>

            {redisTestResult && (
              <div
                className={`p-4 rounded-lg border ${
                  redisTestResult.ok
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                <div className="flex items-center space-x-2">
                  {redisTestResult.ok ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  <span className="font-medium">{redisTestResult.message}</span>
                </div>
                {redisTestResult.version && (
                  <div className="text-sm mt-1">Redis {redisTestResult.version}</div>
                )}
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Not:</strong> Redis bağlantısı başarısız olursa uygulama yine çalışır
                ancak performans düşük olabilir.
              </p>
            </div>
          </div>
        );

      case 4:
        // Site Bilgileri
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Site Bilgileri</h2>
              <p className="text-gray-600 mt-2">Kurulacak sitenin bilgilerini girin</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Domain</label>
                <input
                  type="text"
                  value={config.domain}
                  onChange={(e) => setConfig({ ...config, domain: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                  placeholder="example.com veya test1 (local)"
                />
                {config.domain && isLocalDomain(config.domain) && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">🏠 Local Mode - DNS kontrolü atlanacak</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mağaza Adı</label>
                <input
                  type="text"
                  value={config.storeName}
                  onChange={(e) => setConfig({ ...config, storeName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                  placeholder="Örnek Mağaza"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Veritabanı Adı</label>
                  <input
                    type="text"
                    value={config.dbName}
                    onChange={(e) => setConfig({ ...config, dbName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                    placeholder="qodify_example_com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Otomatik önerilen</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Uygulama DB Kullanıcısı</label>
                  <input
                    type="text"
                    value={config.appDbUser}
                    onChange={(e) => setConfig({ ...config, appDbUser: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                    placeholder="qodify_user"
                  />
                  <p className="text-xs text-gray-500 mt-1">Yeni oluşturulacak</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Uygulama DB Şifresi</label>
                <input
                  type="password"
                  value={config.appDbPassword}
                  onChange={(e) => setConfig({ ...config, appDbPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                  placeholder="••••••"
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Admin Kullanıcısı</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Admin E-posta</label>
                    <input
                      type="email"
                      value={config.adminEmail}
                      onChange={(e) => setConfig({ ...config, adminEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                      placeholder="admin@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Admin Şifresi</label>
                    <input
                      type="password"
                      value={config.adminPassword}
                      onChange={(e) => setConfig({ ...config, adminPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                      placeholder="••••••"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template Versiyonu</label>
                <select
                  value={config.templateVersion}
                  onChange={(e) => setConfig({ ...config, templateVersion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
                >
                  <option value="latest">En Güncel (v2.4.0)</option>
                  <option value="2.3.0">v2.3.0</option>
                  <option value="2.2.0">v2.2.0</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 5:
        // Kurulum Özeti ve Başlatma
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Kurulum Özeti</h2>
              <p className="text-gray-600 mt-2">Kurulum bilgilerini kontrol edin</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Domain</p>
                  <p className="font-medium">{config.domain}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Mağaza Adı</p>
                  <p className="font-medium">{config.storeName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Veritabanı</p>
                  <p className="font-medium">{config.dbName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Admin E-posta</p>
                  <p className="font-medium">{config.adminEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Template</p>
                  <p className="font-medium">v{config.templateVersion === "latest" ? "2.4.0" : config.templateVersion}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Kurulum Modu</p>
                  <p className="font-medium">{isLocalDomain(config.domain) ? "Local" : "Production"}</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Önemli:</strong> Kurulum başlatıldıktan sonra geri alınamaz.
                Tüm bilgilerin doğru olduğundan emin olun.
              </p>
            </div>

            <button
              onClick={startInstallation}
              disabled={installStatus === "running"}
              className="w-full py-3 bg-gradient-to-r from-gray-900 to-slate-800 text-white rounded-lg hover:from-gray-800 hover:to-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {installStatus === "running" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Kurulum Devam Ediyor...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  <span>Kurulumu Başlat</span>
                </>
              )}
            </button>
          </div>
        );

      case 6:
        // Kurulum İlerlemesi ve Tamamlanma
        return (
          <div className="space-y-6">
            {installStatus === "running" && (
              <div className="text-center mb-6">
                <Loader2 className="w-16 h-16 text-gray-600 animate-spin mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900">Kurulum Devam Ediyor</h2>
                <p className="text-gray-600 mt-2">Lütfen bekleyin, bu işlem birkaç dakika sürebilir</p>
              </div>
            )}

            {installStatus === "completed" && (
              <div className="text-center mb-6">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900">Kurulum Tamamlandı!</h2>
                <p className="text-gray-600 mt-2">Siteniz başarıyla kuruldu ve çalışıyor</p>
              </div>
            )}

            {installStatus === "error" && (
              <div className="text-center mb-6">
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900">Kurulum Başarısız</h2>
                <p className="text-gray-600 mt-2">Kurulum sırasında bir hata oluştu</p>
              </div>
            )}

            {/* İlerleme logları */}
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-auto">
              <h3 className="font-medium text-gray-900 mb-2">Kurulum Logları</h3>
              <div className="space-y-1 text-sm">
                {installProgress.map((log, index) => (
                  <div key={index} className="text-gray-700">
                    • {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Tamamlandı bilgileri */}
            {completedInfo && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="font-medium text-gray-900 mb-4">Site Bilgileri</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Store URL</p>
                    <a href={completedInfo.urls.store} target="_blank" rel="noopener noreferrer"
                       className="text-blue-600 hover:underline font-medium">
                      {completedInfo.urls.store}
                    </a>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Admin Panel</p>
                    <a href={completedInfo.urls.admin} target="_blank" rel="noopener noreferrer"
                       className="text-blue-600 hover:underline font-medium">
                      {completedInfo.urls.admin}
                    </a>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">API</p>
                    <a href={completedInfo.urls.api} target="_blank" rel="noopener noreferrer"
                       className="text-blue-600 hover:underline font-medium">
                      {completedInfo.urls.api}
                    </a>
                  </div>
                  <div className="pt-3 border-t">
                    <p className="text-sm text-gray-600">Admin Giriş Bilgileri</p>
                    <p className="font-medium">E-posta: {completedInfo.credentials?.email || config.adminEmail}</p>
                    <p className="font-medium">Şifre: {completedInfo.credentials?.password || "••••••"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return requirements.filter(r => r.required && r.status === "error").length === 0;
      case 2:
        return dbTestResult?.ok === true;
      case 3:
        return true; // Redis isteğe bağlı
      case 4:
        return config.domain && config.storeName && config.dbName && config.adminEmail && config.adminPassword;
      case 5:
        return installStatus !== "running";
      default:
        return true;
    }
  };

  const stepTitles = [
    "Sistem Kontrolü",
    "Veritabanı",
    "Redis",
    "Site Bilgileri",
    "Özet",
    "Kurulum"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Adım göstergesi */}
          <div className="border-b border-gray-100 p-6">
            <div className="flex items-center justify-between">
              {stepTitles.map((title, index) => (
                <div key={index} className="flex items-center">
                  <div className={`flex items-center ${
                    currentStep > index + 1 ? "text-green-600" :
                    currentStep === index + 1 ? "text-gray-900" : "text-gray-400"
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                      currentStep > index + 1 ? "bg-green-600 border-green-600 text-white" :
                      currentStep === index + 1 ? "border-gray-900 text-gray-900" :
                      "border-gray-300 text-gray-400"
                    }`}>
                      {currentStep > index + 1 ? "✓" : index + 1}
                    </div>
                    <span className="ml-2 text-sm font-medium hidden md:block">{title}</span>
                  </div>
                  {index < stepTitles.length - 1 && (
                    <div className={`w-8 md:w-16 h-0.5 mx-2 ${
                      currentStep > index + 1 ? "bg-green-600" : "bg-gray-300"
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* İçerik */}
          <div className="p-6">
            {renderStep()}
          </div>

          {/* Navigasyon butonları */}
          {installStatus !== "completed" && (
            <div className="border-t border-gray-100 px-6 py-4 flex justify-between">
              <button
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1 || installStatus === "running"}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Önceki</span>
              </button>

              {currentStep < 6 && (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={!canProceed()}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-gray-900 to-slate-800 text-white rounded-lg hover:from-gray-800 hover:to-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Sonraki</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}