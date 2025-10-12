import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export interface SystemConfig {
  db?: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
  };
  redis?: {
    host?: string;
    port?: number;
    prefix?: string;
    password?: string;
  };
  paths?: {
    templates?: string;
    customers?: string;
  };
}

export function useSystemConfig() {
  const [config, setConfig] = useState<SystemConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingDb, setTestingDb] = useState(false);
  const [testingRedis, setTestingRedis] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await apiFetch("/api/system/settings");
      if (!response.ok) return;
      const data = await response.json();
      setConfig(data || {});
    } catch (error) {
      console.error("Failed to fetch config:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const response = await apiFetch("/api/system/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Ayarlar kaydedilemedi");

      const data = await response.json();
      setConfig(data);
      toast.success("Ayarlar kaydedildi");
    } catch (error: any) {
      toast.error(error?.message || "Kayıt sırasında hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const testDatabase = async () => {
    setTestingDb(true);
    try {
      const response = await apiFetch("/api/system/test/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config.db || {}),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success("PostgreSQL bağlantısı başarılı");
      } else {
        toast.error(data?.message || "PostgreSQL bağlantı hatası");
      }
    } catch (error: any) {
      toast.error(error?.message || "PostgreSQL test hatası");
    } finally {
      setTestingDb(false);
    }
  };

  const testRedis = async () => {
    setTestingRedis(true);
    try {
      const response = await apiFetch("/api/system/test/redis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config.redis || {}),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success("Redis bağlantısı başarılı");
      } else {
        toast.error(data?.message || "Redis bağlantı hatası");
      }
    } catch (error: any) {
      toast.error(error?.message || "Redis test hatası");
    } finally {
      setTestingRedis(false);
    }
  };

  const updateConfig = (updates: Partial<SystemConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  return {
    config,
    loading,
    saving,
    testingDb,
    testingRedis,
    updateConfig,
    saveConfig,
    testDatabase,
    testRedis,
    refreshConfig: fetchConfig,
  };
}
