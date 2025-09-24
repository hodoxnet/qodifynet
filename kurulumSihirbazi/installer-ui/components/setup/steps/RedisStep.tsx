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
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <Database className="h-10 w-10 text-gray-600" />
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
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }
          >
            <div className="flex items-center space-x-2">
              {testResult.ok ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <AlertDescription
                className={testResult.ok ? "text-green-800" : "text-red-800"}
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

        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
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