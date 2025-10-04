"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Globe, Database, Rocket, Settings } from "lucide-react";
import { toast } from "sonner";
import { io as socketIO } from "socket.io-client";
import { apiFetch } from "@/lib/api";

const deploymentSchema = z.object({
  domain: z.string().min(1, "Domain gerekli").refine((val) => {
    // Allow local domains (without dot) or regular domains
    const isLocal = !val.includes('.') || val.endsWith('.local') || val === 'localhost';
    const isRegularDomain = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(val);
    return isLocal || isRegularDomain;
  }, "Geçerli bir domain girin (örn: example.com veya test1)"),
  storeName: z.string().min(2, "Mağaza adı en az 2 karakter olmalı"),
  adminEmail: z.string().email("Geçerli bir e-posta adresi girin"),
  adminPassword: z.string().min(6, "Şifre en az 6 karakter olmalı"),
  dbPrefix: z.string().optional(),
  templateVersion: z.string(),
  initialData: z.enum(["empty", "demo", "import"]),
});

type DeploymentFormData = z.infer<typeof deploymentSchema>;

interface DeploymentWizardProps {
  onBack: () => void;
  onComplete: () => void;
}

export function DeploymentWizard({ onBack, onComplete }: DeploymentWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [deploying, setDeploying] = useState(false);
  const [dnsChecking, setDnsChecking] = useState(false);
  const [dnsValid, setDnsValid] = useState<boolean | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<string>("");
  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<DeploymentFormData>({
    resolver: zodResolver(deploymentSchema),
    defaultValues: {
      templateVersion: "latest",
      initialData: "demo",
      // advanced defaults
      dbPrefix: undefined,
    },
  });

  const domain = watch("domain");
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [defaultDb, setDefaultDb] = useState<{ host?: string; port?: number; user?: string; password?: string }>({});
  const [defaultRedis, setDefaultRedis] = useState<{ host?: string; port?: number; prefix?: string }>({});

  useEffect(() => {
    // Prefill advanced inputs with saved defaults
    (async () => {
      try {
        const res = await apiFetch("/api/system/settings");
        const json = await res.json();
        setDefaultDb(json?.db || {});
        setDefaultRedis(json?.redis || {});
      } catch {}
      setDefaultsLoaded(true);
    })();
  }, []);

  const isLocalDomain = (domain: string) => {
    return domain.endsWith('.local') ||
           domain === 'localhost' ||
           !domain.includes('.') ||
           domain.startsWith('test') ||
           domain.startsWith('local');
  };

  const checkDNS = async () => {
    if (!domain) return;

    // Check if this is a local domain
    if (isLocalDomain(domain)) {
      setDnsValid(true);
      toast.success("Local mode - DNS kontrolü atlandı!");
      return;
    }

    setDnsChecking(true);
    try {
      const response = await apiFetch("/api/dns/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const data = await response.json();
      setDnsValid(data.valid);

      if (!data.valid) {
        toast.error("Domain sunucumuza yönlendirilmemiş. Lütfen DNS ayarlarınızı kontrol edin.");
      } else {
        toast.success("Domain doğrulandı!");
      }
    } catch (error) {
      toast.error("DNS kontrolü sırasında hata oluştu");
      console.error(error);
    } finally {
      setDnsChecking(false);
    }
  };

  const onSubmit = async (data: DeploymentFormData) => {
    if (!dnsValid) {
      toast.error("Lütfen önce domain doğrulamasını yapın");
      return;
    }

    setDeploying(true);

    try {
      // Subscribe to deployment progress via Socket.IO
      const socket = socketIO("http://localhost:3031", { transports: ["websocket"] });
      socket.on("connect", () => {
        socket.emit("subscribe-deployment", data.domain);
      });
      socket.on("deployment-progress", (p: { step: string; message: string; ts: number }) => {
        setDeploymentStatus(p.message);
        setProgressLogs(prev => [...prev, p.message]);
      });

      // New step-by-step setup flow
      const call = async (path: string, body?: any) => {
        const res = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        if (res.status === 402) { const msg = await res.json().catch(() => ({})); throw new Error(msg?.message || 'Kredi yetersiz (402)'); }
        if (res.status === 429) throw new Error('Çok fazla istek (429)');
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.message || 'İşlem başarısız'); }
        return res.json().catch(() => ({}));
      };

      // 1) Template check (bilgi amaçlı)
      await call('/api/templates/check', { version: data.templateVersion });
      setProgressLogs(prev => [...prev, 'Templates kontrol edildi']);

      // 2) Extract templates
      await call('/api/setup/extract-templates', { domain: data.domain, version: data.templateVersion });
      setProgressLogs(prev => [...prev, 'Templates çıkarıldı']);

      // 3) Configure environment (ports otomatik atanır)
      const dbHost = (document.getElementById("dbHost") as HTMLInputElement)?.value || undefined;
      const dbPort = Number((document.getElementById("dbPort") as HTMLInputElement)?.value) || undefined;
      const dbUser = (document.getElementById("dbUser") as HTMLInputElement)?.value || undefined;
      const dbPassword = (document.getElementById("dbPassword") as HTMLInputElement)?.value || undefined;
      const dbName = (document.getElementById("dbName") as HTMLInputElement)?.value || undefined;
      const redisHost = (document.getElementById("redisHost") as HTMLInputElement)?.value || undefined;
      const redisPort = Number((document.getElementById("redisPort") as HTMLInputElement)?.value) || undefined;
      const storeName = (document.getElementById("storeName") as HTMLInputElement)?.value || data.storeName;
      await call('/api/setup/configure-environment', { domain: data.domain, dbName, dbUser, dbPassword, dbHost, dbPort, redisHost, redisPort, storeName });
      setProgressLogs(prev => [...prev, 'Ortam yapılandırıldı']);

      // 4) Install dependencies
      await call('/api/setup/install-dependencies', { domain: data.domain });
      setProgressLogs(prev => [...prev, 'Bağımlılıklar yüklendi']);

      // 5) Run migrations
      await call('/api/setup/run-migrations', { domain: data.domain });
      setProgressLogs(prev => [...prev, 'Migration\'lar uygulandı']);

      // 6) Build applications
      await call('/api/setup/build-applications', { domain: data.domain });
      setProgressLogs(prev => [...prev, 'Uygulamalar derlendi']);

      // 7) Finalize
      const finalizeRes = await call('/api/setup/finalize', { domain: data.domain, ports: {}, dbName, dbUser, dbHost, dbPort, redisHost, redisPort, storeName, isLocal: isLocalDomain(data.domain) });
      toast.success('Kurulum başarıyla tamamlandı!');
      const result = finalizeRes || {};
      if (result?.urls) {
        toast.info(`Store: ${result.urls.store}`, { duration: 10000 });
        toast.info(`Admin: ${result.urls.admin}`, { duration: 10000 });
      }
      setTimeout(onComplete, 3000);
    } catch (error: any) {
      const msg: string = String(error?.message || 'Kurulum sırasında hata oluştu');
      if (msg.includes('Kredi') || msg.includes('(402)')) toast.error('Kredi yetersiz. Lütfen bakiyenizi kontrol edin.');
      else if (msg.includes('(429)')) toast.error('Çok fazla istek. Lütfen bir süre sonra tekrar deneyin.');
      else toast.error(msg);
      console.error(error);
    } finally {
      setDeploying(false);
    }
  };

  const steps = [
    { id: 1, title: "Domain Ayarları", icon: Globe },
    { id: 2, title: "Yapılandırma", icon: Settings },
    { id: 3, title: "Veritabanı", icon: Database },
    { id: 4, title: "Kurulum", icon: Rocket },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Geri Dön</span>
        </button>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900">Yeni Müşteri Kurulumu</h1>
            <div className="mt-4 flex items-center space-x-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center space-x-2 ${
                      currentStep >= step.id ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        currentStep >= step.id
                          ? "bg-gradient-to-r from-gray-900 to-slate-800 text-white"
                          : "bg-gray-200"
                      }`}
                    >
                      <step.icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">{step.title}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`ml-4 w-16 h-0.5 ${
                        currentStep > step.id ? "bg-gray-900" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6">
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Domain
                  </label>
                  <div className="flex space-x-2">
                    <input
                      {...register("domain")}
                      type="text"
                      placeholder="example.com veya test1 (local)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={checkDNS}
                      disabled={!domain || dnsChecking}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {dnsChecking ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        "DNS Kontrol"
                      )}
                    </button>
                  </div>
                  {errors.domain && (
                    <p className="mt-1 text-sm text-red-600">{errors.domain.message}</p>
                  )}
                  {dnsValid === true && !isLocalDomain(domain) && (
                    <p className="mt-1 text-sm text-green-600">✓ Domain doğrulandı</p>
                  )}
                  {dnsValid === true && isLocalDomain(domain) && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">🏠 Local Mode Aktif</p>
                      <p className="text-xs text-blue-600 mt-1">
                        Kurulum port bazlı olarak yapılacak. DNS ve Nginx gerektirmez.
                      </p>
                    </div>
                  )}
                  {dnsValid === false && (
                    <p className="mt-1 text-sm text-red-600">✗ Domain sunucumuza yönlendirilmemiş</p>
                  )}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mağaza Adı
                  </label>
                  <input
                    {...register("storeName")}
                    type="text"
                    placeholder="Örnek Mağaza"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  {errors.storeName && (
                    <p className="mt-1 text-sm text-red-600">{errors.storeName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin E-posta
                  </label>
                  <input
                    {...register("adminEmail")}
                    type="email"
                    placeholder="admin@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  {errors.adminEmail && (
                    <p className="mt-1 text-sm text-red-600">{errors.adminEmail.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Şifresi
                  </label>
                  <input
                    {...register("adminPassword")}
                    type="password"
                    placeholder="••••••"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  {errors.adminPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.adminPassword.message}</p>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlangıç Verisi
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        {...register("initialData")}
                        type="radio"
                        value="empty"
                        className="text-gray-900 focus:ring-gray-900"
                      />
                      <span>Boş (Sadece yapı)</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        {...register("initialData")}
                        type="radio"
                        value="demo"
                        className="text-gray-900 focus:ring-gray-900"
                      />
                      <span>Demo Veriler</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        {...register("initialData")}
                        type="radio"
                        value="import"
                        className="text-gray-900 focus:ring-gray-900"
                      />
                      <span>Veri İçe Aktar</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Versiyonu
                  </label>
                  <select
                    {...register("templateVersion")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    <option value="latest">En Güncel (v2.4.0)</option>
                    <option value="2.3.0">v2.3.0 (Stable)</option>
                    <option value="2.2.0">v2.2.0</option>
                  </select>
                </div>

                {/* Advanced DB/Redis */}
                <div className="pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm text-gray-700 hover:text-gray-900"
                  >
                    {showAdvanced ? "Gelişmiş ayarları gizle" : "Gelişmiş (DB/Redis) ayarları göster"}
                  </button>
                  {showAdvanced && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">PostgreSQL</h4>
                        <div className="space-y-2">
                          <input id="dbHost" placeholder="DB Host (varsayılan: localhost)" defaultValue={defaultDb.host || ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                          <input id="dbPort" placeholder="DB Port (varsayılan: 5432)" defaultValue={defaultDb.port ?? ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                          <input id="dbUser" placeholder="DB Kullanıcı (admin, varsayılan: postgres)" defaultValue={defaultDb.user || ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                          <input id="dbPassword" placeholder="DB Şifre (admin)" defaultValue={defaultDb.password || ""} type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                        </div>
                        <div className="mt-4 space-y-2">
                          <h5 className="text-sm font-medium text-gray-900">Uygulama Veritabanı</h5>
                          <input id="dbName" placeholder="Veritabanı Adı (örn. hodox_example_com)" defaultValue={`hodox_${(domain || "").replace(/[^a-zA-Z0-9_]/g, "_")}`} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                          <input id="dbAppUser" placeholder="Uygulama DB Kullanıcısı (örn. hodox_user)" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                          <input id="dbAppPassword" placeholder="Uygulama DB Şifresi" type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                          <p className="text-xs text-gray-500">Bu kullanıcı veritabanına erişecek uygulama kullanıcısıdır. Girilmezse varsayılan olarak hodox_user/hodox_pass kullanılır.</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Redis</h4>
                        <div className="space-y-2">
                          <input id="redisHost" placeholder="Redis Host (varsayılan: localhost)" defaultValue={defaultRedis.host || ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                          <input id="redisPort" placeholder="Redis Port (varsayılan: 6379)" defaultValue={defaultRedis.port ?? ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                          <input id="redisPrefix" placeholder="Redis Prefix (varsayılan: domain)" defaultValue={defaultRedis.prefix || ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                {!deploying ? (
                  <div className="text-center py-8">
                    <Rocket className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Kurulum Hazır
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {domain} için kurulum başlatılacak.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Loader2 className="w-12 h-12 text-gray-600 animate-spin mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Kurulum Devam Ediyor...
                    </h3>
                    <p className="text-gray-600 mb-4">{deploymentStatus || "Müşteri ortamı hazırlanıyor..."}</p>
                    <div className="max-h-48 overflow-auto text-left text-sm bg-gray-50 border border-gray-200 rounded-lg p-3">
                      {progressLogs.map((l, i) => (
                        <div key={i} className="text-gray-700">• {l}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1 || deploying}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Önceki</span>
              </button>

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 1 && !dnsValid) {
                      toast.error("Lütfen önce domain doğrulamasını yapın");
                      return;
                    }
                    setCurrentStep(currentStep + 1);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-gray-900 to-slate-800 text-white rounded-lg hover:from-gray-800 hover:to-slate-700"
                >
                  <span>Sonraki</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={deploying}
                  className="px-6 py-2 bg-gradient-to-r from-gray-900 to-slate-800 text-white rounded-lg hover:from-gray-800 hover:to-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deploying ? "Kuruluyor..." : "Kurulumu Başlat"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
