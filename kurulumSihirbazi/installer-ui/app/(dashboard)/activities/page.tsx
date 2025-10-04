"use client";

import { useState, useMemo } from "react";
import {
  Activity,
  Clock,
  RefreshCw,
  User,
  Building2,
  UserPlus,
  Wallet,
  Package,
  Server,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function ActivitiesPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("all");
  const { logs, loading, refresh, total, page, pageSize, totalPages, goToPage, changePageSize } = useAuditLogs(10);

  if (user?.role !== "SUPER_ADMIN") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/20">
                <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Yetkisiz Erişim
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Bu sayfaya erişim yetkiniz bulunmamaktadır. Aktivite logları sadece SUPER_ADMIN rolüne sahip kullanıcılar tarafından görüntülenebilir.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getActionIcon = (action: string) => {
    if (action.includes('PARTNER')) return <Building2 className="w-4 h-4" />;
    if (action.includes('CREDIT')) return <Wallet className="w-4 h-4" />;
    if (action.includes('MEMBER')) return <UserPlus className="w-4 h-4" />;
    if (action.includes('CUSTOMER')) return <Package className="w-4 h-4" />;
    if (action.includes('USER')) return <User className="w-4 h-4" />;
    if (action.includes('DEPLOY')) return <Server className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400";
    if (action.includes('DELETE')) return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400";
    if (action.includes('UPDATE') || action.includes('GRANT')) return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400";
    if (action.includes('APPROVE')) return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400";
    if (action.includes('REJECT')) return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400";
    return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300";
  };

  const formatAction = (action: string) => {
    const map: Record<string, string> = {
      'PARTNER_CREATE': 'Partner Oluşturuldu',
      'PARTNER_CREDIT_GRANT': 'Kredi Yüklendi',
      'PARTNER_MEMBER_ADD': 'Üye Eklendi',
      'PARTNER_APPLICATION_APPROVE': 'Başvuru Onaylandı',
      'PARTNER_APPLICATION_REJECT': 'Başvuru Reddedildi',
      'PARTNER_PRICING_UPDATE': 'Fiyatlandırma Güncellendi',
      'CUSTOMER_CREATE': 'Müşteri Oluşturuldu',
      'CUSTOMER_DELETE': 'Müşteri Silindi',
      'CUSTOMER_START': 'Müşteri Başlatıldı',
      'CUSTOMER_STOP': 'Müşteri Durduruldu',
    };
    return map[action] || action.replace(/_/g, ' ');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return "Az önce";
    if (minutes < 60) return `${minutes} dk önce`;
    if (hours < 24) return `${hours} saat önce`;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Son Aktiviteler</h1>
          <p className="text-muted-foreground mt-1">
            Sistem olayları ve işlem kayıtları
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Toplam <span className="font-semibold text-foreground">{total}</span> kayıt
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Filtrele:</span>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                const action = e.target.value !== "all" ? e.target.value.toUpperCase() : undefined;
                refresh({ action, page: 1 });
              }}
              className="px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Tüm Aktiviteler</option>
              <option value="partner">Partner İşlemleri</option>
              <option value="customer">Müşteri İşlemleri</option>
              <option value="credit">Kredi İşlemleri</option>
              <option value="member">Üyelik İşlemleri</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Activities List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Aktivite Bulunamadı
            </h3>
            <p className="text-sm text-muted-foreground">
              Seçili filtrelere uygun aktivite kaydı yok
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg border ${getActionColor(log.action)}`}>
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold mb-1">
                            {formatAction(log.action)}
                          </h3>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="text-sm text-muted-foreground space-y-1">
                              {log.metadata.name && <p>İsim: {log.metadata.name}</p>}
                              {log.metadata.email && <p>E-posta: {log.metadata.email}</p>}
                              {log.metadata.amount && <p>Miktar: {log.metadata.amount}</p>}
                              {log.metadata.setupCredits && <p>Kurulum Kredisi: {log.metadata.setupCredits}</p>}
                            </div>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(log.createdAt)}
                            </span>
                            {log.actor && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {log.actor.email}
                              </span>
                            )}
                          </div>
                        </div>
                        {log.targetType && (
                          <Badge variant="outline" className="text-xs">
                            {log.targetType}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && logs.length > 0 && total > pageSize && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sayfa başına:</span>
                <select
                  value={pageSize}
                  onChange={(e) => changePageSize(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <span className="text-sm text-muted-foreground ml-4">
                  {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} / {total}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(1)}
                  disabled={page === 1}
                >
                  İlk
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className="min-w-[40px]"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(totalPages)}
                  disabled={page === totalPages}
                >
                  Son
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
