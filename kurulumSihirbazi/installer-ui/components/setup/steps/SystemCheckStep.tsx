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
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return <Badge variant="success">Hazır</Badge>;
      case "warning":
        return <Badge variant="warning">Uyarı</Badge>;
      case "error":
        return <Badge variant="destructive">Eksik</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <HardDrive className="h-10 w-10 text-gray-600" />
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
                  className="flex items-center justify-between rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(req.status)}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {req.name}
                        </span>
                        {!req.required && (
                          <Badge variant="secondary" className="text-xs">
                            İsteğe Bağlı
                          </Badge>
                        )}
                      </div>
                      {req.message && (
                        <p className="text-sm text-gray-600">{req.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {req.version && (
                      <span className="text-sm text-gray-500">{req.version}</span>
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

            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
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