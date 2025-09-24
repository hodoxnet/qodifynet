"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { RefreshCw, Save, AlertCircle, Server, Monitor, ShoppingBag } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"backend" | "admin" | "store">("backend");

  useEffect(() => {
    fetchEnvConfig();
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

  const getServiceIcon = (service: string) => {
    switch (service) {
      case "backend":
        return <Server className="w-4 h-4" />;
      case "admin":
        return <Monitor className="w-4 h-4" />;
      case "store":
        return <ShoppingBag className="w-4 h-4" />;
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
            {["backend", "admin", "store"].map((service) => (
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
                  {service === "backend" ? "Backend" : service === "admin" ? "Admin Panel" : "Store"}
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
        </div>
      </div>
    </div>
  );
}