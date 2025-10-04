"use client";

import { useState } from "react";
import { usePartnerApplications } from "@/hooks/partners/usePartnerApplications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApproveApplicationDialog } from "@/components/partners/ApproveApplicationDialog";
import { RejectApplicationDialog } from "@/components/partners/RejectApplicationDialog";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  User,
  Calendar,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function PartnerApplicationsPage() {
  const pendingApps = usePartnerApplications("pending");
  const approvedApps = usePartnerApplications("approved");
  const rejectedApps = usePartnerApplications("rejected");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { label: "Bekliyor", icon: Clock, className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400" },
      approved: { label: "Onaylandı", icon: CheckCircle, className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400" },
      rejected: { label: "Reddedildi", icon: XCircle, className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400" },
    };
    const variant = variants[status as keyof typeof variants] || variants.pending;
    const Icon = variant.icon;
    return (
      <Badge variant="outline" className={variant.className}>
        <Icon className="w-3 h-3 mr-1" />
        {variant.label}
      </Badge>
    );
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const ApplicationCard = ({ app, showActions }: { app: any; showActions: boolean }) => {
    const form = app.form || {};
    const isExpanded = expandedId === app.id;

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg mb-2">{form.name || 'İsimsiz Başvuru'}</CardTitle>
                <CardDescription className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4" />
                    {form.email || '-'}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    {formatDate(app.createdAt)}
                  </div>
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(app.status)}
              {showActions && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      setSelectedId(app.id);
                      setApproveOpen(true);
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Onayla
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setSelectedId(app.id);
                      setRejectOpen(true);
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reddet
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandedId(isExpanded ? null : app.id)}
            className="w-full mb-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Detayları Gizle
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                Detayları Göster
              </>
            )}
          </Button>

          {isExpanded && (
            <div className="grid gap-4 pt-4 border-t">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Firma Bilgileri */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Firma Bilgileri
                  </h4>
                  {form.phone && (
                    <div className="flex items-start gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Telefon</p>
                        <p>{form.phone}</p>
                      </div>
                    </div>
                  )}
                  {form.taxId && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Vergi No</p>
                        <p>{form.taxId}</p>
                      </div>
                    </div>
                  )}
                  {form.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Adres</p>
                        <p>{form.address}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Yönetici Bilgileri */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Yönetici Bilgileri
                  </h4>
                  {form.adminName && (
                    <div className="flex items-start gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">İsim</p>
                        <p>{form.adminName}</p>
                      </div>
                    </div>
                  )}
                  {form.adminEmail && (
                    <div className="flex items-start gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">E-posta</p>
                        <p>{form.adminEmail}</p>
                      </div>
                    </div>
                  )}
                  {form.adminPassword && (
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Şifre</p>
                        <p className="text-green-600">Belirlenmiş</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground font-mono">ID: {app.id}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const ApplicationList = ({ apps, loading, showActions }: { apps: any[]; loading: boolean; showActions: boolean }) => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      );
    }

    if (apps.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Başvuru Bulunamadı</h3>
            <p className="text-sm text-muted-foreground">
              Bu kategoride henüz başvuru yok
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {apps.map((app) => (
          <ApplicationCard key={app.id} app={app} showActions={showActions} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partner Başvuruları</h1>
          <p className="text-muted-foreground mt-1">
            Başvuruları inceleyin ve onaylayın
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            pendingApps.refresh();
            approvedApps.refresh();
            rejectedApps.refresh();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Tümünü Yenile
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApps.items.length}</div>
            <p className="text-xs text-muted-foreground">
              Onay bekliyor
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onaylanan</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedApps.items.length}</div>
            <p className="text-xs text-muted-foreground">
              Partner olarak eklendi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reddedilen</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedApps.items.length}</div>
            <p className="text-xs text-muted-foreground">
              Uygun bulunmadı
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            Bekleyen
            {pendingApps.items.length > 0 && (
              <span className="ml-2 bg-yellow-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingApps.items.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Onaylanan</TabsTrigger>
          <TabsTrigger value="rejected">Reddedilen</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <ApplicationList
            apps={pendingApps.items}
            loading={pendingApps.loading}
            showActions={true}
          />
        </TabsContent>

        <TabsContent value="approved">
          <ApplicationList
            apps={approvedApps.items}
            loading={approvedApps.loading}
            showActions={false}
          />
        </TabsContent>

        <TabsContent value="rejected">
          <ApplicationList
            apps={rejectedApps.items}
            loading={rejectedApps.loading}
            showActions={false}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ApproveApplicationDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        onApprove={async (payload) => {
          if (selectedId) {
            await pendingApps.approve(selectedId, payload);
            approvedApps.refresh();
          }
        }}
      />

      <RejectApplicationDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onReject={async (reason) => {
          if (selectedId) {
            await pendingApps.reject(selectedId, reason);
            rejectedApps.refresh();
          }
        }}
      />
    </div>
  );
}
