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
  onSoftDelete?: () => void;
  onHardDelete: () => void;
}

export function DeleteCustomerDialog({
  customer,
  open,
  loading = false,
  onOpenChange,
  onSoftDelete,
  onHardDelete,
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

          <div className="space-y-4 text-sm">
            <div className="space-y-2 text-gray-700 dark:text-gray-300">
              <p className="font-medium">Silme Tipi</p>
              <div className="rounded-md border p-3">
                <p className="font-medium">1) Sadece Kaydı Sil (Önerilen)</p>
                <p className="text-xs opacity-80">Kontrol‑plane kaydı silinir. Dosyalar/PM2/DB kalır.</p>
              </div>
              <div className="rounded-md border border-red-300 p-3 bg-red-50/40 dark:bg-red-900/10">
                <p className="font-medium text-red-700 dark:text-red-300">2) Kalıcı Sil (Geri Alınamaz)</p>
                <ul className="text-xs opacity-80 list-disc list-inside">
                  <li>Tüm servisler durdurulur</li>
                  <li>Veritabanı silinir</li>
                  <li>Dosyalar kaldırılır</li>
                  <li>Nginx konfigürasyonu silinir</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            İptal
          </AlertDialogCancel>
          <div className="flex gap-2">
            {onSoftDelete && (
              <AlertDialogAction
                onClick={onSoftDelete}
                disabled={loading}
                className="bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    İşleniyor...
                  </>
                ) : (
                  <>Sadece Kaydı Sil</>
                )}
              </AlertDialogAction>
            )}
            <AlertDialogAction
              onClick={onHardDelete}
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
                  Kalıcı Sil
                </>
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
