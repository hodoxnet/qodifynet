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
import { useSystemResources } from '@/hooks/system/useSystemResources';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useInstallation } from '@/hooks/setup/useInstallation';
import { useEffect } from 'react';

interface SummaryStepProps {
  config: SetupConfig;
  onConfigUpdate: (updates: Partial<SetupConfig>) => void;
  onNext: () => void;
  onBack: () => void;
  onStartInstallation: () => void;
  installStatus: InstallStatus;
}

export function SummaryStep({
  config,
  onConfigUpdate,
  onNext,
  onBack,
  onStartInstallation,
  installStatus
}: SummaryStepProps) {
  const { isLocalDomain } = useInstallation();
  const isLocal = isLocalDomain(config.domain);
  const { resources } = useSystemResources(false);

  const totalGB = resources?.memory.totalGB || 0;
  const usedGB = resources?.memory.usedGB || 0;
  const freeGB = Math.max(totalGB - usedGB, 0);

  // Basit öneri: boş RAM'in %70'i, 2048-8192 MB arası yuvarla
  const suggestedMB = (() => {
    const target = Math.floor(Math.max(2048, Math.min(8192, freeGB * 1024 * 0.7)));
    // En az 4096 öner, eğer toplam >= 6GB ise
    if (totalGB >= 6 && target < 4096) return 4096;
    return target;
  })();

  const heapValue = typeof config.buildHeapMB === 'number' ? config.buildHeapMB : suggestedMB;

  // Önerilen değeri ilk gelişte config'e yaz (kullanıcı değiştirirse override eder)
  useEffect(() => {
    if (typeof config.buildHeapMB !== 'number' && suggestedMB > 0) {
      onConfigUpdate({ buildHeapMB: suggestedMB });
    }
  }, [config.buildHeapMB, suggestedMB, onConfigUpdate]);

  const suggestedEmail = config.domain ? `admin@${config.domain}` : '';
  useEffect(() => {
    if (config.sslEnable && !config.sslEmail && suggestedEmail) {
      onConfigUpdate({ sslEmail: suggestedEmail });
    }
  }, [config.sslEnable, config.sslEmail, suggestedEmail, onConfigUpdate]);

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

        {/* Build Bellek Limiti */}
        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/20 p-4 border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">Build Bellek Limiti (MB)</p>
              <p className="text-xs text-indigo-700 dark:text-indigo-300">Önerilen: {suggestedMB} MB (Toplam: {totalGB} GB, Boş: {Math.max(freeGB,0).toFixed(1)} GB)</p>
            </div>
            <div className="w-32">
              <Input
                type="number"
                min={2048}
                step={256}
                value={heapValue}
                onChange={(e) => onConfigUpdate({ buildHeapMB: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* Tip Kontrolü Seçeneği */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Tip kontrolünü build sırasında atla</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Düşük RAM ortamlarında önerilir. Next.js typescript denetimi devre dışı kalır.</p>
            </div>
            <Switch
              checked={Boolean(config.skipTypeCheckFrontend)}
              onCheckedChange={(v) => onConfigUpdate({ skipTypeCheckFrontend: Boolean(v) })}
            />
          </div>
        </div>

        {/* SSL Ayarları */}
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-4 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Let’s Encrypt ile SSL etkinleştir</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Ücretsiz sertifika alınır, 80 → 443 yönlendirmesi yapılır.</p>
            </div>
            <Switch
              checked={Boolean(config.sslEnable)}
              onCheckedChange={(v) => onConfigUpdate({ sslEnable: Boolean(v) })}
            />
          </div>
          {config.sslEnable && (
            <div className="mt-3">
              <label className="block text-xs mb-1 text-emerald-900 dark:text-emerald-200">Let’s Encrypt E-posta</label>
              <Input
                type="email"
                value={config.sslEmail || ''}
                onChange={(e) => onConfigUpdate({ sslEmail: e.target.value })}
                placeholder={suggestedEmail || 'admin@domain.com'}
              />
            </div>
          )}
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
