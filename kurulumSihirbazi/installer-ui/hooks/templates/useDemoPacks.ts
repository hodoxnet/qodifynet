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

  const uploadDemoPack = useCallback(async (
    file: File,
    version?: string,
    onProgress?: (percent: number) => void
  ) => {
    if (!file.name.endsWith('.zip')) {
      toast.error("Lütfen ZIP dosyası seçin");
      return false;
    }

    return new Promise<boolean>((resolve) => {
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('version', version || latestVersion || '2.4.0');

        const xhr = new XMLHttpRequest();
        const API_URL = process.env.NEXT_PUBLIC_INSTALLER_API_URL || "http://localhost:3031";

        // Get auth token and CSRF token
        const token = typeof window !== 'undefined' ? localStorage.getItem('qid_access') : null;
        const csrfToken = typeof window !== 'undefined' ? localStorage.getItem('qid_csrf_token') : null;

        xhr.open('POST', `${API_URL}/api/templates/demo/upload`, true);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        if (csrfToken) {
          xhr.setRequestHeader('x-csrf-token', csrfToken);
        }
        xhr.withCredentials = true;

        // Progress tracking
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };

        xhr.onload = async () => {
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              toast.success('Demo paketi yüklendi');
              await refresh(version);
              resolve(true);
            } else {
              const data = JSON.parse(xhr.responseText || '{}');
              throw new Error(data?.error || 'Yükleme başarısız');
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Yükleme başarısız';
            toast.error(msg);
            resolve(false);
          }
        };

        xhr.onerror = () => {
          toast.error('Ağ hatası - yükleme başarısız');
          resolve(false);
        };

        xhr.ontimeout = () => {
          toast.error('Yükleme zaman aşımına uğradı');
          resolve(false);
        };

        // 15 dakika timeout (büyük dosyalar için)
        xhr.timeout = 15 * 60 * 1000;

        xhr.send(form);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Yükleme başarısız';
        toast.error(msg);
        resolve(false);
      }
    });
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

