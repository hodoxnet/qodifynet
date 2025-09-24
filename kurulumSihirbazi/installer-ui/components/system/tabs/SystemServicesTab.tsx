"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSystemStatus } from "@/hooks/system/useSystemStatus";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Database,
  Server,
  Globe,
  Activity,
  RefreshCw,
  Download,
  AlertTriangle
} from "lucide-react";

export function SystemServicesTab() {
  const { status, loading, refreshStatus } = useSystemStatus();
  const [checking, setChecking] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [osModalOpen, setOsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const services = [
    {
      key: "postgres",
      label: "PostgreSQL",
      description: "İlişkisel veritabanı yönetim sistemi",
      icon: Database,
      color: "blue",
    },
    {
      key: "redis",
      label: "Redis Cache",
      description: "Bellek içi veri yapı deposu",
      icon: Server,
      color: "red",
    },
    {
      key: "nginx",
      label: "Nginx",
      description: "Web sunucusu ve reverse proxy",
      icon: Globe,
      color: "green",
    },
    {
      key: "pm2",
      label: "PM2",
      description: "Node.js process yöneticisi",
      icon: Activity,
      color: "purple",
    },
  ];

  const getStatusIcon = (serviceStatus: string) => {
    switch (serviceStatus) {
      case "running":
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case "checking":
        return <Loader2 className="h-5 w-5 animate-spin text-gray-400" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (serviceStatus: string) => {
    switch (serviceStatus) {
      case "running":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">Çalışıyor</Badge>;
      case "error":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">Hata</Badge>;
      case "warning":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">Uyarı</Badge>;
      case "checking":
        return <Badge variant="secondary">Kontrol ediliyor...</Badge>;
      default:
        return <Badge variant="outline">Bilinmiyor</Badge>;
    }
  };

  const handleRetry = async (service: string) => {
    setChecking(service);
    try {
      const response = await apiFetch(`/api/system/check/${service}`, { method: "POST" });
      const data = await response.json();

      if (data.status === "running") {
        toast.success(`${service} servisi çalışıyor!`);
      } else {
        toast.error(`${service} servisi hala çalışmıyor`);
      }

      refreshStatus();
    } catch (error) {
      toast.error("Kontrol sırasında hata oluştu");
    } finally {
      setChecking(null);
    }
  };

  const handleInstall = (service: string) => {
    setSelectedService(service);
    setOsModalOpen(true);
  };

  const installService = async (os: string) => {
    if (!selectedService) return;

    setOsModalOpen(false);
    setInstalling(selectedService);

    try {
      const response = await apiFetch(`/api/system/install/${selectedService}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ os }),
      });

      if (response.ok) {
        toast.success(`${selectedService} kurulumu başlatıldı`);
        setTimeout(refreshStatus, 3000);
      } else {
        toast.error("Kurulum başlatılamadı");
      }
    } catch (error) {
      toast.error("Kurulum sırasında hata oluştu");
    } finally {
      setInstalling(null);
    }
  };

  const isAnyServiceChecking = Object.values(status).some(s => s === "checking");

  return (
    <>
      <div className="space-y-6">
        {/* Status Summary */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Servis Durumları</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sistem servislerinin anlık durumu
            </p>
          </div>
          <Button
            onClick={refreshStatus}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>

        {/* Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map(({ key, label, description, icon: Icon }) => {
            const serviceStatus = status[key as keyof typeof status];
            const isError = serviceStatus === "error";

            return (
              <Card key={key} className={isError ? "border-red-200 dark:border-red-900/50" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-br from-${key === "postgres" ? "blue" : key === "redis" ? "red" : key === "nginx" ? "green" : "purple"}-100 to-${key === "postgres" ? "blue" : key === "redis" ? "red" : key === "nginx" ? "green" : "purple"}-200 dark:from-${key === "postgres" ? "blue" : key === "redis" ? "red" : key === "nginx" ? "green" : "purple"}-900/20 dark:to-${key === "postgres" ? "blue" : key === "redis" ? "red" : key === "nginx" ? "green" : "purple"}-800/20`}>
                        <Icon className={`h-5 w-5 text-${key === "postgres" ? "blue" : key === "redis" ? "red" : key === "nginx" ? "green" : "purple"}-600 dark:text-${key === "postgres" ? "blue" : key === "redis" ? "red" : key === "nginx" ? "green" : "purple"}-400`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{label}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {description}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(serviceStatus)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(checking === key ? "checking" : installing === key ? "checking" : serviceStatus)}
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {checking === key
                          ? "Kontrol ediliyor..."
                          : installing === key
                          ? "Kuruluyor..."
                          : serviceStatus === "running"
                          ? "Servis aktif"
                          : serviceStatus === "error"
                          ? "Servis çalışmıyor"
                          : "Durum bilinmiyor"}
                      </span>
                    </div>
                    {isError && (
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => handleRetry(key)}
                          disabled={checking === key}
                          variant="ghost"
                          size="sm"
                        >
                          {checking === key ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Test
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleInstall(key)}
                          disabled={installing === key}
                          variant="ghost"
                          size="sm"
                        >
                          {installing === key ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-1" />
                              Kur
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Status Info */}
        {Object.values(status).some(s => s === "error") && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/50">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              <strong>Dikkat:</strong> Bazı servisler çalışmıyor. Sisteminizin düzgün çalışması için tüm servislerin aktif olması gerekir.
            </AlertDescription>
          </Alert>
        )}

        {/* Progress Indicator */}
        {isAnyServiceChecking && (
          <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm">Servisler kontrol ediliyor...</span>
          </div>
        )}
      </div>

      {/* OS Selection Modal */}
      {osModalOpen && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle>İşletim Sistemi Seçin</CardTitle>
              <CardDescription>
                {selectedService} kurulumu için işletim sisteminizi seçin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={() => installService("macos")}
                variant="outline"
                className="w-full justify-start"
              >
                <span className="font-medium">macOS</span>
                <span className="text-sm text-gray-500 ml-auto">Homebrew ile kurulum</span>
              </Button>
              <Button
                onClick={() => installService("ubuntu")}
                variant="outline"
                className="w-full justify-start"
              >
                <span className="font-medium">Ubuntu/Debian</span>
                <span className="text-sm text-gray-500 ml-auto">APT ile kurulum</span>
              </Button>
              <Button
                onClick={() => installService("centos")}
                variant="outline"
                className="w-full justify-start"
              >
                <span className="font-medium">CentOS/RHEL</span>
                <span className="text-sm text-gray-500 ml-auto">YUM ile kurulum</span>
              </Button>
              <Button
                onClick={() => setOsModalOpen(false)}
                variant="ghost"
                className="w-full"
              >
                İptal
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}