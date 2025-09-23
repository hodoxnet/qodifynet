"use client";

import { useState } from "react";
import { CheckCircle, XCircle, AlertCircle, Loader2, Database, Server, Globe, Activity, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";

interface SystemStatusProps {
  status: {
    postgres: string;
    redis: string;
    nginx: string;
    pm2: string;
  };
  onRefresh?: () => void;
}

export function SystemStatus({ status, onRefresh }: SystemStatusProps) {
  const [installing, setInstalling] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [osModalOpen, setOsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "checking":
        return <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "running":
        return "Çalışıyor";
      case "error":
        return "Hata";
      case "warning":
        return "Uyarı";
      case "checking":
        return "Kontrol ediliyor...";
      default:
        return "Bilinmiyor";
    }
  };

  const handleRetry = async (service: string) => {
    setChecking(service);
    try {
      const response = await fetch(`http://localhost:3031/api/system/check/${service}`, {
        method: "POST",
      });
      const data = await response.json();

      if (data.status === "running") {
        toast.success(`${service} servisi çalışıyor!`);
      } else {
        toast.error(`${service} servisi hala çalışmıyor`);
      }

      if (onRefresh) {
        onRefresh();
      }
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
      const response = await fetch(`http://localhost:3031/api/system/install/${selectedService}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ os }),
      });

      if (response.ok) {
        toast.success(`${selectedService} kurulumu başlatıldı`);

        // Wait a bit and then check status
        setTimeout(() => {
          if (onRefresh) {
            onRefresh();
          }
        }, 3000);
      } else {
        toast.error("Kurulum başlatılamadı");
      }
    } catch (error) {
      toast.error("Kurulum sırasında hata oluştu");
    } finally {
      setInstalling(null);
    }
  };

  const services = [
    { key: "postgres", label: "PostgreSQL", icon: Database },
    { key: "redis", label: "Redis Cache", icon: Server },
    { key: "nginx", label: "Nginx", icon: Globe },
    { key: "pm2", label: "PM2", icon: Activity },
  ];

  // Check if any service is checking
  const isAnyServiceChecking = Object.values(status).some(s => s === "checking");

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Sistem Durumu</h2>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Progress bar for checking status */}
          {isAnyServiceChecking && (
            <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
              <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: "100%" }}>
                <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 animate-shimmer" />
              </div>
            </div>
          )}
        </div>
        <div className="p-4 space-y-3">
          {services.map(({ key, label, icon: Icon }) => (
            <div
              key={key}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Icon className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">{label}</span>
              </div>
              <div className="flex items-center space-x-2">
                {status[key as keyof typeof status] === "error" && (
                  <>
                    <button
                      onClick={() => handleRetry(key)}
                      disabled={checking === key}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                      title="Tekrar Dene"
                    >
                      {checking === key ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleInstall(key)}
                      disabled={installing === key}
                      className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                      title="Kur"
                    >
                      {installing === key ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                  </>
                )}
                {getStatusIcon(
                  checking === key
                    ? "checking"
                    : installing === key
                    ? "checking"
                    : status[key as keyof typeof status]
                )}
                <span className="text-sm text-gray-600 min-w-[80px]">
                  {checking === key
                    ? "Kontrol ediliyor..."
                    : installing === key
                    ? "Kuruluyor..."
                    : getStatusText(status[key as keyof typeof status])
                  }
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* OS Selection Modal */}
      {osModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              İşletim Sistemi Seçin
            </h3>
            <p className="text-gray-600 mb-4">
              {selectedService} kurulumu için işletim sisteminizi seçin:
            </p>
            <div className="space-y-2">
              <button
                onClick={() => installService("macos")}
                className="w-full p-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium">macOS</span>
                <span className="text-sm text-gray-500 block">Homebrew ile kurulum</span>
              </button>
              <button
                onClick={() => installService("ubuntu")}
                className="w-full p-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium">Ubuntu/Debian</span>
                <span className="text-sm text-gray-500 block">APT ile kurulum</span>
              </button>
              <button
                onClick={() => installService("centos")}
                className="w-full p-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium">CentOS/RHEL</span>
                <span className="text-sm text-gray-500 block">YUM ile kurulum</span>
              </button>
            </div>
            <button
              onClick={() => setOsModalOpen(false)}
              className="w-full mt-4 p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      )}
    </>
  );
}