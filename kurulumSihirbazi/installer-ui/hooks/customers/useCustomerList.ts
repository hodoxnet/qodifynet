"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch as fetcher } from "@/lib/api";

export interface Customer {
  id: string;
  domain: string;
  status: "running" | "stopped" | "error";
  createdAt: string;
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
    prefix?: string;
  };
}

export function useCustomerList() {
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
      if (!Array.isArray(data)) throw new Error("Beklenmeyen veri formatı");

      setCustomers(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Müşteri listesi yüklenemedi";
      setError(errorMsg);
      toast.error(errorMsg);
      console.error("Customer fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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