"use client";

import { useState } from "react";
import { usePartners } from "@/hooks/partners/usePartners";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  Users,
  Wallet,
  RefreshCw,
  Plus,
  ArrowRight,
  Building2,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";

export default function PartnersPage() {
  const { items, loading, refresh, create } = usePartners();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [credits, setCredits] = useState(1);
  const [creating, setCreating] = useState(false);

  const stats = {
    total: items.length,
    active: items.filter(p => p.status === 'ACTIVE').length,
    totalBalance: items.reduce((sum, p) => sum + (p.wallet?.balance ?? 0), 0),
    avgCredits: items.length > 0
      ? Math.round(items.reduce((sum, p) => sum + (p.pricing?.setupCredits ?? 0), 0) / items.length)
      : 0,
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await create(name, credits);
      setName("");
      setCredits(1);
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      ACTIVE: { variant: "default" as const, icon: CheckCircle2, label: "Aktif" },
      INACTIVE: { variant: "secondary" as const, icon: XCircle, label: "Pasif" },
      PENDING: { variant: "outline" as const, icon: Clock, label: "Beklemede" },
    };
    const config = variants[status as keyof typeof variants] || variants.PENDING;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partnerler</h1>
          <p className="text-muted-foreground mt-1">Partner yönetimi ve izleme</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Partner
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Partner</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.total}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif Partner</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.active}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Bakiye</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.totalBalance}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ort. Kurulum Kredisi</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.avgCredits}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Partners List */}
      <Card>
        <CardHeader>
          <CardTitle>Partner Listesi</CardTitle>
          <CardDescription>Tüm kayıtlı partnerler ve bilgileri</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Henüz partner yok</h3>
              <p className="text-sm text-muted-foreground mb-4">
                İlk partnerinizi oluşturarak başlayın
              </p>
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Yeni Partner Ekle
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Partner</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Durum</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Bakiye</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Kurulum Kredisi</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(p => (
                    <tr key={p.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-sm text-muted-foreground font-mono">{p.id.slice(0, 12)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(p.status)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{p.wallet?.balance ?? 0}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span>{p.pricing?.setupCredits ?? '-'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <Link href={`/partners/${p.id}`}>
                          <Button variant="ghost" size="sm">
                            Detay
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Partner Oluştur</DialogTitle>
            <DialogDescription>
              Yeni bir partner kaydı oluşturun ve başlangıç ayarlarını yapın
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="partner-name">Partner Adı</Label>
              <Input
                id="partner-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Örn: Web Ofisi LTD."
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-credits">Kurulum Kredisi</Label>
              <Input
                id="setup-credits"
                type="number"
                min="1"
                value={credits}
                onChange={e => setCredits(parseInt(e.target.value || '1'))}
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">
                Partner başına müşteri kurulumu için kullanılacak kredi miktarı
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
              İptal
            </Button>
            <Button onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Oluştur
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

