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

  const checkTemplates = useCallback(async (showErrors = false) => {
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
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to check templates");
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
          version: version || "",
          category,
          uploaded: detail?.uploaded ?? false,
          size: detail?.size || "",
          uploadDate: detail?.uploadDate || "",
        };
      });

      setTemplates(templatesList);
      setError(null); // Clear any previous errors
    } catch (err) {
      const message = err instanceof Error ? err.message : "Template kontrolü başarısız";
      console.error("Template check error:", err);

      // Sadece açık bir şekilde hata gösterilmesi istendiğinde toast göster
      if (showErrors) {
        setError(message);
        toast.error(message);
      }

      // Hata durumunda bile boş bir template listesi göster
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [detectLatestVersion]);

  const refreshTemplates = useCallback(async (showErrors = false) => {
    await checkTemplates(showErrors);
  }, [checkTemplates]);

  const deleteTemplate = useCallback(async (filename: string): Promise<boolean> => {
    try {
      const response = await apiFetch(`/api/templates/${filename}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Template silme işlemi başarısız");
        return false;
      }

      const data = await response.json();
      toast.success(data.message || "Template başarıyla silindi");

      // Template listesini sessizce güncelle (hata mesajı gösterme)
      await refreshTemplates(false);
      return true;
    } catch (error) {
      console.error("Template silme hatası:", error);
      toast.error("Template silme işlemi başarısız");
      return false;
    }
  }, [refreshTemplates]);

  // Initial load
  useEffect(() => {
    checkTemplates(true); // İlk yüklemede hataları göster
  }, []);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      checkTemplates(false); // Auto refresh'te hata gösterme
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
    deleteTemplate,
  };
}