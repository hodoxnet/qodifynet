"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export interface Admin {
  id: string;
  email: string;
  name?: string;
  isActive: boolean;
  createdAt: string;
}

export interface NewAdmin {
  email: string;
  password: string;
  name?: string;
}

export function useCustomerAdmins(customerId: string) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/customers/${customerId}/admins`);
      if (!res.ok) throw new Error("Failed to fetch admins");
      const data = await res.json();
      setAdmins(data.admins || []);
      return data.admins || [];
    } catch (error) {
      console.error("Failed to fetch admins:", error);
      toast.error("Yönetici listesi yüklenemedi");
      setAdmins([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const createAdmin = useCallback(async (adminData: NewAdmin) => {
    if (!adminData.email || !adminData.password) {
      toast.error("Email ve şifre zorunludur");
      return false;
    }

    try {
      setCreating(true);
      const res = await apiFetch(`/api/customers/${customerId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminData),
      });

      if (!res.ok) throw new Error("Failed to create admin");

      const result = await res.json();
      if (result.success) {
        toast.success("Admin kullanıcısı başarıyla oluşturuldu");
        await fetchAdmins();
        return true;
      } else {
        toast.error(result.message || "Admin oluşturulamadı");
        return false;
      }
    } catch (error) {
      toast.error("Admin oluşturulamadı");
      console.error("Create admin error:", error);
      return false;
    } finally {
      setCreating(false);
    }
  }, [customerId, fetchAdmins]);

  return {
    admins,
    loading,
    creating,
    fetchAdmins,
    createAdmin,
  };
}