"use client";

import {
  Globe,
  Home,
  CheckCircle,
  XCircle,
  Loader2,
  Search
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { SetupConfig } from '@/lib/types/setup';
import { useInstallation } from '@/hooks/setup/useInstallation';
import { useDNSCheck } from '@/hooks/setup/useDNSCheck';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface SiteConfigStepProps {
  config: SetupConfig;
  onConfigUpdate: (updates: Partial<SetupConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function SiteConfigStep({ config, onConfigUpdate, onNext, onBack }: SiteConfigStepProps) {
  const { user, hasScope } = useAuth();
  const { isLocalDomain } = useInstallation();
  const { testResult, loading: dnsChecking, checkDNS, resetTest } = useDNSCheck();
  const isLocal = config.domain ? isLocalDomain(config.domain) : false;
  const isStaff = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isPartner = !isStaff && (hasScope('setup.run') || !!user?.partnerId || (user?.role || '').startsWith('PARTNER_'));

  // Domain değiştiğinde DNS test sonucunu sıfırla
  useEffect(() => {
    resetTest();
  }, [config.domain, resetTest]);

  const handleDNSCheck = () => {
    checkDNS(config.domain);
  };

  const installSource = config.installSource || 'template';

  const sourceValid = installSource === 'git'
    ? Boolean(config.gitRepoUrl)
    : Boolean(config.templateVersion);

  const isFormValid = (isPartner
    ? Boolean(config.domain && config.storeName)
    : Boolean(
        config.domain &&
        config.storeName &&
        config.dbName &&
        config.appDbUser &&
        config.appDbPassword
      )) && sourceValid;

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-teal-100 to-green-100 dark:from-teal-900/50 dark:to-green-900/50">
          <Globe className="h-10 w-10 text-teal-600 dark:text-teal-400" />
        </div>
        <CardTitle className="text-2xl">Site Bilgileri</CardTitle>
        <CardDescription>
          Kurulacak sitenin bilgilerini girin
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Site Bilgileri */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <div className="flex gap-2">
              <Input
                id="domain"
                type="text"
                value={config.domain}
                onChange={(e) => onConfigUpdate({ domain: e.target.value })}
                placeholder="example.com veya test1 (local)"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleDNSCheck}
                disabled={!config.domain || dnsChecking}
                className="min-w-[120px]"
              >
                {dnsChecking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Kontrol...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    DNS Kontrol
                  </>
                )}
              </Button>
            </div>

            {/* Local mode uyarısı */}
            {isLocal && !testResult && (
              <Alert className="mt-2 border-sky-200 bg-sky-50">
                <Home className="h-4 w-4 text-sky-600" />
                <AlertDescription className="text-sky-700">
                  Local Mode - DNS kontrolü atlanacak
                </AlertDescription>
              </Alert>
            )}

            {/* DNS test sonucu */}
            {testResult && (
              <Alert
                className={
                  testResult.valid
                    ? "mt-2 border-emerald-200 bg-emerald-50"
                    : "mt-2 border-rose-200 bg-rose-50"
                }
              >
                <div className="flex items-center space-x-2">
                  {testResult.valid ? (
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-500" />
                  )}
                  <AlertDescription
                    className={
                      testResult.valid ? "text-emerald-700" : "text-rose-700"
                    }
                  >
                    {testResult.message}
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-name">Mağaza Adı</Label>
            <Input
              id="store-name"
              type="text"
              value={config.storeName}
              onChange={(e) => onConfigUpdate({ storeName: e.target.value })}
              placeholder="Örnek Mağaza"
            />
          </div>
        </div>

        {!isPartner && (
          <>
            <Separator />

            {/* Veritabanı Bilgileri - Sadece ADMIN/SUPER_ADMIN */}
            <div className="space-y-4">
              <h3 className="font-medium">Veritabanı Ayarları</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="db-name">Veritabanı Adı</Label>
                  <Input
                    id="db-name"
                    type="text"
                    value={config.dbName}
                    onChange={(e) => onConfigUpdate({ dbName: e.target.value })}
                    placeholder="qodify_example_com"
                  />
                  <p className="text-xs text-gray-500">Otomatik önerildi</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="app-db-user">Uygulama DB Kullanıcısı</Label>
                  <Input
                    id="app-db-user"
                    type="text"
                    value={config.appDbUser}
                    onChange={(e) => onConfigUpdate({ appDbUser: e.target.value })}
                    placeholder="qodify_user"
                  />
                  <p className="text-xs text-gray-500">Yeni oluşturulacak</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="app-db-password">Uygulama DB Şifresi</Label>
                <Input
                  id="app-db-password"
                  type="password"
                  value={config.appDbPassword}
                  onChange={(e) => onConfigUpdate({ appDbPassword: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="install-source">Kurulum Kaynağı</Label>
            <Select
              value={installSource}
              onValueChange={(value) => onConfigUpdate({ installSource: value as SetupConfig['installSource'] })}
            >
              <SelectTrigger id="install-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="template">Hazır Template Paketleri</SelectItem>
                <SelectItem value="git">Git Deposu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {installSource === 'template' ? (
            <div className="space-y-2">
              <Label htmlFor="template-version">Template Versiyonu</Label>
              <Select
                value={config.templateVersion}
                onValueChange={(value) => onConfigUpdate({ templateVersion: value })}
              >
                <SelectTrigger id="template-version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">En Güncel (v2.4.0)</SelectItem>
                  <SelectItem value="2.3.0">v2.3.0</SelectItem>
                  <SelectItem value="2.2.0">v2.2.0</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="git-repo">Git Depo URL</Label>
                <Input
                  id="git-repo"
                  type="text"
                  value={config.gitRepoUrl || ''}
                  onChange={(e) => onConfigUpdate({ gitRepoUrl: e.target.value })}
                  placeholder="https://github.com/qodify/example-repo.git"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="git-branch">Branch</Label>
                  <Input
                    id="git-branch"
                    type="text"
                    value={config.gitBranch || ''}
                    onChange={(e) => onConfigUpdate({ gitBranch: e.target.value })}
                    placeholder="main"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="git-depth">Clone Derinliği</Label>
                  <Input
                    id="git-depth"
                    type="number"
                    min={1}
                    value={config.gitDepth ?? 1}
                    onChange={(e) => onConfigUpdate({ gitDepth: Number(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="git-username">Git Kullanıcı Adı (opsiyonel)</Label>
                  <Input
                    id="git-username"
                    type="text"
                    value={config.gitUsername || ''}
                    onChange={(e) => onConfigUpdate({ gitUsername: e.target.value })}
                    placeholder="deploy-user"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="git-token">Erişim Token'ı (opsiyonel)</Label>
                  <Input
                    id="git-token"
                    type="password"
                    value={config.gitAccessToken || ''}
                    onChange={(e) => onConfigUpdate({ gitAccessToken: e.target.value })}
                    placeholder="ghp_..."
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Özel depolara erişim için gerekli varsayılan tokenı Git Ayarları sekmesinden tanımlayabilirsiniz.
                Buraya gireceğiniz değer yalnızca bu kurulum için geçici olarak kullanılır.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <Button
            onClick={onBack}
            variant="outline"
          >
            Geri
          </Button>
          <Button
            onClick={onNext}
            disabled={!isFormValid}
          >
            Devam Et
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
