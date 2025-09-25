"use client";

import { CheckCircle, AlertTriangle, Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TemplateCheckResult } from "@/hooks/templates/useTemplates";

interface TemplateStatusAlertProps {
  status: TemplateCheckResult | null;
  loading: boolean;
  onRefresh: () => void;
}

export function TemplateStatusAlert({
  status,
  loading,
  onRefresh,
}: TemplateStatusAlertProps) {
  if (loading && !status) {
    return (
      <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">
          Template Kontrol Ediliyor
        </AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          Template dosyalarının durumu kontrol ediliyor, lütfen bekleyin...
        </AlertDescription>
      </Alert>
    );
  }

  if (!status) return null;

  if (status.available) {
    return (
      <Alert className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <AlertTitle className="text-emerald-900 dark:text-emerald-100">
          Tüm Template Dosyaları Hazır
        </AlertTitle>
        <AlertDescription className="text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center justify-between">
            <span>Yeni müşteri kurulumu yapabilirsiniz.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="ml-4"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Yenile"
              )}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const missingCount = status.missing?.length || 0;
  const uploadedCount = status.uploaded?.length || 0;

  return (
    <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        Template Dosyaları Eksik
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <div className="space-y-2">
          <p>
            {uploadedCount} dosya yüklü, {missingCount} dosya eksik.
            Kurulum yapabilmek için tüm dosyaları yüklemeniz gerekiyor.
          </p>
          {status.missing && status.missing.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium mb-1">Eksik dosyalar:</p>
              <ul className="text-sm space-y-0.5">
                {status.missing.map((file) => (
                  <li key={file} className="flex items-center gap-1">
                    <span className="text-amber-500">•</span>
                    <span>{file}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="mt-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Kontrol Et"
            )}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}