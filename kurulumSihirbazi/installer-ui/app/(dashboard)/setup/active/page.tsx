"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle, Clock, Loader2, Play, Pause, Trash2, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getAccessToken } from "@/lib/api";
import { io, Socket } from "socket.io-client";

interface SetupJob {
  id: string;
  domain: string;
  type: 'template' | 'git';
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: string;
  currentStep?: string;
  partnerId?: string;
}

interface JobProgress {
  percent: number;
  step: string;
  message: string;
}

export default function ActiveSetupsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<SetupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchJobs();
    fetchStats();
    connectWebSocket();

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      fetchJobs();
      fetchStats();
    }, 5000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.emit('unsubscribe-active-jobs');
        socket.disconnect();
      }
    };
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await apiFetch('/api/setup-queue/jobs');
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Kurulumlar alınamadı' }));
        throw new Error(error.message || 'Kurulumlar alınamadı');
      }
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error: any) {
      console.error('Failed to fetch jobs:', error);
      if (!loading) {
        toast.error('Kurulumlar alınamadı');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiFetch('/api/setup-queue/stats');
      if (!response.ok) {
        throw new Error('İstatistikler alınamadı');
      }
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const connectWebSocket = () => {
    const apiUrl = process.env.NEXT_PUBLIC_INSTALLER_API_URL || 'http://localhost:3031';
    const wsUrl = apiUrl.replace(/\/api$/, '');
    const newSocket = io(wsUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected for active jobs');
      newSocket.emit('subscribe-active-jobs');
    });

    newSocket.on('job-update', (data: any) => {
      console.log('Job update received:', data);

      // Update job progress
      if (data.event === 'progress' && data.data) {
        updateJobProgress(data.jobId, data.data);
      }

      // Update job status
      if (data.event === 'completed' || data.event === 'failed') {
        fetchJobs(); // Refresh the list
      }
    });

    setSocket(newSocket);
  };

  const updateJobProgress = (jobId: string, progress: JobProgress) => {
    setJobs(prev => prev.map(job => {
      if (job.id === jobId) {
        return {
          ...job,
          progress: progress.percent,
          currentStep: `${progress.step}: ${progress.message}`
        };
      }
      return job;
    }));
  };

  const handleCancel = async (jobId: string) => {
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
      fetchJobs();
    } catch (error: any) {
      toast.error(error.message || 'Kurulum iptal edilemedi');
    }
  };

  const handleRetry = async (jobId: string) => {
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

  const handleCleanup = async (jobId: string, force: boolean = false) => {
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

  const handleViewDetails = (jobId: string) => {
    router.push(`/setup/${jobId}`);
  };

  const openBullDashboard = () => {
    try {
      const base = (process.env.NEXT_PUBLIC_INSTALLER_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3031').replace(/\/$/, '');
      const url = new URL('/api/setup-queue/dashboard', base);
      const token = getAccessToken();
      const secureFlag = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
      if (token) {
        url.searchParams.set('access_token', token);
        document.cookie = `bull_access=${token}; Path=/; Max-Age=180; SameSite=Lax${secureFlag}`;
      }
      window.open(url.toString(), '_blank', 'noopener');
      if (token) {
        setTimeout(() => {
          document.cookie = `bull_access=; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`;
        }, 30000);
      }
    } catch (error) {
      console.error('Bull dashboard açılırken hata:', error);
      toast.error('Bull dashboard açılamadı');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-4 h-4" />;
      case 'active':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4" />;
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Aktif Kurulumlar</h1>
          <p className="text-muted-foreground">Devam eden ve bekleyen kurulumları yönetin</p>
        </div>
        <Button onClick={() => router.push('/setup')}>
          <Play className="w-4 h-4 mr-2" />
          Yeni Kurulum
        </Button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Bekleyen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.waiting}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Aktif</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tamamlanan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Başarısız</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Eşzamanlılık</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}/{stats.concurrency}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Job Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Aktif kurulum yok</p>
              <p className="text-muted-foreground">Yeni bir kurulum başlatın</p>
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleViewDetails(job.id)}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{job.domain}</CardTitle>
                    <CardDescription>
                      {job.type === 'template' ? 'Legacy Template' : 'Git Repository'} • {new Date(job.createdAt).toLocaleString('tr-TR')}
                    </CardDescription>
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
              </CardHeader>
              <CardContent>
                {job.status === 'active' && (
                  <>
                    <div className="mb-2">
                      <Progress value={job.progress} className="h-2" />
                    </div>
                    <p className="text-sm text-muted-foreground">{job.currentStep || 'İşlem devam ediyor...'}</p>
                  </>
                )}

                <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                  {job.status === 'active' && (
                    <Button size="sm" variant="destructive" onClick={() => handleCancel(job.id)}>
                      <Pause className="w-3 h-3 mr-1" />
                      İptal
                    </Button>
                  )}
                  {job.status === 'failed' && (
                    <>
                      <Button size="sm" variant="default" onClick={() => handleRetry(job.id)}>
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Tekrar Dene
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleCleanup(job.id, false)}>
                        <Trash2 className="w-3 h-3 mr-1" />
                        Temizle
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleViewDetails(job.id)}>
                    <Eye className="w-3 h-3 mr-1" />
                    Detaylar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Queue Dashboard Link */}
      <div className="mt-8 text-center">
        <Button variant="outline" onClick={openBullDashboard}>
          Bull Dashboard&apos;u Aç
        </Button>
      </div>
    </div>
  );
}
