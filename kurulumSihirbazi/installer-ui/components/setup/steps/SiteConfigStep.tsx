"use client";

import {
  Globe,
  Home
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

interface SiteConfigStepProps {
  config: SetupConfig;
  onConfigUpdate: (updates: Partial<SetupConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function SiteConfigStep({ config, onConfigUpdate, onNext, onBack }: SiteConfigStepProps) {
  const { isLocalDomain } = useInstallation();
  const isLocal = config.domain ? isLocalDomain(config.domain) : false;

  const isFormValid =
    config.domain &&
    config.storeName &&
    config.dbName &&
    config.adminEmail &&
    config.adminPassword &&
    config.appDbUser &&
    config.appDbPassword;

  return (
    <Card className="w-full max-w-3xl mx-auto">
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
            <Input
              id="domain"
              type="text"
              value={config.domain}
              onChange={(e) => onConfigUpdate({ domain: e.target.value })}
              placeholder="example.com veya test1 (local)"
            />
            {isLocal && (
              <Alert className="mt-2 border-sky-200 bg-sky-50">
                <Home className="h-4 w-4 text-sky-600" />
                <AlertDescription className="text-sky-700">
                  Local Mode - DNS kontrolü atlanacak
                </AlertDescription>
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

        <Separator />

        {/* Veritabanı Bilgileri */}
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

        <Separator />

        {/* Admin Kullanıcısı */}
        <div className="space-y-4">
          <h3 className="font-medium">Admin Kullanıcısı</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Admin E-posta</Label>
              <Input
                id="admin-email"
                type="email"
                value={config.adminEmail}
                onChange={(e) => onConfigUpdate({ adminEmail: e.target.value })}
                placeholder="admin@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Admin Şifresi</Label>
              <Input
                id="admin-password"
                type="password"
                value={config.adminPassword}
                onChange={(e) => onConfigUpdate({ adminPassword: e.target.value })}
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Template Versiyonu */}
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