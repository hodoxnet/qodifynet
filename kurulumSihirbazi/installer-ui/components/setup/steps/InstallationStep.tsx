"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Terminal as TerminalIcon,
  Activity,
  Package,
  Database,
  Settings,
  Server,
  Shield,
  Eye,
  EyeOff,
  AlertCircle,
  GitBranch
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Terminal, TerminalLog } from '@/components/ui/terminal';
import { BuildProgress, BuildStep } from '@/components/ui/build-progress';
import { InstallStatus, CompletedInfo, InstallStep } from '@/lib/types/setup';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface InstallationStepProps {
  installStatus: InstallStatus;
  installProgress: string[];
  completedInfo: CompletedInfo | null;
  steps?: InstallStep[];
  buildLogs?: { service: string; type: 'stdout' | 'stderr'; content: string; timestamp: Date }[];
}

const stepIcons: Record<string, React.ReactNode> = {
  'prepareGit': <GitBranch className="h-4 w-4" />,
  'createDatabase': <Database className="h-4 w-4" />,
  'configureEnvironment': <Settings className="h-4 w-4" />,
  'installDependencies': <Package className="h-4 w-4" />,
  'runMigrations': <Database className="h-4 w-4" />,
  'buildApplications': <TerminalIcon className="h-4 w-4" />,
  'configureServices': <Server className="h-4 w-4" />,
  'finalize': <Shield className="h-4 w-4" />
};

