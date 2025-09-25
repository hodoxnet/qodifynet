"use client";

import { useState, useCallback, useEffect } from "react";
import { apiFetch as fetcher } from "@/lib/api";

export type ServiceType = "backend" | "admin" | "store";

interface UseCustomerLogsProps {
  customerId?: string;
  service?: ServiceType;
  lines?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useCustomerLogs({
  customerId,
  service = "backend",
  lines = 100,
  autoRefresh = false,
  refreshInterval = 3000
}: UseCustomerLogsProps = {}) {
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (
    id?: string,
    svc?: ServiceType,
    lineCount?: number
  ) => {
    const targetId = id || customerId;
    const targetService = svc || service;
    const targetLines = lineCount || lines;

    if (!targetId) return "";

    setLoading(true);
    setError(null);
    try {
      const response = await fetcher(
        `/api/customers/${targetId}/logs?service=${targetService}&lines=${targetLines}`
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Log getirme başarısız");
      }

      const data = await response.json();
      const logContent = data.logs || "Log bulunmuyor";
      setLogs(logContent);
      return logContent;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Log getirme hatası";
      setError(errorMsg);
      setLogs(`Hata: ${errorMsg}`);
      return "";
    } finally {
      setLoading(false);
    }
  }, [customerId, service, lines]);

  const clearLogs = useCallback(() => {
    setLogs("");
    setError(null);
  }, []);

  const downloadLogs = useCallback(() => {
    if (!logs || !customerId || !service) return;

    const blob = new Blob([logs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${customerId}-${service}-${new Date().toISOString()}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [logs, customerId, service]);

  useEffect(() => {
    if (!autoRefresh || !customerId) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, customerId, refreshInterval, fetchLogs]);

  return {
    logs,
    loading,
    error,
    fetchLogs,
    clearLogs,
    downloadLogs
  };
}