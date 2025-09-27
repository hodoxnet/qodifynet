"use client";

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  }, [open, customer]);

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Müşteri Bilgileri
          </DialogTitle>
          <div className="flex items-center gap-2 mt-1.5">
            <Globe className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {customer.domain}
            </span>
            {isLocalCustomer && (
              <Badge variant="secondary" className="ml-2">
                Local
              </Badge>
            )}
            {customer.mode === "production" && (
              <Badge variant="default" className="ml-2">
                Production
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Port Bilgileri */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Uygulama Portları
              </h3>
              <div className="flex gap-4 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Backend: <span className="font-mono">{customer.ports.backend}</span>
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  Admin: <span className="font-mono">{customer.ports.admin}</span>
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  Store: <span className="font-mono">{customer.ports.store}</span>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Servis Sağlığı */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Servis Sağlığı
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {loading
                      ? "Kontrol ediliyor..."
                      : lastChecked
                      ? `Son kontrol: ${lastChecked.toLocaleTimeString()}`
                      : "Henüz kontrol edilmedi"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => checkHealth()}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {(["backend", "admin", "store"] as const).map((service) => {
                  const status = getServiceStatus(service);
                  const Icon = status.icon;

                  return (
                    <div
                      key={service}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", status.color)} />
                        <span className="capitalize font-medium text-sm">
                          {service}:
                        </span>
                        <span
                          className={cn(
                            "text-xs",
                            status.color.replace("text-", "text-opacity-80 text-")
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenLogs(service)}
                        className="h-7"
                      >
                        <Terminal className="h-3 w-3 mr-1" />
                        Logs
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Direkt URL'ler */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Direkt URL&apos;ler
              </h3>
              <div className="flex items-center gap-3">
                {Object.entries(urls).map(([key, url]) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Veritabanı Bilgileri */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Veritabanı
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Host: </span>
                  <span className="font-mono">{customer.db?.host || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Port: </span>
                  <span className="font-mono">{customer.db?.port ?? "-"}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Veritabanı: </span>
                  <span className="font-mono">{customer.db?.name || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Kullanıcı: </span>
                  <span className="font-mono">{customer.db?.user || "-"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600 dark:text-gray-400">Şema: </span>
                  <span className="font-mono">{customer.db?.schema || "public"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Redis Bilgileri */}
          {customer.redis && (
            <Card>
              <CardContent className="pt-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Redis
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Host: </span>
                    <span className="font-mono">{customer.redis.host}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Port: </span>
                    <span className="font-mono">{customer.redis.port}</span>
                  </div>
                  {customer.redis.prefix && (
                    <div className="col-span-2">
                      <span className="text-gray-600 dark:text-gray-400">Prefix: </span>
                      <span className="font-mono">{customer.redis.prefix}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}