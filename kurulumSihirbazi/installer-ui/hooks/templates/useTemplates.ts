"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export interface TemplateFile {
  name: string;
  version: string;
  uploaded: boolean;
  size?: string;
  uploadDate?: string;
  category: "backend" | "admin" | "store";
}

export interface TemplateCheckResult {
  available: boolean;
  missing: string[];
  uploaded?: string[];
  message?: string;
  files?: {
    [filename: string]: {
      uploaded: boolean;
      size?: string;
      uploadDate?: string;
      category?: string;
      path?: string;
    };
  };
}

export function useTemplates() {
  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<TemplateCheckResult | null>(null);
  const [latestVersion, setLatestVersion] = useState<string>("2.4.0");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const detectLatestVersion = useCallback(async () => {
    try {
      const res = await apiFetch("/api/templates");
      if (!res.ok) return;
      const list: Array<{ version: string }> = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        setLatestVersion(list[0].version);
        return list[0].version;
      }
    } catch (error) {
      console.error("Failed to detect version:", error);
    }
    return "2.4.0";
  }, []);

  const checkTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const version = await detectLatestVersion();

      const response = await apiFetch("/api/templates/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: version || "latest" }),
      });

      if (!response.ok) {
        throw new Error("Failed to check templates");
      }

      const data: TemplateCheckResult = await response.json();
      setStatus(data);

      // Create template file objects from API response
      const templateNames = [`backend-${version}.zip`, `admin-${version}.zip`, `store-${version}.zip`];
      const templatesList: TemplateFile[] = templateNames.map(name => {
        const category = name.split("-")[0] as "backend" | "admin" | "store";
        const detail = data.files?.[name];

        return {
          name,
          version,
          category,
          uploaded: detail?.uploaded ?? !data.missing?.includes(name),
          size: detail?.size,
          uploadDate: detail?.uploadDate,
        };
      });

      setTemplates(templatesList);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Template kontrolü başarısız";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [detectLatestVersion]);

  const refreshTemplates = useCallback(async () => {
    await checkTemplates();
  }, [checkTemplates]);

  // Initial load
  useEffect(() => {
    checkTemplates();
  }, [checkTemplates]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      checkTemplates();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, checkTemplates]);

  return {
    templates,
    loading,
    error,
    status,
    latestVersion,
    autoRefresh,
    setAutoRefresh,
    refreshTemplates,
  };
}