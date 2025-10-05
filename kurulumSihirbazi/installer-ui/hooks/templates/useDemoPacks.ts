"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export interface DemoPack {
  name: string;
  size: string;
  uploadDate: string;
  category?: string;
  path: string;
}

export function useDemoPacks() {
  const [packs, setPacks] = useState<DemoPack[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string>("2.4.0");

  const detectLatestVersion = useCallback(async () => {
    try {
      const res = await apiFetch("/api/templates");
      if (!res.ok) return;
      const list: Array<{ version: string }> = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        setLatestVersion(list[0].version);
      }
    } catch {}
  }, []);

  const refresh = useCallback(async (version?: string) => {
    setLoading(true);
    setError(null);
    try {
      const v = version || latestVersion || "2.4.0";
      const res = await apiFetch(`/api/templates/demo-packs?version=${encodeURIComponent(v)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Demo pack listesi alınamadı");
      }
      const data = await res.json();
      setPacks(Array.isArray(data?.packs) ? data.packs : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Demo pack listesi alınamadı";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [latestVersion]);

  useEffect(() => {
    (async () => {
      await detectLatestVersion();
      await refresh();
    })();
  }, [detectLatestVersion, refresh]);

  const uploadDemoPack = useCallback(async (file: File, version?: string) => {
    if (!file.name.endsWith('.zip')) {
      toast.error("Lütfen ZIP dosyası seçin");
      return false;
    }
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('version', version || latestVersion || '2.4.0');
      const res = await apiFetch('/api/templates/demo/upload', { method: 'POST', body: form as any });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Yükleme başarısız');
      }
      toast.success('Demo paketi yüklendi');
      await refresh(version);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Yükleme başarısız';
      toast.error(msg);
      return false;
    }
  }, [latestVersion, refresh]);

  const deleteDemoPack = useCallback(async (filename: string, version?: string) => {
    try {
      const v = version || latestVersion || '2.4.0';
      const res = await apiFetch(`/api/templates/demo/${encodeURIComponent(v)}/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Silme başarısız');
      }
      toast.success('Demo paketi silindi');
      await refresh(v);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Silme başarısız';
      toast.error(msg);
      return false;
    }
  }, [latestVersion, refresh]);

  return { packs, loading, error, latestVersion, refresh, uploadDemoPack, deleteDemoPack };
}

