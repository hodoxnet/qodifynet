"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import {
  Terminal,
  RefreshCw,
  Download,
  Loader2,
  Copy,
  CheckCircle,
  Pause,
  Play,
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

  const { logs, loading, error, fetchLogs, clearLogs, downloadLogs } = useCustomerLogs({
    customerId,
    service,
    lines,
    autoRefresh,
    refreshInterval: 3000,
  });

  useEffect(() => {
    if (open) {
      fetchLogs();
    } else {
      setAutoRefresh(false);
      clearLogs();
    }
  }, [open, fetchLogs, clearLogs]);

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

  const getServiceBadgeVariant = (svc: ServiceType) => {
    switch (svc) {
      case "backend":
        return "default";
      case "admin":
        return "secondary";
      case "store":
        return "outline";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Log Görüntüleyici
          </SheetTitle>
          <SheetDescription>
            {customerDomain} - {service} servisi logları
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Kontroller */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={service} onValueChange={handleServiceChange}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backend">
                  <div className="flex items-center gap-2">
                    <Badge variant={getServiceBadgeVariant("backend")} className="h-5">
                      Backend
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Badge variant={getServiceBadgeVariant("admin")} className="h-5">
                      Admin
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="store">
                  <div className="flex items-center gap-2">
                    <Badge variant={getServiceBadgeVariant("store")} className="h-5">
                      Store
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={lines.toString()} onValueChange={handleLinesChange}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 satır</SelectItem>
                <SelectItem value="100">100 satır</SelectItem>
                <SelectItem value="200">200 satır</SelectItem>
                <SelectItem value="500">500 satır</SelectItem>
                <SelectItem value="1000">1000 satır</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2 ml-auto">
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="gap-2"
              >
                {autoRefresh ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Durdur
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Otomatik Yenile
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs()}
                disabled={loading || autoRefresh}
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
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Log İçeriği */}
          <Card className="relative">
            {loading && (
              <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 z-10 flex items-center justify-center rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loglar yükleniyor...</span>
                </div>
              </div>
            )}

            <ScrollArea className="h-[calc(100vh-280px)] w-full rounded-lg">
              <pre
                className={cn(
                  "p-4 text-xs font-mono",
                  "bg-gray-900 dark:bg-gray-950 text-gray-100",
                  "whitespace-pre-wrap break-all",
                  error && "text-red-400"
                )}
              >
                {logs || (error ? `Hata: ${error}` : "Log bulunmuyor")}
              </pre>
            </ScrollArea>
          </Card>

          {/* Durum Bilgisi */}
          {autoRefresh && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span>Otomatik yenileme aktif (3 saniyede bir)</span>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
