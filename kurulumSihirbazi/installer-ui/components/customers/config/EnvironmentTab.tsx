"use client";

import { Server, Monitor, ShoppingBag, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EnvField } from "./EnvField";
import { CustomerEnvConfig } from "@/hooks/customers/useCustomerConfig";

interface EnvironmentTabProps {
  service: "backend" | "admin" | "store";
  envConfig: CustomerEnvConfig;
  modifiedValues: Record<string, Record<string, string>>;
  restarting: string | null;
  onValueChange: (service: string, key: string, value: string) => void;
  onRestartService: (service: string) => void;
}

const SERVICE_INFO = {
  backend: {
    title: "Backend API",
    icon: Server,
    description: "API servisi ve veritabanı işlemleri",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
  },
  admin: {
    title: "Admin Panel",
    icon: Monitor,
    description: "Yönetim paneli arayüzü",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  store: {
    title: "Store",
    icon: ShoppingBag,
    description: "Müşteri mağaza arayüzü",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20",
  },
};

export function EnvironmentTab({
  service,
  envConfig,
  modifiedValues,
  restarting,
  onValueChange,
  onRestartService,
}: EnvironmentTabProps) {
  const info = SERVICE_INFO[service];
  const Icon = info.icon;
  const serviceConfig = envConfig.config[service];

  if (!serviceConfig) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <Icon className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">Bu servis için konfigürasyon bulunamadı.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const configEntries = Object.entries(serviceConfig).filter(([_, value]) => value !== undefined);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${info.bgColor}`}>
                <Icon className={`h-5 w-5 ${info.color}`} />
              </div>
              <div>
                <CardTitle className="text-lg">{info.title} Konfigürasyonu</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {info.description}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRestartService(service)}
              disabled={restarting !== null}
              className="gap-2"
            >
              {restarting === service ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Yeniden Başlatılıyor...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Servisi Yeniden Başlat
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          <ScrollArea className="h-[500px] pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {configEntries.map(([key, value]) => (
                <EnvField
                  key={`${service}-${key}`}
                  service={service}
                  fieldKey={key}
                  value={value}
                  currentValue={modifiedValues[service]?.[key] ?? value ?? ""}
                  isModified={modifiedValues[service]?.[key] !== undefined}
                  onChange={onValueChange}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="text-gray-600 dark:text-gray-400">Kritik Alanlar</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-gray-600 dark:text-gray-400">Değiştirilmiş Alanlar</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="text-gray-500 dark:text-gray-400">
              Port: <span className="font-mono font-semibold">{envConfig.ports[service]}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}