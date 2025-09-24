"use client";

import {
  Settings,
  Rocket,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { SetupConfig, InstallStatus } from '@/lib/types/setup';
import { useInstallation } from '@/hooks/setup/useInstallation';

interface SummaryStepProps {
  config: SetupConfig;
  onNext: () => void;
  onBack: () => void;
  onStartInstallation: () => void;
  installStatus: InstallStatus;
}

export function SummaryStep({
  config,
  onNext,
  onBack,
  onStartInstallation,
  installStatus
}: SummaryStepProps) {
  const { isLocalDomain } = useInstallation();
  const isLocal = isLocalDomain(config.domain);

  const summaryItems = [
    { label: "Domain", value: config.domain },
    { label: "Mağaza Adı", value: config.storeName },
    { label: "Veritabanı", value: config.dbName },
    { label: "Admin E-posta", value: config.adminEmail },
    {
      label: "Template",
      value: config.templateVersion === "latest" ? "v2.4.0 (En Güncel)" : `v${config.templateVersion}`
    },
    {
      label: "Kurulum Modu",
      value: isLocal ? "Local" : "Production",
      badge: true
    },
  ];

  const handleStartInstallation = () => {
    onStartInstallation();
    onNext();
  };

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <Settings className="h-10 w-10 text-gray-600" />
        </div>
        <CardTitle className="text-2xl">Kurulum Özeti</CardTitle>
        <CardDescription>
          Kurulum bilgilerini kontrol edin
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-lg bg-gray-50 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {summaryItems.map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="text-sm font-medium text-gray-600">{item.label}</p>
                <div className="font-medium text-gray-900">
                  {item.badge ? (
                    <Badge variant={isLocal ? "secondary" : "default"}>
                      {item.value}
                    </Badge>
                  ) : (
                    item.value
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Önemli:</strong> Kurulum başlatıldıktan sonra geri alınamaz.
            Tüm bilgilerin doğru olduğundan emin olun.
          </AlertDescription>
        </Alert>

        <div className="flex justify-between">
          <Button
            onClick={onBack}
            variant="outline"
            disabled={installStatus === "running"}
          >
            Geri
          </Button>
          <Button
            onClick={handleStartInstallation}
            disabled={installStatus === "running"}
            className="min-w-[160px] bg-gradient-to-r from-gray-900 to-slate-800 hover:from-gray-800 hover:to-slate-700"
          >
            {installStatus === "running" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Kurulum Devam Ediyor...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Kurulumu Başlat
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}