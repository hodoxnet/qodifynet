"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { RefreshCw, Save, AlertCircle, Server, Monitor, ShoppingBag, UserPlus, Users, Database, Terminal } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface EnvConfig {
  [key: string]: string | undefined;
}

interface CustomerEnvConfig {
  customerId: string;
  domain: string;
  ports: {
    backend: number;
    admin: number;
    store: number;
  };
  config: {
    backend?: EnvConfig;
    admin?: EnvConfig;
    store?: EnvConfig;
  };
}

export default function CustomerConfigPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [envConfig, setEnvConfig] = useState<CustomerEnvConfig | null>(null);
  const [modifiedValues, setModifiedValues] = useState<Record<string, Record<string, string>>>({});
  const [activeTab, setActiveTab] = useState<"backend" | "admin" | "store" | "admins" | "database">("backend");
  const [admins, setAdmins] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: "", password: "", name: "" });
  const [dbOperations, setDbOperations] = useState({ generating: false, pushing: false, migrating: false });
  const [dbOutput, setDbOutput] = useState<{ generate?: string; push?: string; migrate?: string }>({});

  useEffect(() => {
    fetchEnvConfig();
    fetchAdmins();
  }, [customerId]);

  const fetchEnvConfig = async () => {
    try {
      const res = await apiFetch(`/api/customers/${customerId}/env-config`);
      if (!res.ok) throw new Error("Failed to fetch configuration");
      const data = await res.json();
      setEnvConfig(data);
    } catch (error) {
      toast.error("Konfigürasyon yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (service: string, key: string, value: string) => {
    setModifiedValues(prev => ({
      ...prev,
      [service]: {
        ...prev[service],
        [key]: value,
      }
    }));
  };

  const saveChanges = async () => {
    if (Object.keys(modifiedValues).length === 0) {
      toast.info("Kaydedilecek değişiklik yok");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(`/api/customers/${customerId}/env-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modifiedValues),
      });

      if (!res.ok) throw new Error("Failed to save configuration");

      const result = await res.json();
      toast.success(result.message || "Konfigürasyon kaydedildi");

      // Clear modified values
      setModifiedValues({});
      // Refetch config
      await fetchEnvConfig();
    } catch (error) {
      toast.error("Konfigürasyon kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const restartService = async (service?: string) => {
    const serviceName = service || "all";
    setRestarting(serviceName);

    try {
      const res = await apiFetch(`/api/customers/${customerId}/restart-service`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      });

      if (!res.ok) throw new Error("Failed to restart service");

      const result = await res.json();
      toast.success(result.message || `${serviceName} servisi yeniden başlatıldı`);
    } catch (error) {
      toast.error(`${serviceName} servisi yeniden başlatılamadı`);
    } finally {
      setRestarting(null);
    }
  };

  const fetchAdmins = async () => {
    try {
      setLoadingAdmins(true);
      const res = await apiFetch(`/api/customers/${customerId}/admins`);
      if (!res.ok) throw new Error("Failed to fetch admins");
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch (error) {
      console.error("Failed to fetch admins:", error);
      setAdmins([]);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const createAdmin = async () => {
    if (!newAdmin.email || !newAdmin.password) {
      toast.error("Email ve şifre zorunludur");
      return;
    }

    try {
      setCreatingAdmin(true);
      const res = await apiFetch(`/api/customers/${customerId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAdmin),
      });

      if (!res.ok) throw new Error("Failed to create admin");

      const result = await res.json();
      if (result.success) {
        toast.success("Admin kullanıcısı başarıyla oluşturuldu");
        setNewAdmin({ email: "", password: "", name: "" });
        fetchAdmins();
      } else {
        toast.error(result.message || "Admin oluşturulamadı");
      }
    } catch (error) {
      toast.error("Admin oluşturulamadı");
    } finally {
      setCreatingAdmin(false);
    }
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case "backend":
        return <Server className="w-4 h-4" />;
      case "admin":
        return <Monitor className="w-4 h-4" />;
      case "store":
        return <ShoppingBag className="w-4 h-4" />;
      case "admins":
        return <Users className="w-4 h-4" />;
      case "database":
        return <Database className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const renderEnvField = (service: string, key: string, value: string | undefined) => {
    const currentValue = modifiedValues[service]?.[key] ?? value ?? "";
    const isModified = modifiedValues[service]?.[key] !== undefined;
    const isSecret = key.includes("SECRET") || key.includes("PASSWORD") || key === "DATABASE_URL";

    // Critical fields that need attention
    const isCritical = [
      "NEXT_PUBLIC_API_BASE_URL",
      "NEXT_PUBLIC_API_URL",
      "NEXT_PUBLIC_BACKEND_PORT",
      "PORT",
      "APP_URL",
      "STORE_URL",
      "ADMIN_URL"
    ].includes(key);

    return (
      <div key={`${service}-${key}`} className="mb-4">
        <label
          htmlFor={`${service}-${key}`}
          className={`block text-sm font-medium mb-1 ${isCritical ? "text-blue-600" : "text-gray-700"} ${isModified ? "text-green-600" : ""}`}
        >
          {key} {isCritical && <span className="text-xs text-blue-500">(Kritik)</span>}
        </label>
        <input
          id={`${service}-${key}`}
          type={isSecret ? "password" : "text"}
          value={currentValue}
          onChange={(e) => handleValueChange(service, key, e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isModified ? "border-green-500 bg-green-50" : "border-gray-300"
          }`}
          placeholder={value || "Ayarlanmamış"}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600">Konfigürasyon yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!envConfig) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-gray-600">Konfigürasyon yüklenemedi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Environment Konfigürasyonu</h1>
          <p className="text-sm text-gray-600 mt-1">
            Domain: <span className="font-mono">{envConfig.domain}</span> |
            Backend Port: <span className="font-mono">{envConfig.ports.backend}</span> |
            Admin Port: <span className="font-mono">{envConfig.ports.admin}</span> |
            Store Port: <span className="font-mono">{envConfig.ports.store}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => saveChanges()}
            disabled={saving || Object.keys(modifiedValues).length === 0}
            className={`px-4 py-2 rounded-lg text-white flex items-center gap-2 ${
              saving || Object.keys(modifiedValues).length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            <Save className="h-4 w-4" />
            {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
          </button>
          <button
            onClick={() => restartService()}
            disabled={restarting !== null}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${restarting === "all" ? "animate-spin" : ""}`} />
            Tümünü Yeniden Başlat
          </button>
          <button
            onClick={() => router.push("/customers")}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Geri
          </button>
        </div>
      </div>

      {/* Warning Message */}
      {Object.keys(modifiedValues).length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-800 font-medium">Kaydedilmemiş değişiklikler var</p>
            <p className="text-xs text-yellow-700 mt-1">
              Değişiklikleri uygulamak için "Değişiklikleri Kaydet" butonuna tıklayın.
            </p>
          </div>
        </div>
      )}

      {/* Configuration Panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            {["backend", "admin", "store", "admins", "database"].map((service) => (
              <button
                key={service}
                onClick={() => setActiveTab(service as any)}
                className={`px-6 py-3 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === service
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {getServiceIcon(service)}
                <span className="capitalize">
                  {service === "backend" ? "Backend" : service === "admin" ? "Admin Panel" : service === "store" ? "Store" : service === "admins" ? "Yöneticiler" : "Veritabanı"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {["backend", "admin", "store"].map(service => (
            <div key={service} className={activeTab === service ? "block" : "hidden"}>
              <div className="mb-6 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  {getServiceIcon(service)}
                  {service.charAt(0).toUpperCase() + service.slice(1)} Konfigürasyonu
                </h3>
                <button
                  onClick={() => restartService(service)}
                  disabled={restarting !== null}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <RefreshCw className={`h-3 w-3 ${restarting === service ? "animate-spin" : ""}`} />
                  {service} servisini yeniden başlat
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                {envConfig.config[service as keyof typeof envConfig.config] &&
                  Object.entries(envConfig.config[service as keyof typeof envConfig.config] || {})
                    .filter(([_, value]) => value !== undefined)
                    .map(([key, value]) => renderEnvField(service, key, value))
                }
              </div>

              {!envConfig.config[service as keyof typeof envConfig.config] && (
                <p className="text-gray-500 text-sm">Bu servis için konfigürasyon bulunamadı.</p>
              )}
            </div>
          ))}

          {/* Admins Tab */}
          <div className={activeTab === "admins" ? "block" : "hidden"}>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Users className="h-5 w-5" />
                Yönetici Kullanıcıları
              </h3>

              {/* Create Admin Form */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Yeni Yönetici Ekle</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={newAdmin.email}
                      onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="admin@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Şifre *</label>
                    <input
                      type="password"
                      value={newAdmin.password}
                      onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">İsim</label>
                    <input
                      type="text"
                      value={newAdmin.name}
                      onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Admin User"
                    />
                  </div>
                </div>
                <button
                  onClick={createAdmin}
                  disabled={creatingAdmin || !newAdmin.email || !newAdmin.password}
                  className={`mt-4 px-4 py-2 rounded-lg text-white flex items-center gap-2 ${
                    creatingAdmin || !newAdmin.email || !newAdmin.password
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  <UserPlus className="h-4 w-4" />
                  {creatingAdmin ? "Oluşturuluyor..." : "Yönetici Ekle"}
                </button>
              </div>

              {/* Admins List */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İsim</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Oluşturulma</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loadingAdmins ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Yöneticiler yükleniyor...
                        </td>
                      </tr>
                    ) : admins.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                          <p>Henüz yönetici kullanıcı bulunmuyor.</p>
                          <p className="text-sm mt-1">Yukarıdaki formu kullanarak yeni bir yönetici ekleyin.</p>
                        </td>
                      </tr>
                    ) : (
                      admins.map((admin) => (
                        <tr key={admin.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{admin.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{admin.name || "-"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              admin.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                              {admin.isActive ? "Aktif" : "Pasif"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString("tr-TR") : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Database Tab */}
          <div className={activeTab === "database" ? "block" : "hidden"}>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Database className="h-5 w-5" />
                Veritabanı İşlemleri
              </h3>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800 font-medium">Dikkat</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Bu işlemler veritabanı şemasını günceller. İşlem sırasında backend servisi yeniden başlatılabilir.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Prisma Generate */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Prisma Client Oluştur</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">npx prisma generate</code> - Prisma Client'ı yeniden oluşturur
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        setDbOperations({ ...dbOperations, generating: true });
                        try {
                          const res = await apiFetch(`/api/customers/${customerId}/database/generate`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                          });
                          const result = await res.json();
                          if (result.success) {
                            toast.success(result.message);
                            setDbOutput({ ...dbOutput, generate: result.output });
                          } else {
                            toast.error(result.message);
                          }
                        } catch (error) {
                          toast.error("Prisma generate başarısız oldu");
                        } finally {
                          setDbOperations({ ...dbOperations, generating: false });
                        }
                      }}
                      disabled={dbOperations.generating}
                      className={`px-4 py-2 rounded-lg text-white flex items-center gap-2 ${
                        dbOperations.generating
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      <Terminal className="h-4 w-4" />
                      {dbOperations.generating ? "Çalışıyor..." : "Çalıştır"}
                    </button>
                  </div>
                  {dbOutput.generate && (
                    <pre className="mt-3 p-3 bg-gray-900 text-gray-100 rounded text-xs font-mono overflow-x-auto">
                      {dbOutput.generate}
                    </pre>
                  )}
                </div>

                {/* Prisma DB Push */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Veritabanı Şemasını Güncelle</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">npx prisma db push</code> - Schema değişikliklerini veritabanına uygular
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        setDbOperations({ ...dbOperations, pushing: true });
                        try {
                          const res = await apiFetch(`/api/customers/${customerId}/database/push`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                          });
                          const result = await res.json();
                          if (result.success) {
                            toast.success(result.message);
                            setDbOutput({ ...dbOutput, push: result.output });
                          } else {
                            toast.error(result.message);
                          }
                        } catch (error) {
                          toast.error("Prisma db push başarısız oldu");
                        } finally {
                          setDbOperations({ ...dbOperations, pushing: false });
                        }
                      }}
                      disabled={dbOperations.pushing}
                      className={`px-4 py-2 rounded-lg text-white flex items-center gap-2 ${
                        dbOperations.pushing
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      <Database className="h-4 w-4" />
                      {dbOperations.pushing ? "Güncelleniyor..." : "Güncelle"}
                    </button>
                  </div>
                  {dbOutput.push && (
                    <pre className="mt-3 p-3 bg-gray-900 text-gray-100 rounded text-xs font-mono overflow-x-auto">
                      {dbOutput.push}
                    </pre>
                  )}
                </div>

                {/* Prisma Migrate */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Migration'ları Uygula (Production)</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">npx prisma migrate deploy</code> - Production migration'larını uygular
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        setDbOperations({ ...dbOperations, migrating: true });
                        try {
                          const res = await apiFetch(`/api/customers/${customerId}/database/migrate`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                          });
                          const result = await res.json();
                          if (result.success) {
                            toast.success(result.message);
                            setDbOutput({ ...dbOutput, migrate: result.output });
                          } else {
                            toast.error(result.message);
                          }
                        } catch (error) {
                          toast.error("Prisma migrate başarısız oldu");
                        } finally {
                          setDbOperations({ ...dbOperations, migrating: false });
                        }
                      }}
                      disabled={dbOperations.migrating}
                      className={`px-4 py-2 rounded-lg text-white flex items-center gap-2 ${
                        dbOperations.migrating
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-purple-600 hover:bg-purple-700"
                      }`}
                    >
                      <Database className="h-4 w-4" />
                      {dbOperations.migrating ? "Uygulanıyor..." : "Migration Uygula"}
                    </button>
                  </div>
                  {dbOutput.migrate && (
                    <pre className="mt-3 p-3 bg-gray-900 text-gray-100 rounded text-xs font-mono overflow-x-auto">
                      {dbOutput.migrate}
                    </pre>
                  )}
                </div>

                {/* Recommended Steps */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Önerilen Adımlar</h4>
                  <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                    <li>Önce "Prisma Client Oluştur" komutunu çalıştırın</li>
                    <li>Sonra "Veritabanı Şemasını Güncelle" ile şema değişikliklerini uygulayın</li>
                    <li>İşlemler tamamlandıktan sonra backend servisini yeniden başlatın</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}