"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export interface EnvConfig {
  [key: string]: string | undefined;
}

export interface CustomerEnvConfig {
  customerId: string;
  domain: string;
  buildHeapMB?: number;
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

export function useCustomerConfig(customerId: string) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [envConfig, setEnvConfig] = useState<CustomerEnvConfig | null>(null);
  const [modifiedValues, setModifiedValues] = useState<Record<string, Record<string, string>>>({});
  const [restarting, setRestarting] = useState<string | null>(null);

  const fetchEnvConfig = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/customers/${customerId}/env-config`);
      if (!res.ok) throw new Error("Failed to fetch configuration");
      const data = await res.json();
      setEnvConfig(data);
    } catch (error) {
      toast.error("Konfigürasyon yüklenemedi");
      console.error("Config fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchEnvConfig();
  }, [fetchEnvConfig]);

  const handleValueChange = useCallback((service: string, key: string, value: string) => {
    setModifiedValues((prev) => ({
      ...prev,
      [service]: {
        ...prev[service],
        [key]: value,
      },
    }));
  }, []);

  const saveChanges = useCallback(async () => {
    if (Object.keys(modifiedValues).length === 0) {
      toast.info("Kaydedilecek değişiklik yok");
      return false;
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
      return true;
    } catch (error) {
      toast.error("Konfigürasyon kaydedilemedi");
      console.error("Save config error:", error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [modifiedValues, customerId, fetchEnvConfig]);

  const restartService = useCallback(async (service?: string) => {
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
      return true;
    } catch (error) {
      toast.error(`${serviceName} servisi yeniden başlatılamadı`);
      console.error("Restart service error:", error);
      return false;
    } finally {
      setRestarting(null);
    }
  }, [customerId]);

  const clearModifications = useCallback(() => {
    setModifiedValues({});
  }, []);

  return {
    loading,
    saving,
    envConfig,
    modifiedValues,
    restarting,
    handleValueChange,
    saveChanges,
    restartService,
    clearModifications,
    hasModifications: Object.keys(modifiedValues).length > 0,
  };
}