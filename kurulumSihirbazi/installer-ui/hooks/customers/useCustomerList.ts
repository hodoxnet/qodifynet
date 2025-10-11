"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch as fetcher } from "@/lib/api";

export interface Customer {
  id: string;
  domain: string;
  status: "running" | "stopped" | "error";
  createdAt: string;
  partnerId?: string;
  ports: {
    backend: number;
    admin: number;
    store: number;
  };
  resources: {
    cpu: number;
    memory: number;
  };
  mode?: "local" | "production";
  db?: {
    name: string;
    user: string;
    host: string;
    port: number;
    schema?: string;
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
    prefix?: string;
  };
}

export function useCustomerList(opts?: { partnerId?: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetcher("/api/customers");
      if (!response.ok) throw new Error("Müşteri listesi yüklenemedi");

      const data = await response.json();
      const arr = Array.isArray(data) ? data : Array.isArray(data?.customers) ? data.customers : null;
      if (!arr) throw new Error("Beklenmeyen veri formatı");

      const filtered = opts?.partnerId ? arr.filter((c: any) => c.partnerId === opts.partnerId) : arr;
      setCustomers(filtered as any);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Müşteri listesi yüklenemedi";
      setError(errorMsg);
      toast.error(errorMsg);
      console.error("Customer fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [opts?.partnerId]);

  const refreshCustomers = useCallback(() => {
    return fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return {
    customers,
    loading,
    error,
    refreshCustomers,
    setCustomers
  };
}
