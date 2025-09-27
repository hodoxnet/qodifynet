"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Clock,
  Filter,
  Download,
  RefreshCw,
  User,
  Server,
  Package,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

interface ActivityLog {
  id: string;
  type: "deployment" | "system" | "user" | "error" | "warning" | "info";
  action: string;
  message: string;
  details?: string;
  timestamp: string;
  user?: string;
  entityId?: string;
  entityType?: string;
  severity: "low" | "medium" | "high" | "critical";
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("today");

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      // Simulated data - gerçek API'ye bağlanacak
      const mockActivities: ActivityLog[] = [
        {
          id: "1",
          type: "deployment",
          action: "Customer Deployed",
          message: "testmusteri.local kurulumu başarıyla tamamlandı",
          timestamp: new Date().toISOString(),
          user: "Admin",
          entityId: "cust-1",
          entityType: "customer",
          severity: "low",
        },
        {
          id: "2",
          type: "system",
          action: "Service Restarted",
          message: "Nginx servisi yeniden başlatıldı",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          severity: "medium",
        },
        {
          id: "3",
          type: "error",
          action: "Deployment Failed",
          message: "example.com kurulumu DNS hatası nedeniyle başarısız",
          details: "A kaydı bulunamadı",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          severity: "high",
        },
        {
          id: "4",
          type: "user",
          action: "Settings Updated",
          message: "Sistem ayarları güncellendi",
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          user: "Admin",
          severity: "low",
        },
        {
          id: "5",
          type: "info",
          action: "Backup Created",
          message: "Günlük yedekleme başarıyla tamamlandı",
          timestamp: new Date(Date.now() - 14400000).toISOString(),
          severity: "low",
        },
      ];

      // Filtreleme
      let filtered = mockActivities;
      if (filter !== "all") {
        filtered = filtered.filter((a) => a.type === filter);
      }
      if (searchTerm) {
        filtered = filtered.filter(
          (a) =>
            a.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.action.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setActivities(filtered);
    } catch (error) {
      toast.error("Aktiviteler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [filter, searchTerm]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "deployment":
        return <Package className="w-4 h-4" />;
      case "system":
        return <Server className="w-4 h-4" />;
      case "user":
        return <User className="w-4 h-4" />;
      case "error":
        return <XCircle className="w-4 h-4" />;
      case "warning":
        return <AlertCircle className="w-4 h-4" />;
      case "info":
        return <Info className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "deployment":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "system":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "user":
        return "bg-green-100 text-green-700 border-green-200";
      case "error":
        return "bg-red-100 text-red-700 border-red-200";
      case "warning":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "info":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: "bg-gray-100 text-gray-600",
      medium: "bg-yellow-100 text-yellow-700",
      high: "bg-orange-100 text-orange-700",
      critical: "bg-red-100 text-red-700",
    };
    return colors[severity as keyof typeof colors] || colors.low;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Az önce";
    if (minutes < 60) return `${minutes} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    return `${days} gün önce`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Son Aktiviteler</h1>
          <p className="text-sm text-gray-600">
            Sistem olayları ve işlem kayıtları
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchActivities()}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Yenile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Aktivitelerde ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="all">Tüm Aktiviteler</option>
              <option value="deployment">Kurulumlar</option>
              <option value="system">Sistem</option>
              <option value="user">Kullanıcı</option>
              <option value="error">Hatalar</option>
              <option value="warning">Uyarılar</option>
              <option value="info">Bilgi</option>
            </select>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="all">Tümü</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activities List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Aktivite Bulunamadı
          </h3>
          <p className="text-sm text-gray-600">
            Seçili filtrelere uygun aktivite kaydı yok
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-200">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 rounded-lg border ${getActivityColor(
                      activity.type
                    )}`}
                  >
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {activity.action}
                          </h3>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${getSeverityBadge(
                              activity.severity
                            )}`}
                          >
                            {activity.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{activity.message}</p>
                        {activity.details && (
                          <p className="text-xs text-gray-500 mt-1">
                            {activity.details}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(activity.timestamp)}
                          </span>
                          {activity.user && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {activity.user}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
