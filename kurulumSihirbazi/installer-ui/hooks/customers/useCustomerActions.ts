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
    async (customerId: string, customerDomain: string) => {
      const confirmed = confirm(
        `${customerDomain} müşterisini silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`
      );

      if (confirmed) {
        return handleAction(customerId, "delete", customerDomain);
      }
      return false;
    },
    [handleAction]
  );

  return {
    actionLoading,
    startCustomer,
    stopCustomer,
    restartCustomer,
    deleteCustomer,
  };
}