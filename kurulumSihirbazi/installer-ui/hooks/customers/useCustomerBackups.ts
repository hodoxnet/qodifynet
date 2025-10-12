"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { io as socketIO } from "socket.io-client";

export type CustomerBackup = {
  id: string;
  createdAt: string;
  sizeBytes: number;
  manifest?: any;
};

export function useCustomerBackups(customerId: string, domain: string) {
  const [backups, setBackups] = useState<CustomerBackup[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [operating, setOperating] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [percent, setPercent] = useState<number>(0);
  const socketRef = useRef<ReturnType<typeof socketIO> | null>(null);
  const API_URL = process.env.NEXT_PUBLIC_INSTALLER_API_URL || "http://localhost:3031";

  const appendLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('tr-TR');
    setLogs(prev => [...prev, `[${ts}] ${msg}`]);
  }, []);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/customers/${customerId}/backups`);
      const data = await res.json();
      setBackups(Array.isArray(data?.backups) ? data.backups : []);
    } catch (e) {
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  // Başarı sonrası ilerlemeyi temizlemek için küçük bir gecikme
  useEffect(() => {
    if (!operating && percent >= 100) {
      const t = setTimeout(() => setPercent(0), 1500);
      return () => clearTimeout(t);
    }
  }, [operating, percent]);

  useEffect(() => {
    if (!domain) return;
    const socket = socketIO(API_URL, { transports: ["websocket", "polling"], withCredentials: true });
    socketRef.current = socket;
    socket.on("connect", () => { socket.emit("subscribe-deployment", domain); });
    socket.on("backup-progress", (data: { message?: string; percent?: number }) => {
      if (typeof data?.percent === 'number') {
        const incoming = Math.max(0, Math.min(100, Math.floor(data.percent)));
        setPercent(prev => Math.max(prev, incoming)); // monotonik artış: geriye düşme yok
      }
      if (data?.message) appendLog(data.message);
    });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [domain, API_URL, appendLog]);

  const createBackup = useCallback(async (options?: { includeArtifacts?: boolean; includeLogs?: boolean }) => {
    if (operating) return false;
    setOperating(true);
    setLogs([]);
    try {
      appendLog("Yedekleme başlatılıyor...");
      setPercent(0);
      const res = await apiFetch(`/api/customers/${customerId}/backups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Yedekleme başarısız');
      toast.success("Yedekleme tamamlandı");
      setPercent(100);
      await fetchBackups();
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Yedekleme başarısız");
      return false;
    } finally {
      setOperating(false);
    }
  }, [customerId, fetchBackups, operating, appendLog]);

  const deleteBackup = useCallback(async (backupId: string) => {
    if (operating) return false;
    setOperating(true);
    try {
      const res = await apiFetch(`/api/customers/${customerId}/backups/${backupId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Silme başarısız');
      toast.success('Yedek silindi');
      await fetchBackups();
      return true;
    } catch (e: any) {
      toast.error(e?.message || 'Silme başarısız');
      return false;
    } finally {
      setOperating(false);
    }
  }, [customerId, fetchBackups, operating]);

  const restoreBackup = useCallback(async (backupId: string) => {
    if (operating) return false;
    setOperating(true);
    setLogs([]);
    try {
      appendLog("Geri yükleme başlatılıyor...");
      setPercent(0);
      const res = await apiFetch(`/api/customers/${customerId}/backups/${backupId}/restore`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Geri yükleme başarısız');
      toast.success('Geri yükleme tamamlandı');
      setPercent(100);
      return true;
    } catch (e: any) {
      toast.error(e?.message || 'Geri yükleme başarısız');
      return false;
    } finally {
      setOperating(false);
    }
  }, [customerId, operating, appendLog]);

  const downloadBackup = useCallback(async (backupId: string) => {
    try {
      const res = await apiFetch(`/api/customers/${customerId}/backups/${backupId}/download`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || 'İndirme başarısız');
      }
      const blob = await res.blob();
      // Dosya adı: header'dan veya tahmini
      const cd = res.headers.get('Content-Disposition') || '';
      let filename = `${domain}-${backupId}.zip`;
      const m = cd.match(/filename="?([^";]+)"?/i);
      if (m && m[1]) filename = m[1];

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    } catch (e: any) {
      toast.error(e?.message || 'İndirme başarısız');
      return false;
    }
  }, [customerId, domain]);

  return {
    backups,
    loading,
    operating,
    logs,
    percent,
    refresh: fetchBackups,
    createBackup,
    deleteBackup,
    restoreBackup,
    downloadBackup,
  };
}
