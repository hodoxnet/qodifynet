"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePm2 } from "@/hooks/system/usePm2";
import {
  Activity,
  Save,
  RefreshCw,
  StopCircle,
  Upload,
  Settings,
  Loader2,
  Terminal,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  Cpu,
  HardDrive,
  Clock
} from "lucide-react";

export function Pm2ManagementTab() {
  const {
    pm2Info,
    processes,
    output,
    loading,
    listLoading,
    savePm2,
    setupStartup,
    updatePm2,
    restartAll,
    stopAll,
    refreshProcessList,
  } = usePm2();

  const pm2Actions = [
    {
      key: "save",
      title: "PM2 Save",
      description: "Şu an çalışan süreç listesini kaydeder. Reboot sonrası otomatik başlatma için gereklidir.",
      icon: Save,
      action: savePm2,
      buttonText: "Kaydet (pm2 save)",
      color: "blue",
    },
    {
      key: "startup",
      title: "PM2 Startup",
      description: "PM2'yi sistem açılışında otomatik başlatmak için init entegrasyonunu kurar.",
      icon: Settings,
      action: setupStartup,
      buttonText: "Kur (pm2 startup)",
      color: "green",
    },
    {
      key: "update",
      title: "PM2 Update",
      description: "PM2 daemon'ı güncel sürüme yükseltir ve süreçleri yeniden başlatır.",
      icon: Upload,
      action: updatePm2,
      buttonText: "Güncelle (pm2 update)",
      color: "purple",
    },
    {
      key: "restart-all",
      title: "Restart All",
      description: "Tüm PM2 süreçlerini yeniden başlatır. Konfigürasyon değişikliklerinden sonra kullanın.",
      icon: RefreshCw,
      action: restartAll,
      buttonText: "Yeniden Başlat",
      color: "amber",
    },
    {
      key: "stop-all",
      title: "Stop All",
      description: "Tüm PM2 süreçlerini durdurur. Bakım için geçici durdurmalarda kullanın.",
      icon: StopCircle,
      action: stopAll,
      buttonText: "Durdur",
      color: "red",
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "online") {
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">Online</Badge>;
    } else if (statusLower === "stopped") {
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">Stopped</Badge>;
    } else if (statusLower === "errored") {
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">Error</Badge>;
    } else {
      return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* PM2 Info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">PM2 Process Manager</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Node.js uygulamalarınızı yönetin
          </p>
        </div>
        {pm2Info && (
          <div className="flex items-center space-x-4">
            <Badge variant="secondary">
              <Activity className="h-3 w-3 mr-1" />
              PM2 {pm2Info.version || "Unknown"}
            </Badge>
            {pm2Info.bin && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {pm2Info.bin}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Active Processes List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <CardTitle>Aktif Prosesler</CardTitle>
            </div>
            <Button
              onClick={refreshProcessList}
              variant="outline"
              size="sm"
              disabled={listLoading}
            >
              <RefreshCw className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <CardDescription>
            PM2 ile yönetilen tüm proseslerin durumu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {processes.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aktif PM2 prosesi bulunmuyor</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-2 px-3">ID</th>
                    <th className="text-left py-2 px-3">İsim</th>
                    <th className="text-left py-2 px-3">Durum</th>
                    <th className="text-left py-2 px-3">CPU</th>
                    <th className="text-left py-2 px-3">RAM</th>
                    <th className="text-left py-2 px-3">Uptime</th>
                    <th className="text-left py-2 px-3">Restart</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((process) => (
                    <tr key={process.id} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 px-3 font-mono">{process.id}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center space-x-2">
                          {process.status?.toLowerCase() === "online" ? (
                            <PlayCircle className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <PauseCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium">{process.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">{getStatusBadge(process.status)}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center space-x-1">
                          <Cpu className="h-3 w-3 text-gray-400" />
                          <span>{process.cpu || 0}%</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center space-x-1">
                          <HardDrive className="h-3 w-3 text-gray-400" />
                          <span>{process.memory || "0 MB"}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span className="text-xs">{process.uptime || "0s"}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline">{process.restarts || 0}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PM2 Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pm2Actions.map(({ key, title, description, icon: Icon, action, buttonText }) => (
          <Card key={key}>
            <CardHeader className="pb-3">
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br from-${key === "save" ? "blue" : key === "startup" ? "green" : key === "update" ? "purple" : key === "restart-all" ? "amber" : "red"}-100 to-${key === "save" ? "blue" : key === "startup" ? "green" : key === "update" ? "purple" : key === "restart-all" ? "amber" : "red"}-200 dark:from-${key === "save" ? "blue" : key === "startup" ? "green" : key === "update" ? "purple" : key === "restart-all" ? "amber" : "red"}-900/20 dark:to-${key === "save" ? "blue" : key === "startup" ? "green" : key === "update" ? "purple" : key === "restart-all" ? "amber" : "red"}-800/20`}>
                  <Icon className={`h-5 w-5 text-${key === "save" ? "blue" : key === "startup" ? "green" : key === "update" ? "purple" : key === "restart-all" ? "amber" : "red"}-600 dark:text-${key === "save" ? "blue" : key === "startup" ? "green" : key === "update" ? "purple" : key === "restart-all" ? "amber" : "red"}-400`} />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={action}
                disabled={loading === key}
                variant={key === "stop-all" ? "destructive" : "default"}
                className="w-full"
                size="sm"
              >
                {loading === key ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    İşleniyor...
                  </>
                ) : (
                  <>
                    <Icon className="h-4 w-4 mr-2" />
                    {buttonText}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Important Note */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Önemli:</strong> PM2 startup komutu çalıştırıldıktan sonra,
          terminalde görünen komutu sudo ile çalıştırmanız gerekebilir.
          Save komutunu kullanmayı unutmayın.
        </AlertDescription>
      </Alert>

      {/* Command Output */}
      {output && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Terminal className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <CardTitle className="text-base">Komut Çıktısı</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-black p-4">
              <pre className="text-xs text-gray-100 whitespace-pre-wrap font-mono">
                {output}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}