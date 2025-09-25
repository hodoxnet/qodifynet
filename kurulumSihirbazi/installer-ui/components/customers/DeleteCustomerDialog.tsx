"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Customer } from "@/hooks/customers/useCustomerList";

interface DeleteCustomerDialogProps {
  customer: Customer | null;
  open: boolean;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteCustomerDialog({
  customer,
  open,
  loading = false,
  onOpenChange,
  onConfirm,
}: DeleteCustomerDialogProps) {
  if (!customer) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-lg">
                Müşteriyi Sil
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1">
                Bu işlem geri alınamaz!
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="my-4 space-y-3">
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10 p-4">
            <p className="text-sm font-medium text-red-900 dark:text-red-200">
              Aşağıdaki müşteri silinecek:
            </p>
            <p className="mt-2 font-mono text-sm text-red-800 dark:text-red-300">
              {customer.domain}
            </p>
            <p className="mt-1 text-xs text-red-700 dark:text-red-400">
              ID: {customer.id}
            </p>
          </div>

          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium">Bu işlem şunları yapacak:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Tüm servisleri durduracak</li>
              <li>Veritabanını silecek</li>
              <li>Tüm dosyaları kaldıracak</li>
              <li>Nginx konfigürasyonunu silecek</li>
            </ul>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            İptal
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Siliniyor...
              </>
            ) : (
              <>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Evet, Sil
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}