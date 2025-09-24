"use client";

import { useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  HardDrive,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSystemRequirements } from '@/hooks/setup/useSystemRequirements';

interface SystemCheckStepProps {
  onNext: () => void;
}

export function SystemCheckStep({ onNext }: SystemCheckStepProps) {
  const { requirements, loading, checkRequirements, canProceed } = useSystemRequirements();

  useEffect(() => {
    checkRequirements();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok":
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-rose-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Hazır</Badge>;
      case "warning":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Uyarı</Badge>;
      case "error":
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">Eksik</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50">
          <HardDrive className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
        </div>
        <CardTitle className="text-2xl">Sistem Kontrolü</CardTitle>
        <CardDescription>
          Kurulum için gerekli bileşenler kontrol ediliyor
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {requirements.map((req) => (
                <div
                  key={req.name}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(req.status)}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {req.name}
                        </span>
                        {!req.required && (
                          <Badge variant="secondary" className="text-xs">
                            İsteğe Bağlı
                          </Badge>
                        )}
                      </div>
                      {req.message && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{req.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {req.version && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">{req.version}</span>
                    )}
                    {getStatusBadge(req.status)}
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={checkRequirements}
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Yeniden Kontrol Et
            </Button>

            <Alert className="bg-sky-50 border-sky-200">
              <AlertCircle className="h-4 w-4 text-sky-600" />
              <AlertDescription className="text-sky-700">
                <strong>Not:</strong> Sarı uyarılar production kurulum için gereklidir.
                Localhost testi için sadece yeşil olan bileşenler yeterlidir.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button
                onClick={onNext}
                disabled={!canProceed()}
                className="min-w-[120px]"
              >
                Devam Et
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}