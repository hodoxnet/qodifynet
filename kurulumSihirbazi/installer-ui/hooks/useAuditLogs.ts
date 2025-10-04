"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export type AuditLog = {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: any;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  actor?: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
};

export function useAuditLogs(initialPageSize = 50) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const fetchLogs = useCallback(async (params?: { action?: string; page?: number; pageSize?: number }) => {
    const currentPage = params?.page ?? page;
    const currentPageSize = params?.pageSize ?? pageSize;
    const skip = (currentPage - 1) * currentPageSize;

    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.append('take', String(currentPageSize));
      query.append('skip', String(skip));
      if (params?.action) query.append('action', params.action);

      const res = await apiFetch(`/api/audit?${query.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch logs');

      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error('Aktiviteler yüklenemedi');
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize]);

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const changePageSize = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1); // Reset to first page when changing page size
  }, []);

  const totalPages = Math.ceil(total / pageSize);

  return {
    logs,
    loading,
    total,
    page,
    pageSize,
    totalPages,
    goToPage,
    changePageSize,
    refresh: fetchLogs,
  };
}
