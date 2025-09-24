"use client";

import { useState } from 'react';
import {
  Database,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDatabaseConnection } from '@/hooks/setup/useDatabaseConnection';
import { SetupConfig } from '@/lib/types/setup';

interface DatabaseStepProps {
  config: SetupConfig;
  onConfigUpdate: (updates: Partial<SetupConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DatabaseStep({ config, onConfigUpdate, onNext, onBack }: DatabaseStepProps) {
  const { testResult, loading, testDatabase, canProceed } = useDatabaseConnection();

  const handleTest = async () => {
    await testDatabase({
      dbHost: config.dbHost,
      dbPort: config.dbPort,
      dbUser: config.dbUser,
      dbPassword: config.dbPassword
    });
  };

  const isFormValid = config.dbUser && config.dbPassword;

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50">
          <Database className="h-10 w-10 text-blue-600 dark:text-blue-400" />
        </div>
        <CardTitle className="text-2xl">PostgreSQL Yapılandırması</CardTitle>
        <CardDescription>
          Veritabanı bağlantı bilgilerini girin
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="db-host">Host</Label>
            <Input
              id="db-host"
              type="text"
              value={config.dbHost}
              onChange={(e) => onConfigUpdate({ dbHost: e.target.value })}
              placeholder="localhost"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="db-port">Port</Label>
            <Input
              id="db-port"
              type="number"
              value={config.dbPort}
              onChange={(e) => onConfigUpdate({ dbPort: Number(e.target.value) })}
              placeholder="5432"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="db-user">Kullanıcı (Admin)</Label>
            <Input
              id="db-user"
              type="text"
              value={config.dbUser}
              onChange={(e) => onConfigUpdate({ dbUser: e.target.value })}
              placeholder="postgres"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="db-password">Şifre (Admin)</Label>
            <Input
              id="db-password"
              type="password"
              value={config.dbPassword}
              onChange={(e) => onConfigUpdate({ dbPassword: e.target.value })}
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button
          onClick={handleTest}
          disabled={loading || !isFormValid}
          className="w-full"
          variant="secondary"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Test Ediliyor...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Bağlantıyı Test Et
            </>
          )}
        </Button>

        {testResult && (
          <Alert
            className={
              testResult.ok
                ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50"
            }
          >
            <div className="flex items-center space-x-2">
              {testResult.ok ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-rose-500" />
              )}
              <AlertDescription
                className={testResult.ok ? "text-emerald-700" : "text-rose-700"}
              >
                <strong>{testResult.message}</strong>
                {testResult.version && (
                  <span className="ml-2 text-sm">
                    PostgreSQL {testResult.version}
                  </span>
                )}
              </AlertDescription>
            </div>
          </Alert>
        )}

        <div className="flex justify-between">
          <Button
            onClick={onBack}
            variant="outline"
          >
            Geri
          </Button>
          <Button
            onClick={onNext}
            disabled={!canProceed()}
          >
            Devam Et
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}