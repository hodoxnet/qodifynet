"use client";

import { AlertTriangle } from "lucide-react";
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
import { TemplateFile } from "@/hooks/templates/useTemplates";

interface TemplateDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateFile | null;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function TemplateDeleteDialog({
  open,
  onOpenChange,
  template,
  onConfirm,
  isDeleting = false,
}: TemplateDeleteDialogProps) {
  if (!template) return null;

  const getTemplateTitle = () => {
    const titles = {
      backend: "Backend API",
      admin: "Admin Panel",
      store: "Store Frontend",
    };
    return titles[template.category as keyof typeof titles] || "Template";
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <AlertDialogTitle>Template'i Sil</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="mt-3 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong className="font-semibold text-gray-900 dark:text-gray-100">{getTemplateTitle()}</strong> template dosyasını silmek istediğinizden emin misiniz?
              </p>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Silinecek dosya:
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                  {template.name}
                </p>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                ⚠️ Bu işlem geri alınamaz. Template dosyası fiziksel olarak silinecektir.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>İptal</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? "Siliniyor..." : "Sil"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}