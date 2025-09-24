"use client";

import {
  Database,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRedisConnection } from '@/hooks/setup/useRedisConnection';
import { SetupConfig } from '@/lib/types/setup';

interface RedisStepProps {
  config: SetupConfig;
  onConfigUpdate: (updates: Partial<SetupConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function RedisStep({ config, onConfigUpdate, onNext, onBack }: RedisStepProps) {
  const { testResult, loading, testRedis } = useRedisConnection();

  const handleTest = async () => {
    await testRedis(config.redisHost, config.redisPort);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/50 dark:to-red-900/50">
          <Database className="h-10 w-10 text-orange-600 dark:text-orange-400" />
        </div>
        <CardTitle className="text-2xl">Redis Yapılandırması</CardTitle>
        <CardDescription>
          Cache sunucu bilgilerini girin
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="redis-host">Host</Label>
            <Input
              id="redis-host"
              type="text"
              value={config.redisHost}
              onChange={(e) => onConfigUpdate({ redisHost: e.target.value })}
              placeholder="localhost"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="redis-port">Port</Label>
            <Input
              id="redis-port"
              type="number"
              value={config.redisPort}
              onChange={(e) => onConfigUpdate({ redisPort: Number(e.target.value) })}
              placeholder="6379"
            />
          </div>
        </div>

        <Button
          onClick={handleTest}
          disabled={loading}
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
              Redis Bağlantısını Test Et
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
                    Redis {testResult.version}
                  </span>
                )}
              </AlertDescription>
            </div>
          </Alert>
        )}

        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            <strong>Not:</strong> Redis bağlantısı başarısız olursa uygulama yine çalışır
            ancak performans düşük olabilir.
          </AlertDescription>
        </Alert>

        <div className="flex justify-between">
          <Button
            onClick={onBack}
            variant="outline"
          >
            Geri
          </Button>
          <Button
            onClick={onNext}
          >
            Devam Et
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}