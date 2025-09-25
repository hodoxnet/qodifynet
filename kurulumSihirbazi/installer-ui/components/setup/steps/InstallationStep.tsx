"use client";

import {
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Terminal
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { InstallStatus, CompletedInfo } from '@/lib/types/setup';
import { toast } from 'sonner';

interface InstallationStepProps {
  installStatus: InstallStatus;
  installProgress: string[];
  completedInfo: CompletedInfo | null;
  adminEmail: string;
}

export function InstallationStep({
  installStatus,
  installProgress,
  completedInfo,
  adminEmail
}: InstallationStepProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} panoya kopyalandı`);
  };

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
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50">
          {getStatusIcon()}
        </div>
        <CardTitle className="text-2xl">{getStatusTitle()}</CardTitle>
        <CardDescription>{getStatusDescription()}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Logs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Kurulum Logları</h3>
            <Badge variant="secondary">
              <Terminal className="mr-1 h-3 w-3" />
              {installProgress.length} işlem
            </Badge>
          </div>
          <ScrollArea className="h-64 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
            <div className="space-y-1">
              {installProgress.map((log, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <span className="text-gray-400 dark:text-gray-500">•</span>
                  <span className="text-gray-700 dark:text-gray-300">{log}</span>
                </div>
              ))}
              {installStatus === "running" && (
                <div className="mt-2 flex items-center space-x-2">
                  <Loader2 className="h-3 w-3 animate-spin text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">İşlem devam ediyor...</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Completed Info */}
        {completedInfo && installStatus === "completed" && (
          <Alert className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
            <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <AlertTitle className="text-emerald-900 dark:text-emerald-100">Site Bilgileri</AlertTitle>
            <AlertDescription className="mt-4 space-y-4">
              {/* URLs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Store URL</p>
                    <a
                      href={completedInfo.urls.store}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-1"
                    >
                      <span>{completedInfo.urls.store}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(completedInfo.urls.store, "Store URL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Admin Panel</p>
                    <a
                      href={completedInfo.urls.admin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-1"
                    >
                      <span>{completedInfo.urls.admin}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(completedInfo.urls.admin, "Admin URL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">API</p>
                    <a
                      href={completedInfo.urls.api}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-1"
                    >
                      <span>{completedInfo.urls.api}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(completedInfo.urls.api, "API URL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Error State */}
        {installStatus === "error" && (
          <Alert className="border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20">
            <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            <AlertTitle className="text-rose-900 dark:text-rose-100">Kurulum Hatası</AlertTitle>
            <AlertDescription className="text-rose-700 dark:text-rose-300">
              Kurulum sırasında bir hata oluştu. Lütfen logları kontrol edip tekrar deneyin.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        {installStatus === "completed" && (
          <div className="flex justify-center space-x-3">
            <Button
              onClick={() => window.open(completedInfo?.urls.admin, '_blank')}
              className="min-w-[140px]"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Admin Paneli Aç
            </Button>
            <Button
              onClick={() => window.open(completedInfo?.urls.store, '_blank')}
              variant="outline"
              className="min-w-[140px]"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Mağazayı Aç
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}