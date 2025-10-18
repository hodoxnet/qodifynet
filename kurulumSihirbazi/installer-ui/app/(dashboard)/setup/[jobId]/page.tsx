"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  Trash2,
  Pause,
  Play,
  Terminal,
  FileJson,
  Activity,
  ArrowLeft,
  Download,
  Copy,
  CheckCheck,
  Globe,
  FolderOpen,
  Database,
  Settings,
  Package,
  GitBranch,
  Server,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { io, Socket } from "socket.io-client";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { BuildProgress, BuildStep } from "@/components/ui/build-progress";

interface JobDetail {
  id: string;
  domain: string;
  type: 'template' | 'git';
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep?: string;
  config?: any;
  data?: any;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  failedReason?: string;
  attemptsMade?: number;
  customerId?: string;
  dbRecord?: {
    userId: string;
    partnerId?: string;
  };
  progressPercent?: number;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: any;
}

interface StepProgress {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

const SETUP_STEPS = [
  { id: 'dns', label: 'DNS Kontrolü', icon: <Globe className="h-4 w-4" /> },
  { id: 'extract', label: 'Dosyaları Çıkar', icon: <FolderOpen className="h-4 w-4" /> },
  { id: 'database', label: 'Veritabanı Oluştur', icon: <Database className="h-4 w-4" /> },
  { id: 'environment', label: 'Ortam Dosyaları', icon: <Settings className="h-4 w-4" /> },
  { id: 'dependencies', label: 'Bağımlılıklar', icon: <Package className="h-4 w-4" /> },
  { id: 'migrations', label: 'Veritabanı Migration', icon: <Database className="h-4 w-4" /> },
  { id: 'build', label: 'Build İşlemi', icon: <Terminal className="h-4 w-4" /> },
  { id: 'services', label: 'PM2 ve Nginx Kurulum', icon: <Server className="h-4 w-4" /> },
  { id: 'start', label: 'Servisleri Başlat', icon: <Play className="h-4 w-4" /> },
  { id: 'finalize', label: 'Kurulum Tamamlanıyor', icon: <Shield className="h-4 w-4" /> }
];

const getStepById = (stepId?: string) => {
  if (!stepId) return undefined;
  return SETUP_STEPS.find((step) => step.id === stepId);
};

const buildStepMessage = (stepId?: string, message?: string) => {
  if (!stepId) return message;
  const definition = getStepById(stepId);
  if (!definition) return message || stepId;
  if (!message) return definition.label;
  return `${definition.label}: ${message}`;
};

const normalizePercent = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100, numeric));
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [steps, setSteps] = useState<StepProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const initializeSteps = useCallback((jobData: JobDetail) => {
    const currentStepIndex = Math.floor((jobData.progress / 100) * SETUP_STEPS.length);

    const initialSteps: StepProgress[] = SETUP_STEPS.map((step, index) => {
      if (index < currentStepIndex) {
        return {
          id: step.id,
          label: step.label,
          status: 'completed',
          completedAt: new Date().toISOString()
        };
      } else if (index === currentStepIndex && jobData.status === 'active') {
        return {
          id: step.id,
          label: step.label,
          status: 'running',
          startedAt: new Date().toISOString()
        };
      } else {
        return {
          id: step.id,
          label: step.label,
          status: 'pending'
        };
      }
    });

    setSteps(initialSteps);
  }, []);

  const fetchJobDetail = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/setup-queue/job/${jobId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      const data = await response.json();
      const jobData = data.job;

      // Normalize progress - it might be an object {step, message, percent}
      if (typeof jobData.progress === 'object' && jobData.progress !== null) {
        jobData.currentStep = buildStepMessage(jobData.progress.step, jobData.progress.message);
        jobData.progress = normalizePercent(jobData.progress.percent);
      } else if (typeof jobData.progress === 'number') {
        jobData.progress = normalizePercent(jobData.progress);
      } else {
        jobData.progress = 0;
      }

      if (!jobData.config && jobData.data?.config) {
        jobData.config = jobData.data.config;
      }
      if (!jobData.domain && jobData.data?.domain) {
        jobData.domain = jobData.data.domain;
      }
      if (!jobData.type && jobData.data?.type) {
        jobData.type = jobData.data.type;
      }

      setJob(jobData);

      // Parse logs from job data if available
      if (jobData.logs) {
        setLogs(jobData.logs);
      }

      // Initialize steps based on current progress
      initializeSteps(jobData);
    } catch (error: any) {
      console.error('Failed to fetch job detail:', error);
      toast.error('Job detayları alınamadı');
      router.push('/setup/active');
    } finally {
      setLoading(false);
    }
  }, [initializeSteps, jobId, router]);

  const updateJobProgress = useCallback((progress: any) => {
    const rawPercent = typeof progress === 'number'
      ? progress
      : progress?.percent;
    const percent = rawPercent !== undefined ? normalizePercent(rawPercent) : undefined;

    const stepId = typeof progress === 'object' ? progress?.step : undefined;
    const message = typeof progress === 'object' ? progress?.message : undefined;

    setJob(prev => {
      if (!prev) return prev;
      const nextPercent = typeof percent === 'number'
        ? percent
        : prev.progress || 0;
      const currentStepMessage = buildStepMessage(stepId, message) || prev.currentStep;
      return {
        ...prev,
        progress: nextPercent,
        currentStep: currentStepMessage
      };
    });

    if (stepId) {
      const stepIndex = SETUP_STEPS.findIndex(step => step.id === stepId);
      if (stepIndex >= 0) {
        setSteps(prev => prev.map((step, index) => {
          if (index < stepIndex) {
            return {
              ...step,
              status: 'completed',
              completedAt: step.completedAt ?? new Date().toISOString(),
              error: undefined
            };
          }
          if (index === stepIndex) {
            return {
              ...step,
              status: 'running',
              startedAt: step.startedAt ?? new Date().toISOString(),
              error: undefined
            };
          }
          return {
            ...step,
            status: 'pending',
            error: undefined
          };
        }));
      }
    }
  }, []);

  const addLog = useCallback((log: LogEntry) => {
    setLogs(prev => [...prev, log]);
  }, []);

  const connectWebSocket = useCallback(() => {
    const apiUrl = process.env.NEXT_PUBLIC_INSTALLER_API_URL || 'http://localhost:3031';
    const wsUrl = apiUrl.replace(/\/api$/, '');

    if (socketRef.current) {
      socketRef.current.emit('unsubscribe-job', jobId);
      socketRef.current.emit('unsubscribe-active-jobs');
      socketRef.current.disconnect();
    }

    const newSocket = io(wsUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected for job detail');
      newSocket.emit('subscribe-job', jobId);
      // Also join active-jobs room for global updates
      newSocket.emit('subscribe-active-jobs');
    });

    // Listen to job-specific log event (new queue system)
    newSocket.on(`job-${jobId}-log`, (data: any) => {
      console.log('Job log received:', data);

      addLog({
        timestamp: data.timestamp || new Date().toISOString(),
        level: data.level || 'info',
        message: data.message,
        details: data
      });

      // Also update progress if provided
      if (data.step || data.percent !== undefined) {
        updateJobProgress({
          step: data.step,
          message: data.message,
          percent: data.percent
        });
      }
    });

    // Listen to job-specific progress event (legacy)
    newSocket.on(`job-${jobId}-progress`, (data: any) => {
      console.log('Job progress received:', data);

      // Only update progress, don't add log (already handled by job-${jobId}-log event)
      updateJobProgress(data);
    });

    // Listen to job-specific completed event
    newSocket.on(`job-${jobId}-completed`, (data: any) => {
      console.log('Job completed:', data);

      setJob(prev => prev ? { ...prev, status: 'completed', progress: 100 } : prev);
      addLog({
        timestamp: new Date().toISOString(),
        level: 'success',
        message: 'Kurulum başarıyla tamamlandı!'
      });

      // Refresh job details to get final state
      fetchJobDetail();
    });

    // Listen to job-specific failed event
    newSocket.on(`job-${jobId}-failed`, (data: any) => {
      console.log('Job failed:', data);

      setJob(prev => prev ? { ...prev, status: 'failed', failedReason: data.error } : prev);
      addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Kurulum başarısız: ${data.error}`
      });

      // Refresh job details to get error details
      fetchJobDetail();
    });

    // Also listen to global job-update event from active-jobs room
    newSocket.on('job-update', (data: any) => {
      if (data.jobId !== jobId) return;

      console.log('Global job update received:', data);

      // Handle different event types
      if (data.event === 'progress' && data.data) {
        updateJobProgress(data.data);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `${data.data.step}: ${data.data.message}`,
          details: data.data
        });
      } else if (data.event === 'completed') {
        setJob(prev => prev ? { ...prev, status: 'completed', progress: 100 } : prev);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'success',
          message: 'Kurulum başarıyla tamamlandı!'
        });
        fetchJobDetail();
      } else if (data.event === 'failed') {
        setJob(prev => prev ? { ...prev, status: 'failed', failedReason: data.data?.error } : prev);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Kurulum başarısız: ${data.data?.error || 'Bilinmeyen hata'}`
        });
        fetchJobDetail();
      }
    });

    socketRef.current = newSocket;
  }, [addLog, fetchJobDetail, jobId, updateJobProgress]);

  useEffect(() => {
    if (jobId) {
      fetchJobDetail();
      connectWebSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe-job', jobId);
        socketRef.current.emit('unsubscribe-active-jobs');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [jobId, fetchJobDetail, connectWebSocket]);

  const handleCancel = async () => {
    if (!confirm('Bu kurulumu iptal etmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const response = await apiFetch(`/api/setup-queue/job/${jobId}/cancel`, {
        method: 'POST'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      toast.success('Kurulum iptal edildi');
      fetchJobDetail();
    } catch (error: any) {
      toast.error(error.message || 'Kurulum iptal edilemedi');
    }
  };

  const handleRetry = async () => {
    try {
      const response = await apiFetch(`/api/setup-queue/job/${jobId}/retry`, {
        method: 'POST'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      const data = await response.json();
      toast.success('Yeni kurulum başlatıldı');
      router.push(`/setup/${data.newJobId}`);
    } catch (error: any) {
      toast.error(error.message || 'Kurulum tekrar denenemedi');
    }
  };

  const handleCleanup = async (force: boolean = false) => {
    if (!confirm(`${force ? 'Zorla temizlik' : 'Temizlik'} yapmak istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      const response = await apiFetch(`/api/setup-queue/job/${jobId}/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      toast.success('Temizlik planlandı');
    } catch (error: any) {
      toast.error(error.message || 'Temizlik yapılamadı');
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadLogs = () => {
    const logContent = logs.map(log =>
      `[${format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');

    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-${jobId}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-5 h-5" />;
      case 'active':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'bg-gray-100 text-gray-700';
      case 'active':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Job bulunamadı veya erişim yetkiniz yok.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/setup/active')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{job.domain}</h1>
            <p className="text-muted-foreground">
              Job ID: {jobId} • {job.type === 'template' ? 'Legacy Template' : 'Git Repository'}
            </p>
          </div>
        </div>
        <Badge className={getStatusColor(job.status)}>
          <span className="flex items-center gap-1">
            {getStatusIcon(job.status)}
            {job.status === 'waiting' && 'Bekliyor'}
            {job.status === 'active' && 'Çalışıyor'}
            {job.status === 'completed' && 'Tamamlandı'}
            {job.status === 'failed' && 'Başarısız'}
            {job.status === 'cancelled' && 'İptal'}
          </span>
        </Badge>
      </div>

      {/* Progress */}
      {job.status === 'active' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>İlerleme</CardTitle>
            <CardDescription>{job.currentStep || 'İşlem devam ediyor...'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={job.progress} className="h-3 mb-2" />
            <p className="text-sm text-muted-foreground">%{job.progress} tamamlandı</p>
          </CardContent>
        </Card>
      )}

      {/* Failed Alert */}
      {job.status === 'failed' && job.failedReason && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Hata:</strong> {job.failedReason}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList>
          <TabsTrigger value="progress">
            <Activity className="w-4 h-4 mr-2" />
            İlerleme
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Terminal className="w-4 h-4 mr-2" />
            Loglar ({logs.length})
          </TabsTrigger>
          <TabsTrigger value="config">
            <FileJson className="w-4 h-4 mr-2" />
            Konfigürasyon
          </TabsTrigger>
        </TabsList>

        {/* Progress Tab */}
        <TabsContent value="progress">
          <BuildProgress
            steps={steps.map(step => {
              // Calculate duration if both timestamps are available
              let duration: number | undefined;
              if (step.startedAt && step.completedAt) {
                const start = new Date(step.startedAt).getTime();
                const end = new Date(step.completedAt).getTime();
                duration = end - start;
              }

              // Find matching SETUP_STEPS definition for icon
              const stepDef = SETUP_STEPS.find(s => s.id === step.id);

              return {
                id: step.id,
                name: step.label,
                status: step.status === 'pending' ? 'pending' as const :
                        step.status === 'running' ? 'running' as const :
                        step.status === 'completed' ? 'completed' as const : 'error' as const,
                icon: stepDef?.icon,
                message: step.error,
                duration
              } as BuildStep;
            })}
            title="Kurulum Adımları"
            showDetails={true}
            compact={false}
          />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Sistem Logları</CardTitle>
                  <CardDescription>
                    Kurulum sürecindeki tüm log kayıtları
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadLogs}
                  disabled={logs.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  İndir
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground">Henüz log kaydı yok</p>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`text-xs font-mono ${
                          log.level === 'error' ? 'text-red-600' :
                          log.level === 'warning' ? 'text-yellow-600' :
                          log.level === 'success' ? 'text-green-600' :
                          'text-gray-600'
                        }`}
                      >
                        <span className="text-gray-500">
                          [{format(new Date(log.timestamp), 'HH:mm:ss')}]
                        </span>
                        {' '}
                        <span className={`font-semibold ${
                          log.level === 'error' ? 'text-red-700' :
                          log.level === 'warning' ? 'text-yellow-700' :
                          log.level === 'success' ? 'text-green-700' :
                          'text-gray-700'
                        }`}>
                          [{log.level.toUpperCase()}]
                        </span>
                        {' '}
                        {log.message}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Kurulum Konfigürasyonu</CardTitle>
              <CardDescription>
                Bu kurulum için kullanılan konfigürasyon detayları
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Domain</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 p-2 bg-gray-100 rounded text-sm">
                      {job.domain}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(job.domain, 'domain')}
                    >
                      {copied === 'domain' ? (
                        <CheckCheck className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Kurulum Tipi</label>
                  <p className="mt-1 text-sm">{job.type === 'template' ? 'Legacy Template' : 'Git Repository'}</p>
                </div>

                {job.type === 'git' && job.config?.gitUrl && (
                  <div>
                    <label className="text-sm font-medium">Git URL</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 p-2 bg-gray-100 rounded text-sm">
                        {job.config?.gitUrl}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(job.config?.gitUrl || '', 'gitUrl')}
                      >
                        {copied === 'gitUrl' ? (
                          <CheckCheck className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {job.type === 'git' && job.config?.branch && (
                  <div>
                    <label className="text-sm font-medium">Branch</label>
                    <p className="mt-1 text-sm">{job.config?.branch}</p>
                  </div>
                )}

                <Separator />

                <div>
                  <label className="text-sm font-medium">Detaylı Konfigürasyon</label>
                  <ScrollArea className="h-[300px] w-full mt-2">
                    <pre className="p-4 bg-gray-100 rounded text-xs">
                      {JSON.stringify(job.config ?? job.data?.config ?? {}, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>İşlemler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {job.status === 'active' && (
              <Button variant="destructive" onClick={handleCancel}>
                <Pause className="w-4 h-4 mr-2" />
                İptal Et
              </Button>
            )}
            {job.status === 'failed' && (
              <>
                <Button onClick={handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tekrar Dene
                </Button>
                <Button variant="outline" onClick={() => handleCleanup(false)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Temizle
                </Button>
                <Button variant="destructive" onClick={() => handleCleanup(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Zorla Temizle
                </Button>
              </>
            )}
            {job.status === 'cancelled' && (
              <>
                <Button onClick={handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Yeniden Başlat
                </Button>
                <Button variant="outline" onClick={() => handleCleanup(false)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Temizle
                </Button>
              </>
            )}
            {job.status === 'completed' && job.customerId && (
              <Button onClick={() => router.push(`/customers/${job.customerId}`)}>
                <Play className="w-4 h-4 mr-2" />
                Müşteri Detayına Git
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
