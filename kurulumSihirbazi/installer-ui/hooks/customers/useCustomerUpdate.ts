"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { io as socketIO, Socket } from "socket.io-client";

export interface DeploymentInfo {
  source?: 'git' | 'template';
  repoUrl?: string;
  branch?: string;
  lastCommit?: string;
  lastSyncAt?: string;
  [key: string]: any;
}

type UpdateOperation = 'git' | 'deps' | 'build' | 'prisma';

export function useCustomerUpdate(customerId: string, domain?: string) {
  const [info, setInfo] = useState<DeploymentInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [operation, setOperation] = useState<UpdateOperation | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_INSTALLER_API_URL || "http://localhost:3031";

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

  // Socket.io bağlantısını kur ve build loglarını dinle
  useEffect(() => {
    if (!domain) return;

    const socket = socketIO(API_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      // Domain'e özel room'a katıl
      socket.emit("subscribe-deployment", domain);
      console.log(`[Socket.io] Subscribed to deployment-${domain}`);
    });

    socket.on("connect_error", (err: any) => {
      console.error("Socket connect_error:", err?.message || err);
    });

    // Build output (stdout/stderr) event'lerini dinle
    socket.on("build-output", (data: {
      service: string;
      output: string;
      type: 'stdout' | 'stderr';
      isError?: boolean;
      errorType?: 'heap' | 'syntax' | 'module' | 'other';
    }) => {
      const lines = data.output.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        let prefix = '';
        if (data.type === 'stderr') {
          prefix = '❌';
        } else if (line.includes('ERROR') || line.includes('Error')) {
          prefix = '🔴';
        } else if (line.includes('WARNING') || line.includes('Warning')) {
          prefix = '🟡';
        } else if (line.includes('SUCCESS') || line.includes('✓')) {
          prefix = '🟢';
        } else {
          prefix = '🔹';
        }

        const logMessage = `${prefix} [BUILD:${data.service.toUpperCase()}] ${line}`;
        appendLog(logMessage);
      });
    });

    // Build progress event'lerini dinle
    socket.on("setup-progress", (data: { message: string; step?: string; percent?: number }) => {
      if (data.step === 'build') {
        appendLog(data.message);
      }
    });

    // Build metrics (RAM kullanımı)
    socket.on("build-metrics", (data: { service: string; memoryMB: number }) => {
      appendLog(`📈 [${data.service.toUpperCase()}] RAM: ${data.memoryMB} MB`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [domain, API_URL, appendLog]);

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
    setLogs([]);
    appendLog('Git deposu güncelleniyor...');

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
  }, [customerId, runOperation, appendLog]);

  const reinstallDependencies = useCallback(async () => {
    setLogs([]);
    appendLog('Bağımlılıklar yükleniyor...');

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
  }, [customerId, runOperation, appendLog]);

  const buildApplications = useCallback(async (payload: { heapMB?: number; skipTypeCheck?: boolean }) => {
    // Build başlamadan önce logları temizle
    setLogs([]);
    appendLog('Build işlemi başlatılıyor...');

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
  }, [customerId, runOperation, appendLog]);

  const prismaGenerate = useCallback(async () => {
    return runOperation('prisma', async () => {
      const res = await apiFetch(`/api/customers/${customerId}/database/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || 'Prisma generate başarısız');
      }
      return res.json().catch(() => ({}));
    }, 'Prisma Client oluşturuldu');
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

  const fetchBranches = useCallback(async () => {
    setLoadingBranches(true);
    try {
      const res = await apiFetch(`/api/customers/${customerId}/git/branches`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || 'Branch listesi alınamadı');
      }
      const data = await res.json();
      if (data?.success && Array.isArray(data.branches)) {
        setBranches(data.branches);
      }
    } catch (error: any) {
      console.error('Fetch branches failed:', error);
      toast.error(error?.message || 'Branch listesi alınamadı');
    } finally {
      setLoadingBranches(false);
    }
  }, [customerId]);

  return {
    info,
    loading,
    operation,
    logs,
    branches,
    loadingBranches,
    refresh: fetchInfo,
    fetchBranches,
    gitUpdate,
    reinstallDependencies,
    buildApplications,
    prismaGenerate,
    prismaPush,
    fixDatabaseOwnership,
  };
}
