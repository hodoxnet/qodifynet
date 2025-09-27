"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSystemConfig } from "@/hooks/system/useSystemConfig";
import {
  Database,
  Server,
  FolderOpen,
  Save,
  TestTubes,
  Loader2,
  AlertCircle,
  CheckCircle
} from "lucide-react";

export function SystemConfigTab() {
  const {
    config,
    loading,
    saving,
    testingDb,
    testingRedis,
    updateConfig,
    saveConfig,
    testDatabase,
    testRedis,
  } = useSystemConfig();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Ayarlar yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Path Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <CardTitle>Yol Ayarları</CardTitle>
          </div>
          <CardDescription>
            Template dosyalarının bulunduğu dizin ayarları
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="templates-path">Templates Path</Label>
            <Input
              id="templates-path"
              placeholder="/var/qodify/templates veya /Users/.../templates"
              value={config.paths?.templates || ""}
              onChange={(e) =>
                updateConfig({
                  paths: { ...config.paths, templates: e.target.value },
                })
              }
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Template ZIP dosyalarının bulunduğu klasör. Altında stable/beta/archived dizinleri opsiyoneldir.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* PostgreSQL Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <CardTitle>PostgreSQL Ayarları</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Ana veritabanı bağlantı bilgileri
              </CardDescription>
            </div>
            <Button
              onClick={testDatabase}
              disabled={testingDb}
              variant="outline"
              size="sm"
            >
              {testingDb ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Test ediliyor...
                </>
              ) : (
                <>
                  <TestTubes className="h-4 w-4 mr-2" />
                  Bağlantıyı Test Et
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="db-host">Host</Label>
              <Input
                id="db-host"
                placeholder="localhost"
                value={config.db?.host || ""}
                onChange={(e) =>
                  updateConfig({
                    db: { ...config.db, host: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-port">Port</Label>
              <Input
                id="db-port"
                type="number"
                placeholder="5432"
                value={config.db?.port ?? ""}
                onChange={(e) =>
                  updateConfig({
                    db: {
                      ...config.db,
                      port: Number(e.target.value) || undefined,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-user">Kullanıcı</Label>
              <Input
                id="db-user"
                placeholder="postgres"
                value={config.db?.user || ""}
                onChange={(e) =>
                  updateConfig({
                    db: { ...config.db, user: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-password">Şifre</Label>
              <Input
                id="db-password"
                type="password"
                placeholder="••••••••"
                value={config.db?.password || ""}
                onChange={(e) =>
                  updateConfig({
                    db: { ...config.db, password: e.target.value },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Redis Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <Server className="h-4 w-4 text-red-600 dark:text-red-400" />
                <CardTitle>Redis Ayarları</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Cache sunucu bağlantı bilgileri
              </CardDescription>
            </div>
            <Button
              onClick={testRedis}
              disabled={testingRedis}
              variant="outline"
              size="sm"
            >
              {testingRedis ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Test ediliyor...
                </>
              ) : (
                <>
                  <TestTubes className="h-4 w-4 mr-2" />
                  Bağlantıyı Test Et
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="redis-host">Host</Label>
              <Input
                id="redis-host"
                placeholder="localhost"
                value={config.redis?.host || ""}
                onChange={(e) =>
                  updateConfig({
                    redis: { ...config.redis, host: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="redis-port">Port</Label>
              <Input
                id="redis-port"
                type="number"
                placeholder="6379"
                value={config.redis?.port ?? ""}
                onChange={(e) =>
                  updateConfig({
                    redis: {
                      ...config.redis,
                      port: Number(e.target.value) || undefined,
                    },
                  })
                }
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="redis-prefix">Prefix</Label>
              <Input
                id="redis-prefix"
                placeholder="qodify_ veya domain_"
                value={config.redis?.prefix || ""}
                onChange={(e) =>
                  updateConfig({
                    redis: { ...config.redis, prefix: e.target.value },
                  })
                }
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Redis key&apos;leri için önek. Birden fazla uygulama aynı Redis&apos;i kullanıyorsa önemlidir.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Bilgi:</strong> Bu ayarlar Smart Environment Management ile uyumludur.
          Değişiklikler kaydedildikten sonra sistemin yeniden başlatılması gerekebilir.
        </AlertDescription>
      </Alert>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={saveConfig}
          disabled={saving}
          className="min-w-[140px]"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Ayarları Kaydet
            </>
          )}
        </Button>
      </div>
    </div>
  );
}