"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export type PartnerApplication = {
  id: string;
  status: string; // pending|approved|rejected
  form: any;
  createdAt: string;
  partnerId?: string | null;
};

export function usePartnerApplications(initialStatus: string = "pending") {
  const [status, setStatus] = useState<string>(initialStatus);
  const [items, setItems] = useState<PartnerApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchList = useCallback(async (s: string = status) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/partners/applications?status=${encodeURIComponent(s)}`);
      const data = await res.json();
      const arr = Array.isArray(data?.applications) ? data.applications : [];
      setItems(arr);
    } catch (e) {
      toast.error("Başvurular yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { fetchList(status); }, [status, fetchList]);

  const approve = useCallback(async (id: string, payload: any) => {
    try {
      const res = await apiFetch(`/api/partners/applications/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Onaylama hatası');
      }
      toast.success('Başvuru onaylandı');
      await fetchList();
      return true;
    } catch (e: any) {
      toast.error(e?.message || 'Onaylama hatası');
      throw e;
    }
  }, [fetchList]);

  const reject = useCallback(async (id: string, reason?: string) => {
    try {
      const res = await apiFetch(`/api/partners/applications/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Reddetme hatası');
      }
      toast.success('Başvuru reddedildi');
      await fetchList();
      return true;
    } catch (e: any) {
      toast.error(e?.message || 'Reddetme hatası');
      throw e;
    }
  }, [fetchList]);

  return { status, setStatus, items, loading, approve, reject, refresh: fetchList };
}
