"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertCircle,
  Copy,
  Download,
  Terminal,
  FileText,
  Info,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface ErrorDetail {
  step?: string;
  message: string;
  code?: string;
  timestamp?: Date;
  stack?: string;
  logs?: string[];
  suggestion?: string;
  helpUrl?: string;
}

interface ErrorDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  error: ErrorDetail;
  onRetry?: () => void;
}

export function ErrorDetailsDialog({
  isOpen,
  onClose,
  error,
  onRetry
}: ErrorDetailsDialogProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} panoya kopyalandı`);
  };

  const downloadErrorReport = () => {
    const report = `
HATA RAPORU
===========
Tarih: ${error.timestamp?.toISOString() || new Date().toISOString()}
Adım: ${error.step || 'Bilinmiyor'}
Mesaj: ${error.message}
Kod: ${error.code || 'N/A'}

STACK TRACE:
${error.stack || 'Stack trace mevcut değil'}

LOGLAR:
${error.logs?.join('\n') || 'Log mevcut değil'}

ÖNERİ:
${error.suggestion || 'Öneri mevcut değil'}
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hata-raporu-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Hata raporu indirildi');
  };

  const getErrorSeverity = () => {
    if (error.code?.startsWith('CRITICAL')) return 'critical';
    if (error.code?.startsWith('ERROR')) return 'error';
    if (error.code?.startsWith('WARN')) return 'warning';
    return 'info';
  };

  const severityColors = {
    critical: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800',
    error: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
    warning: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
    info: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800'
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-rose-100 dark:bg-rose-900/30">
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <DialogTitle className="text-xl">Kurulum Hatası</DialogTitle>
                <DialogDescription className="mt-1">
                  Kurulum sırasında bir hata oluştu. Detayları aşağıda bulabilirsiniz.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className={severityColors[getErrorSeverity()]}>
              {getErrorSeverity().toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="overview" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">
                <Info className="h-3.5 w-3.5 mr-1" />
                Genel Bakış
              </TabsTrigger>
              <TabsTrigger value="technical">
                <Terminal className="h-3.5 w-3.5 mr-1" />
                Teknik Detaylar
              </TabsTrigger>
              <TabsTrigger value="logs">
                <FileText className="h-3.5 w-3.5 mr-1" />
                Loglar
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto mt-4">
              <TabsContent value="overview" className="space-y-4 h-full">
                {/* Error Message */}
                <Alert className="border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">Hata Mesajı:</p>
                      <p className="text-sm">{error.message}</p>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Error Details */}
                <Card>
                  <CardContent className="pt-6">
                    <dl className="space-y-3">
                      {error.step && (
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Adım:</dt>
                          <dd className="text-sm font-medium">{error.step}</dd>
                        </div>
                      )}
                      {error.code && (
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Hata Kodu:</dt>
                          <dd className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {error.code}
                          </dd>
                        </div>
                      )}
                      {error.timestamp && (
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Zaman:</dt>
                          <dd className="text-sm">
                            {error.timestamp.toLocaleString('tr-TR')}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </CardContent>
                </Card>

                {/* Suggestion */}
                {error.suggestion && (
                  <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">Çözüm Önerisi:</p>
                        <p className="text-sm">{error.suggestion}</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Help Link */}
                {error.helpUrl && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(error.helpUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Yardım Dökümanına Git
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="technical" className="space-y-4 h-full">
                {/* Stack Trace */}
                {error.stack && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium">Stack Trace</h3>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(error.stack!, 'Stack trace')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <ScrollArea className="h-64 w-full rounded-md border bg-gray-950 p-3">
                          <pre className="text-xs text-gray-300 font-mono">
                            {error.stack}
                          </pre>
                        </ScrollArea>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Error Code Details */}
                {error.code && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium">Hata Kodu Detayları</h3>
                        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
                          <code className="text-sm">{error.code}</code>
                        </div>
                        <p className="text-xs text-gray-500">
                          Bu kodu destek ekibine iletebilirsiniz.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="logs" className="h-full">
                {error.logs && error.logs.length > 0 ? (
                  <Card className="h-full">
                    <CardContent className="pt-6 h-full">
                      <div className="space-y-2 h-full">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium">Son Loglar</h3>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(error.logs!.join('\n'), 'Loglar')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <ScrollArea className="h-80 w-full rounded-md border bg-gray-950 p-3">
                          <div className="space-y-1">
                            {error.logs.map((log, index) => (
                              <div
                                key={index}
                                className="flex items-start space-x-2 text-xs font-mono"
                              >
                                <span className="text-gray-500 select-none">
                                  {String(index + 1).padStart(3, '0')}
                                </span>
                                <span className="text-gray-300">{log}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Bu hata için log kaydı bulunmuyor.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadErrorReport}
          >
            <Download className="h-4 w-4 mr-2" />
            Raporu İndir
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              Kapat
            </Button>
            {onRetry && (
              <Button onClick={onRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tekrar Dene
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { ErrorDetail, ErrorDetailsDialogProps };