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
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/50 dark:to-purple-900/50">
          <Settings className="h-10 w-10 text-violet-600 dark:text-violet-400" />
        </div>
        <CardTitle className="text-2xl">Kurulum Özeti</CardTitle>
        <CardDescription>
          Kurulum bilgilerini kontrol edin
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {summaryItems.map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{item.label}</p>
                <div className="font-medium text-gray-900 dark:text-gray-100">
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

        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
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
            className="min-w-[160px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
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