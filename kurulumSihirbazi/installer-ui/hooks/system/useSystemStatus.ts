import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

export interface SystemStatus {
  postgres: string;
  redis: string;
  nginx: string;
  pm2: string;
}

export function useSystemStatus(autoRefresh: boolean = true) {
  const [status, setStatus] = useState<SystemStatus>({
    postgres: "checking",
    redis: "checking",
    nginx: "checking",
    pm2: "checking",
  });
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const response = await apiFetch("/api/system/status");
      if (!response.ok) return;
      const data = await response.json();
      if (data && typeof data === "object") {
        setStatus(data);
      }
    } catch (error) {
      console.error("System status check failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    if (autoRefresh) {
      const interval = setInterval(checkStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  return {
    status,
    loading,
    refreshStatus: checkStatus,
  };
}