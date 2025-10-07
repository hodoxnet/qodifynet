"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export interface DeploymentInfo {
  source?: 'git' | 'template';
  repoUrl?: string;
  branch?: string;
  lastCommit?: string;
  lastSyncAt?: string;
  [key: string]: any;
}

type UpdateOperation = 'git' | 'deps' | 'build' | 'prisma';

export function useCustomerUpdate(customerId: string) {
  const [info, setInfo] = useState<DeploymentInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [operation, setOperation] = useState<UpdateOperation | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const appendLog = useCallback((message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}] ${message}`]);
  }, []);

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/customers/${customerId}/deployment`);
      if (!res.ok) throw new Error('Deployment bilgisi alınamadı');
      const data = await res.json();
      if (data?.success) {
        setInfo(data.info || null);
      } else {
        setInfo(null);
      }
    } catch (error: any) {
      console.error('Deployment info error:', error);
      toast.error(error?.message || 'Deployment bilgisi alınamadı');
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  const runOperation = useCallback(async (key: UpdateOperation, handler: () => Promise<any>, successMessage: string) => {
    if (operation) return;
    setOperation(key);
    try {
      const result = await handler();
      if (result?.message) appendLog(result.message);
      toast.success(successMessage);
      await fetchInfo();
      return result;
    } catch (error: any) {
      console.error(`Update operation ${key} failed:`, error);
      toast.error(error?.message || successMessage.replace('başarıyla', '')); // fallback
      throw error;
    } finally {
      setOperation(null);
    }
  }, [operation, appendLog, fetchInfo]);

  const gitUpdate = useCallback(async (payload: { branch?: string; accessToken?: string; username?: string }) => {
    return runOperation('git', async () => {
      const res = await apiFetch(`/api/customers/${customerId}/update/git`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || 'Git güncellemesi başarısız');
      }
      return res.json().catch(() => ({}));
    }, 'Git deposu güncellendi');
  }, [customerId, runOperation]);

  const reinstallDependencies = useCallback(async () => {
    return runOperation('deps', async () => {
      const res = await apiFetch(`/api/customers/${customerId}/update/install-dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || 'Bağımlılık yükleme başarısız');
      }
      return res.json().catch(() => ({}));
    }, 'Bağımlılıklar güncellendi');
  }, [customerId, runOperation]);

  const buildApplications = useCallback(async (payload: { heapMB?: number; skipTypeCheck?: boolean }) => {
    return runOperation('build', async () => {
      const res = await apiFetch(`/api/customers/${customerId}/update/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || err?.error || 'Build başarısız');
      }
      return res.json().catch(() => ({}));
    }, 'Build işlemi tamamlandı');
  }, [customerId, runOperation]);

  const prismaPush = useCallback(async () => {
    return runOperation('prisma', async () => {
      const res = await apiFetch(`/api/customers/${customerId}/database/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || 'Prisma db push başarısız');
      }
      return res.json().catch(() => ({}));
    }, 'Veritabanı şeması güncellendi');
  }, [customerId, runOperation]);

  const fixDatabaseOwnership = useCallback(async () => {
    if (operation) return;
    setOperation('prisma'); // Prisma operation type kullanıyoruz
    try {
      const res = await apiFetch(`/api/customers/${customerId}/database/fix-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || 'Database ownership fix başarısız');
      }
      const result = await res.json().catch(() => ({}));
      if (result?.message) appendLog(result.message);
      toast.success('Veritabanı yetkileri düzeltildi');
      return result;
    } catch (error: any) {
      console.error('Database ownership fix failed:', error);
      toast.error(error?.message || 'Yetki düzeltme başarısız');
      throw error;
    } finally {
      setOperation(null);
    }
  }, [customerId, operation, appendLog]);

  return {
    info,
    loading,
    operation,
    logs,
    refresh: fetchInfo,
    gitUpdate,
    reinstallDependencies,
    buildApplications,
    prismaPush,
    fixDatabaseOwnership,
  };
}