export function InstallationStep({
  installStatus,
  installProgress,
  completedInfo,
  steps = [],
  buildLogs = []
}: InstallationStepProps) {
  const { user, hasScope } = useAuth();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isPartner = !isStaff && (hasScope('setup.run') || !!user?.partnerId || (user?.role || '').startsWith('PARTNER_'));
  const [showDetailedLogs, setShowDetailedLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'details'>('overview');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} panoya kopyalandı`);
  };

  // Convert install progress to terminal logs
  const terminalLogs: TerminalLog[] = useMemo(() => {
    const logs = installProgress.map((log, index) => {
      let type: TerminalLog['type'] = 'info';

      // Build log tespiti
      if (log.includes('[BUILD:')) {
        if (log.includes('❌') || log.includes('ERROR') || log.includes('FATAL')) {
          type = 'error';
        } else if (log.includes('🟡') || log.includes('WARNING')) {
          type = 'warning';
        } else if (log.includes('🟢') || log.includes('SUCCESS')) {
          type = 'success';
        } else {
          type = 'system';
        }
      }
      // Normal loglar
      else if (log.includes('✓') || log.includes('✅') || log.includes('Başarı') || log.includes('Tamamlandı')) {
        type = 'success';
      } else if (log.includes('❌') || log.includes('HATA') || log.includes('Başarısız')) {
        type = 'error';
      } else if (log.includes('⚠') || log.includes('Uyarı') || log.includes('KRİTİK')) {
        type = 'warning';
      } else if (log.includes('%') || log.includes('Build') || log.includes('Derleniyor')) {
        type = 'progress';
      } else if (log.startsWith('[') || log.includes('⚙') || log.includes('Yapılandırılıyor')) {
        type = 'system';
      }

      // Extract progress percentage if available
      const progressMatch = log.match(/(\d+)%/);
      const metadata = progressMatch ? { progress: parseInt(progressMatch[1]) } : undefined;

      return {
        id: `log-${index}`,
        content: log,
        type,
        timestamp: new Date(),
        metadata
      };
    });

    // Build loglarını da ekle (eğer varsa)
    if (buildLogs && buildLogs.length > 0) {
      buildLogs.forEach((buildLog, idx) => {
        logs.push({
          id: `build-log-${idx}`,
          content: `[BUILD:${buildLog.service.toUpperCase()}] ${buildLog.content}`,
          type: buildLog.type === 'stderr' ? 'error' : 'system',
          timestamp: buildLog.timestamp,
          metadata: undefined
        });
      });
    }

    return logs;
  }, [installProgress, buildLogs]);

  // Convert steps to build steps
  const buildSteps: BuildStep[] = useMemo(() => {
    return steps.map(step => ({
      id: step.key,
      name: step.label,
      status: step.status === 'success' ? 'completed' : step.status === 'pending' ? 'pending' : step.status === 'error' ? 'error' : 'running',
      progress: step.progress,
      duration: step.durationMs,
      message: step.error,
      icon: stepIcons[step.key]
    }));
  }, [steps]);

  const getStatusIcon = () => {
    switch (installStatus) {
      case "running":
        return <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />;
      case "completed":
        return <CheckCircle className="h-10 w-10 text-emerald-500" />;
      case "error":
        return <XCircle className="h-10 w-10 text-rose-500" />;
      default:
        return null;
    }
  };

  const getStatusTitle = () => {
    switch (installStatus) {
      case "running":
        return "Kurulum Devam Ediyor";
      case "completed":
        return "Kurulum Tamamlandı!";
      case "error":
        return "Kurulum Başarısız";
      default:
        return "";
    }
  };

  const getStatusDescription = () => {
    switch (installStatus) {
      case "running":
        return "Lütfen bekleyin, bu işlem birkaç dakika sürebilir";
      case "completed":
        return "Siteniz başarıyla kuruldu ve çalışıyor";
      case "error":
        return "Kurulum sırasında bir hata oluştu";
      default:
        return "";
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Status Card */}
      <Card className="overflow-hidden">
        <div className={cn(
          "h-2 w-full",
          installStatus === "running" && "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse",
          installStatus === "completed" && "bg-gradient-to-r from-emerald-500 to-green-500",
          installStatus === "error" && "bg-gradient-to-r from-rose-500 to-red-500"
        )} />
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 shadow-lg">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
            {getStatusTitle()}
          </CardTitle>
          <CardDescription className="text-base">{getStatusDescription()}</CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          {/* Tabs for different views */}
          <Tabs defaultValue="overview" value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className={cn("grid w-full mb-6", isPartner ? 'grid-cols-2' : 'grid-cols-3')}>
              <TabsTrigger value="overview" className="flex items-center space-x-1">
                <Activity className="h-3.5 w-3.5" />
                <span>Genel Bakış</span>
              </TabsTrigger>
              {!isPartner && (
                <TabsTrigger value="logs" className="flex items-center space-x-1">
                  <TerminalIcon className="h-3.5 w-3.5" />
                  <span>Terminal</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="details" className="flex items-center space-x-1">
                <Settings className="h-3.5 w-3.5" />
                <span>Detaylar</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-0">
              {steps.length > 0 && (
                <BuildProgress
                  steps={buildSteps}
                  title="Kurulum Adımları"
                  showDetails={true}
                  compact={false}
                />
              )}

              {/* Quick Stats */}
              {installStatus === "running" && (
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3">
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-xs text-gray-500">Aktif İşlem</p>
                        <p className="text-sm font-semibold">
                          {steps.find(s => s.status === 'running')?.label || '-'}
                        </p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <div>
                        <p className="text-xs text-gray-500">Tamamlanan</p>
                        <p className="text-sm font-semibold">
                          {steps.filter(s => s.status === 'success').length}/{steps.length}
                        </p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center space-x-2">
                      <TerminalIcon className="h-4 w-4 text-purple-500" />
                      <div>
                        <p className="text-xs text-gray-500">Log Sayısı</p>
                        <p className="text-sm font-semibold">{installProgress.length}</p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Terminal/Logs Tab - Partner için gizli */}
            {!isPartner && (
            <TabsContent value="logs" className="mt-0">
              <div className="space-y-4">
                <Terminal
                  logs={terminalLogs}
                  title="Kurulum Terminal"
                  showTimestamps={true}
                  showLineNumbers={true}
                  autoScroll={true}
                  showSearch={true}
                  isLoading={installStatus === "running"}
                  fullscreenEnabled={true}
                  className=""
                />

                {/* Build Log Uyarısı */}
                {steps.find(s => s.key === 'buildApplications' && s.status === 'error') && (
                  <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Build Hatası Tespit Edildi</AlertTitle>
                    <AlertDescription>
                      <p className="text-sm mb-2">
                        Build işlemi sırasında hata oluştu. Terminal&apos;de detaylı logları inceleyebilirsiniz.
                      </p>
                      {terminalLogs.find(log => log.content.includes('heap out of memory')) && (
                        <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-xs">
                          <strong>💡 Çözüm:</strong> Node.js bellek yetersizliği tespit edildi.
                          Sunucu RAM&apos;ini arttırın veya <code className="bg-amber-200 dark:bg-amber-800 px-1 rounded">
                            NODE_OPTIONS=&quot;--max-old-space-size=4096&quot;
                          </code> ile tekrar deneyin.
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>) }

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Sistem Detayları</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Durum:</span>
                      <Badge variant={installStatus === 'completed' ? 'default' : installStatus === 'error' ? 'destructive' : 'secondary'}>
                        {installStatus === 'idle' && 'Bekliyor'}
                        {installStatus === 'running' && 'Çalışıyor'}
                        {installStatus === 'completed' && 'Tamamlandı'}
                        {installStatus === 'error' && 'Hata'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Toplam Adım:</span>
                      <span>{steps.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tamamlanan:</span>
                      <span>{steps.filter(s => s.status === 'success').length}</span>
                    </div>
                    {!isPartner && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Log Sayısı:</span>
                        <span>{installProgress.length}</span>
                      </div>
                    )}
                  </div>

                  {/* Detailed Step Times */}
                  {!isPartner && steps.filter(s => s.durationMs).length > 0 && (
                    <>
                      <Separator className="my-3" />
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Adım Süreleri</h4>
                        {steps.filter(s => s.durationMs).map(step => (
                          <div key={step.key} className="flex justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400">{step.label}:</span>
                            <span className="font-mono">{Math.round((step.durationMs || 0) / 1000)}s</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Completed Info */}
      {completedInfo && installStatus === "completed" && (
        <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Site Başarıyla Kuruldu!</span>
            </CardTitle>
            <CardDescription>
              Siteniz kullanıma hazır. Aşağıdaki bağlantıları kullanarak erişebilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* URLs Grid */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Store URL */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
                <CardHeader className="relative pb-3">
                  <CardTitle className="text-sm font-medium flex items-center space-x-2">
                    <Package className="h-4 w-4 text-blue-500" />
                    <span>Mağaza</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-2">
                    <a
                      href={completedInfo.urls.store}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all inline-flex items-center space-x-1"
                    >
                      <span>{completedInfo.urls.store}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => copyToClipboard(completedInfo.urls.store, "Store URL")}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Kopyala
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Admin URL */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
                <CardHeader className="relative pb-3">
                  <CardTitle className="text-sm font-medium flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-purple-500" />
                    <span>Admin Panel</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-2">
                    <a
                      href={completedInfo.urls.admin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all inline-flex items-center space-x-1"
                    >
                      <span>{completedInfo.urls.admin}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => copyToClipboard(completedInfo.urls.admin, "Admin URL")}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Kopyala
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* API URL */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent" />
                <CardHeader className="relative pb-3">
                  <CardTitle className="text-sm font-medium flex items-center space-x-2">
                    <Server className="h-4 w-4 text-green-500" />
                    <span>API</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-2">
                    <a
                      href={completedInfo.urls.api}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all inline-flex items-center space-x-1"
                    >
                      <span>{completedInfo.urls.api}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => copyToClipboard(completedInfo.urls.api, "API URL")}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Kopyala
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Port Information */}
            {completedInfo.ports && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Port Bilgileri</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <p className="text-gray-500">Backend</p>
                      <p className="font-mono font-semibold">{completedInfo.ports.backend}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Admin</p>
                      <p className="font-mono font-semibold">{completedInfo.ports.admin}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Store</p>
                      <p className="font-mono font-semibold">{completedInfo.ports.store}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Credentials if available */}
            {completedInfo.credentials && (
              <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                <Shield className="h-4 w-4" />
                <AlertTitle>Yönetici Bilgileri</AlertTitle>
                <AlertDescription className="mt-2 space-y-1 text-sm">
                  <div>Email: <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">{completedInfo.credentials.email}</code></div>
                  <div>Şifre: <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">{completedInfo.credentials.password}</code></div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {installStatus === "error" && (
        <Alert className="border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20">
          <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          <AlertTitle className="text-rose-900 dark:text-rose-100">Kurulum Hatası</AlertTitle>
          <AlertDescription className="text-rose-700 dark:text-rose-300">
            <p>Kurulum sırasında bir hata oluştu. Lütfen logları kontrol edip tekrar deneyin.</p>
            {steps.find(s => s.status === 'error')?.error && (
              <div className="mt-2 p-2 bg-rose-100 dark:bg-rose-900/30 rounded text-xs font-mono">
                {steps.find(s => s.status === 'error')?.error}
              </div>
            )}
            <div className="mt-3">
              {!isPartner ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab('logs')}
                  className="text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700"
                >
                  <TerminalIcon className="h-3.5 w-3.5 mr-1" />
                  Logları Görüntüle
                </Button>
              ) : (
                <span className="text-xs text-gray-600 dark:text-gray-400">Detaylı loglar yalnızca yönetici tarafından görüntülenebilir.</span>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      {installStatus === "completed" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button
                onClick={() => window.open(completedInfo?.urls.admin, '_blank')}
                className="min-w-[160px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                <Shield className="mr-2 h-4 w-4" />
                Admin Paneli Aç
              </Button>
              <Button
                onClick={() => window.open(completedInfo?.urls.store, '_blank')}
                variant="outline"
                className="min-w-[160px]"
              >
                <Package className="mr-2 h-4 w-4" />
                Mağazayı Görüntüle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
