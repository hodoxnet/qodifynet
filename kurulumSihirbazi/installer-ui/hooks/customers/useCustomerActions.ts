"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch as fetcher } from "@/lib/api";

type CustomerAction = "start" | "stop" | "restart" | "delete";

export function useCustomerActions(onRefresh?: () => void) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = useCallback(async (
    customerId: string,
    action: CustomerAction,
    customerDomain?: string
  ) => {
    setActionLoading(customerId);
    try {
      const response = await fetcher(`/api/customers/${customerId}/${action}`, {
        method: "POST",
      });

      if (response.ok) {
        const actionMessages: Record<CustomerAction, string> = {
          start: "Müşteri başlatıldı",
          stop: "Müşteri durduruldu",
          restart: "Müşteri yeniden başlatıldı",
          delete: "Müşteri silindi",
        };

        toast.success(actionMessages[action]);

        if (onRefresh) {
          await onRefresh();
        }

        return true;
      } else {
        throw new Error(`${action} işlemi başarısız`);
      }
    } catch (error) {
      console.error(`Customer ${action} error:`, error);
      toast.error(`İşlem sırasında hata oluştu`);
      return false;
    } finally {
      setActionLoading(null);
    }
  }, [onRefresh]);

  const startCustomer = useCallback(
    (customerId: string, customerDomain?: string) =>
      handleAction(customerId, "start", customerDomain),
    [handleAction]
  );

  const stopCustomer = useCallback(
    (customerId: string, customerDomain?: string) =>
      handleAction(customerId, "stop", customerDomain),
    [handleAction]
  );

  const restartCustomer = useCallback(
    (customerId: string, customerDomain?: string) =>
      handleAction(customerId, "restart", customerDomain),
    [handleAction]
  );

  const deleteCustomer = useCallback(
    (customerId: string, customerDomain?: string) =>
      handleAction(customerId, "delete", customerDomain),
    [handleAction]
  );

  return {
    actionLoading,
    startCustomer,
    stopCustomer,
    restartCustomer,
    deleteCustomer,
    async deleteSoft(customerId: string) {
      setActionLoading(customerId);
      try {
        const res = await fetcher(`/api/customers/${customerId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Silme başarısız');
        toast.success('Kayıt silindi');
        if (onRefresh) await onRefresh();
      } catch (e) {
        toast.error('Silme hatası');
      } finally { setActionLoading(null); }
    },
    async deleteHard(customerId: string) {
      setActionLoading(customerId);
      try {
        // Yeni endpoint
        const res = await fetcher(`/api/customers/${customerId}?hard=true`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Kalıcı silme başarısız');
        toast.success('Kalıcı silindi');
        if (onRefresh) await onRefresh();
      } catch (e) {
        // Geriye dönük uyumluluk: eski endpoint
        try {
          const res2 = await fetcher(`/api/customers/${customerId}/delete`, { method: 'POST' });
          if (res2.ok) {
            toast.success('Kalıcı silindi');
            if (onRefresh) await onRefresh();
          } else throw new Error();
        } catch {
          toast.error('Kalıcı silme hatası');
        }
      } finally { setActionLoading(null); }
    },
    async createCustomer(payload: any) {
      try {
        const res = await fetcher('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('Oluşturma başarısız');
        toast.success('Müşteri oluşturuldu');
        if (onRefresh) await onRefresh();
      } catch { toast.error('Oluşturma hatası'); }
    },
    async updateCustomer(customerId: string, payload: any) {
      try {
        const res = await fetcher(`/api/customers/${customerId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('Güncelleme başarısız');
        toast.success('Müşteri güncellendi');
        if (onRefresh) await onRefresh();
      } catch { toast.error('Güncelleme hatası'); }
    },
  };
}
