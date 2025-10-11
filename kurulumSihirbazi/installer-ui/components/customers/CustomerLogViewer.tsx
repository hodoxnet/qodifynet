"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Terminal,
  RefreshCw,
  Download,
  Loader2,
  Copy,
  CheckCircle,
  Pause,
  Play,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomerLogs, ServiceType } from "@/hooks/customers/useCustomerLogs";
import { toast } from "sonner";

interface CustomerLogViewerProps {
  customerId: string;
  customerDomain: string;
  service: ServiceType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerLogViewer({
  customerId,
  customerDomain,
  service: initialService,
  open,
  onOpenChange,
}: CustomerLogViewerProps) {
  const [service, setService] = useState<ServiceType>(initialService);
  const [lines, setLines] = useState<number>(100);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    logs,
    loading,
    error,
    isStreaming,
    fetchLogs,
    clearLogs,
    downloadLogs,
    startStreaming,
    stopStreaming
  } = useCustomerLogs({
    customerId,
    customerDomain,
    service,
    lines,
    autoRefresh,
    refreshInterval: 3000,
    streamingMode: true, // WebSocket streaming aktif
  });

  useEffect(() => {
    if (open) {
      fetchLogs();
    } else {
      setAutoRefresh(false);
      clearLogs();
      // Modal kapanınca streaming'i durdur
      if (isStreaming) {
        stopStreaming();
      }
    }
  }, [open, fetchLogs, clearLogs, isStreaming, stopStreaming]);

  useEffect(() => {
    setService(initialService);
  }, [initialService]);

  const handleServiceChange = (newService: ServiceType) => {
    setService(newService);
    fetchLogs(customerId, newService, lines);
  };

  const handleLinesChange = (newLines: string) => {
    const lineCount = parseInt(newLines);
    setLines(lineCount);
    fetchLogs(customerId, service, lineCount);
  };

  const handleCopyLogs = async () => {
    if (!logs) return;

    try {
      await navigator.clipboard.writeText(logs);
      setCopied(true);
      toast.success("Loglar kopyalandı");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Kopyalama başarısız");
    }
  };

  const getServiceColor = (svc: ServiceType) => {
    switch (svc) {
      case "backend":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
      case "admin":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300";
      case "store":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
    }
  };

  const getServiceIcon = (svc: ServiceType) => {
    return <Server className="h-4 w-4" />;
  };

  // Log satırlarını renklendir
  const formatLogs = (logText: string) => {
    if (!logText) return null;

    return logText.split('\n').map((line, index) => {
      let colorClass = "text-gray-300";

      if (line.includes("ERROR") || line.includes("error")) {
        colorClass = "text-red-400 font-semibold";
      } else if (line.includes("WARN") || line.includes("warning")) {
        colorClass = "text-yellow-400";
      } else if (line.includes("INFO") || line.includes("info")) {
        colorClass = "text-blue-400";
      } else if (line.includes("SUCCESS") || line.includes("success")) {
        colorClass = "text-green-400";
      }

      return (
        <div key={index} className="flex hover:bg-gray-800/50">
          <span className="inline-block w-16 text-right pr-4 text-gray-600 select-none flex-shrink-0">
            {index + 1}
          </span>
          <span className={cn("flex-1", colorClass)}>{line || "\u00A0"}</span>
        </div>
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0">
        {/* Sabit Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <Terminal className="h-6 w-6 text-gray-700 dark:text-gray-300" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Log Görüntüleyici</DialogTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {customerDomain}
                </p>
              </div>
            </div>
            <Badge className={cn("px-4 py-2 text-sm", getServiceColor(service))}>
              {getServiceIcon(service)}
              <span className="ml-2 capitalize font-semibold">{service}</span>
            </Badge>
          </div>

          {/* Kontrol Paneli */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Servis:</span>
              <Select value={service} onValueChange={handleServiceChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backend">Backend</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="store">Store</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Satır:</span>
              <Select value={lines.toString()} onValueChange={handleLinesChange}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Durdur
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Canlı İzle
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs()}
                disabled={loading || autoRefresh}
                title="Yenile"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLogs}
                disabled={!logs || loading}
                title="Kopyala"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={downloadLogs}
                disabled={!logs || loading}
                title="İndir"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Scroll Edilebilir Log İçeriği */}
        <div className="flex-1 overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 z-10 flex items-center justify-center">
              <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-6 py-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm font-medium">Loglar yükleniyor...</span>
              </div>
            </div>
          )}

          <div className="h-full overflow-y-auto bg-gray-950">
            {error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8">
                  <div className="text-red-400 text-lg mb-2">⚠️ Hata Oluştu</div>
                  <div className="text-gray-400 text-sm">{error}</div>
                </div>
              </div>
            ) : logs ? (
              <pre className="p-6 text-sm font-mono leading-relaxed">
                {formatLogs(logs)}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8">
                  <Terminal className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <div className="text-gray-400 text-sm">Henüz log bulunmuyor</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sabit Footer */}
        <DialogFooter className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            {isStreaming ? (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span className="font-medium">🔴 Canlı Yayın - Gerçek zamanlı loglar akıyor</span>
              </div>
            ) : autoRefresh ? (
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                <span>Otomatik yenileme aktif (3 saniyede bir)</span>
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Son {lines} satır gösteriliyor
              </div>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Kapat
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
