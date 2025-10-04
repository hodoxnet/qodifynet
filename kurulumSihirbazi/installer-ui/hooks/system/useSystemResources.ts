import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

export interface SystemResources {
  cpu: {
    model: string;
    cores: number;
    usage: number;
  };
  memory: {
    total: number;
    totalGB: number;
    used: number;
    usedGB: number;
    usedPercent: number;
  };
  disk: {
    total: number;
    totalGB: number;
    used: number;
    usedGB: number;
    usedPercent: number;
  };
  network: Array<{
    iface: string;
    ip: string;
  }>;
}

export function useSystemResources(autoRefresh: boolean = true, enabled: boolean = true) {
  const [resources, setResources] = useState<SystemResources | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchResources = async () => {
    try {
      setLoading(true);
      if (!enabled) return;
      const response = await apiFetch("/api/system/resources");
      if (!response.ok) return;
      const data = await response.json();
      setResources(data);
    } catch (error) {
      console.error("System resources fetch failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    fetchResources();

    if (enabled && autoRefresh) {
      const interval = setInterval(fetchResources, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, enabled]);

  return {
    resources,
    loading,
    refreshResources: fetchResources,
  };
}
