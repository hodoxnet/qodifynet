"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface TemplateVersion {
  version: string;
  date?: string;
  isLatest?: boolean;
  files?: {
    backend: boolean;
    admin: boolean;
    store: boolean;
  };
}

export function useTemplateVersions() {
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("latest");
  const [loading, setLoading] = useState(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/templates");
      if (!response.ok) return;

      const data: Array<{ version: string; date?: string }> = await response.json();

      if (Array.isArray(data)) {
        const versionList: TemplateVersion[] = data.map((item, index) => ({
          version: item.version,
          date: item.date,
          isLatest: index === 0,
        }));

        setVersions(versionList);

        if (versionList.length > 0 && selectedVersion === "latest") {
          setSelectedVersion(versionList[0].version);
        }
      }
    } catch (error) {
      console.error("Failed to fetch versions:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedVersion]);

  const deleteVersion = useCallback(async (version: string) => {
    try {
      const response = await apiFetch(`/api/templates/${version}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchVersions();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to delete version:", error);
      return false;
    }
  }, [fetchVersions]);

  useEffect(() => {
    fetchVersions();
  }, []);

  return {
    versions,
    selectedVersion,
    setSelectedVersion,
    loading,
    fetchVersions,
    deleteVersion,
  };
}