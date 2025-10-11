"use client";

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  AlertCircle,
  Terminal,
  RefreshCw,
  ExternalLink,
  Database,
  Server,
  Globe,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Customer } from "@/hooks/customers/useCustomerList";
import { useCustomerHealth } from "@/hooks/customers/useCustomerHealth";

interface CustomerInfoDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenLogs: (service: "backend" | "admin" | "store") => void;
}

export function CustomerInfoDialog({
  customer,
  open,
  onOpenChange,
  onOpenLogs,
}: CustomerInfoDialogProps) {
  const { health, loading, lastChecked, checkHealth, reset } = useCustomerHealth({
    customerId: customer?.id,
  });

  useEffect(() => {
    if (open && customer) {
      checkHealth();
    } else {
      reset();
    }
  }, [open, customer, checkHealth, reset]);

  if (!customer) return null;

  const isLocalCustomer =
    customer.mode === "local" ||
    !customer.domain.includes(".") ||
    customer.domain.endsWith(".local");

  const getUrls = () => {
    if (isLocalCustomer) {
      return {
        store: `http://localhost:${customer.ports.store}`,
        admin: `http://localhost:${customer.ports.admin}/admin/login`,
        api: `http://localhost:${customer.ports.backend}/api/health`,
      };
    }
    return {
      store: `https://${customer.domain}`,
      admin: `https://${customer.domain}/admin/login`,
      api: `https://${customer.domain}/api/health`,
    };
  };

  const urls = getUrls();

  const getServiceStatus = (service: "backend" | "admin" | "store") => {
    const serviceHealth = health?.[service];
    if (!serviceHealth) return { icon: AlertCircle, color: "text-gray-400", label: "Bilinmiyor" };

    switch (serviceHealth.status) {
      case "healthy":
        return {
          icon: CheckCircle,
          color: "text-green-500 dark:text-green-400",
          label: `OK (HTTP ${serviceHealth.httpCode || "200"})`,
        };
      case "stopped":
        return {
          icon: AlertCircle,
          color: "text-gray-400",
          label: "Durduruldu",
        };
      default:
        return {
          icon: AlertCircle,
          color: "text-red-500 dark:text-red-400",
          label: serviceHealth.error || "HATA",
        };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        {/* Sabit Header */}
        <DialogHeader className="space-y-4 px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Server className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              Müşteri Bilgileri
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isLocalCustomer && (
                <Badge variant="secondary" className="px-3 py-1">
                  Local
                </Badge>
              )}
              {customer.mode === "production" && (
                <Badge variant="default" className="px-3 py-1">
                  Production
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
              {customer.domain}
            </span>
          </div>
        </DialogHeader>

        {/* Scroll Edilebilir İçerik */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
          {/* Servis Sağlığı - En Üstte ve Geniş */}
          <Card className="border-2 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Servis Sağlığı
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {loading
                      ? "Kontrol ediliyor..."
                      : lastChecked
                      ? `Son kontrol: ${lastChecked.toLocaleTimeString()}`
                      : "Henüz kontrol edilmedi"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => checkHealth()}
                    disabled={loading}
                    className="px-4"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Yenile
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(["backend", "admin", "store"] as const).map((service) => {
                  const status = getServiceStatus(service);
                  const Icon = status.icon;

                  return (
                    <div
                      key={service}
                      className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-5 w-5", status.color)} />
                          <span className="capitalize font-semibold text-base text-gray-900 dark:text-gray-100">
                            {service}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div
                          className={cn(
                            "text-sm font-medium",
                            status.color
                          )}
                        >
                          {status.label}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenLogs(service)}
                          className="w-full justify-start h-8 text-xs"
                        >
                          <Terminal className="h-3 w-3 mr-2" />
                          Log Görüntüle
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Redis Health Check Card */}
                {customer.redis && health?.redis && (
                  <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {health.redis.status === "healthy" ? (
                          <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
                        )}
                        <span className="font-semibold text-base text-gray-900 dark:text-gray-100">
                          Redis
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {health.redis.status === "healthy" ? (
                        <div className="text-sm font-medium text-green-500 dark:text-green-400">
                          Bağlı
                        </div>
                      ) : (
                        <div className="text-xs text-red-600 dark:text-red-400 break-words">
                          {health.redis.error}
                        </div>
                      )}
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                        {health.redis.url}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* İki Kolonlu Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sol Kolon */}
            <div className="space-y-6">
              {/* Port Bilgileri */}
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Server className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Uygulama Portları
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Backend</span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                        {customer.ports.backend}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Admin</span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                        {customer.ports.admin}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Store</span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                        {customer.ports.store}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Veritabanı Bilgileri */}
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      PostgreSQL
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Host</div>
                      <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {customer.db?.host || "-"}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Port</div>
                        <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                          {customer.db?.port ?? "-"}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Şema</div>
                        <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                          {customer.db?.schema || "public"}
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Veritabanı</div>
                      <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {customer.db?.name || "-"}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kullanıcı</div>
                      <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {customer.db?.user || "-"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sağ Kolon */}
            <div className="space-y-6">
              {/* Direkt URL'ler */}
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <ExternalLink className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Hızlı Erişim
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(urls).map(([key, url]) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                      >
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[200px]">
                            {url}
                          </span>
                          <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Redis Bilgileri */}
              {customer.redis && (
                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <Database className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        Redis Cache
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Host</div>
                        <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                          {customer.redis.host}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Port</div>
                        <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                          {customer.redis.port}
                        </div>
                      </div>
                      {customer.redis.prefix && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Prefix</div>
                          <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                            {customer.redis.prefix}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          </div>
        </div>

        {/* Sabit Footer */}
        <DialogFooter className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              ID: <span className="font-mono text-xs">{customer.id}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Kapat
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
