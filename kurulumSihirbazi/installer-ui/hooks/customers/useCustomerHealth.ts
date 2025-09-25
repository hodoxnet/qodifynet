"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { apiFetch as fetcher } from "@/lib/api";

export interface HealthStatus {
  backend?: {
    status: "healthy" | "stopped" | "error";
    httpCode?: number;
    error?: string;
  };
  admin?: {
    status: "healthy" | "stopped" | "error";
    httpCode?: number;
    error?: string;
  };
  store?: {
    status: "healthy" | "stopped" | "error";
    httpCode?: number;
    error?: string;
  };
}

interface UseCustomerHealthProps {
  customerId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useCustomerHealth({
  customerId,
  autoRefresh = false,
  refreshInterval = 5000
}: UseCustomerHealthProps = {}) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async (id?: string) => {
    const targetId = id || customerId;
    if (!targetId) return null;

    setLoading(true);
    try {
      const response = await fetcher(`/api/customers/${targetId}/health`);
      if (!response.ok) {
        throw new Error("Health check başarısız");
      }

      const data = await response.json();
      setHealth(data);
      setLastChecked(new Date());
      return data;
    } catch (error) {
      console.error("Health check error:", error);
      toast.error("Servis sağlığı kontrol edilemedi");
      return null;
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (!autoRefresh || !customerId) return;

    const interval = setInterval(() => {
      checkHealth();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, customerId, refreshInterval, checkHealth]);

  const reset = useCallback(() => {
    setHealth(null);
    setLastChecked(null);
  }, []);

  return {
    health,
    loading,
    lastChecked,
    checkHealth,
    reset
  };
}