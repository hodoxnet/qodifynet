"use client";

import { useParams } from "next/navigation";
import { usePartnerDetail } from "@/hooks/partners/usePartners";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import {
  Wallet,
  CreditCard,
  UserPlus,
  RefreshCw,
  ArrowLeft,
  TrendingUp,
  Settings,
  Users,
  History,
  Mail,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Package
} from "lucide-react";
import Link from "next/link";
import { useCustomerList } from "@/hooks/customers/useCustomerList";
import { useCustomerActions } from "@/hooks/customers/useCustomerActions";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { CustomerInfoDialog } from "@/components/customers/CustomerInfoDialog";
import { DeleteCustomerDialog } from "@/components/customers/DeleteCustomerDialog";

export default function PartnerDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { partner, wallet, members, ledger, loading, refresh, grant, setPricing, addMemberByEmail } = usePartnerDetail(id);
  const [amount, setAmount] = useState<number>(10);
  const [setupCredits, setSetupCredits] = useState<number>(partner?.pricing?.setupCredits || 1);
  const [newMember, setNewMember] = useState<{ email: string; password: string; name: string; role: 'PARTNER_ADMIN'|'PARTNER_INSTALLER' }>({ email: '', password: '', name: '', role: 'PARTNER_INSTALLER' });
  const [grantLoading, setGrantLoading] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);

  // Customer management
  const { customers, loading: customersLoading, error: customersError, refresh: refreshCustomers } = useCustomerList({ partnerId: id });
  const { handleStart, handleStop, handleRestart, handleDelete, actionLoading } = useCustomerActions(refreshCustomers);
  const [infoCustomer, setInfoCustomer] = useState<any>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<any>(null);

  if (!id) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Geçersiz Partner ID</h2>
          <Link href="/partners" className="mt-4 inline-block">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Partnerlere Dön
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

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

  const getRoleBadge = (role: string) => {
    return role === 'PARTNER_ADMIN' ? (
      <Badge variant="default" className="gap-1">
        <Shield className="h-3 w-3" />
        Admin
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1">
        <Users className="h-3 w-3" />
        Installer
      </Badge>
    );
  };

  const handleGrant = async () => {
    if (amount <= 0) return;
    setGrantLoading(true);
    try {
      await grant(amount);
      setAmount(10);
    } finally {
      setGrantLoading(false);
    }
  };

  const handleSetPricing = async () => {
    if (setupCredits <= 0) return;
    setPricingLoading(true);
    try {
      await setPricing(setupCredits);
    } finally {
      setPricingLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.email || !newMember.password) return;
    setMemberLoading(true);
    try {
      await addMemberByEmail(newMember.email, newMember.role, newMember.password, newMember.name || undefined);
      setNewMember({ email: '', password: '', name: '', role: 'PARTNER_INSTALLER' });
    } finally {
      setMemberLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/partners">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{partner?.name || 'Partner'}</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground font-mono">{id}</p>
                {partner?.status && getStatusBadge(partner.status)}
              </div>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cüzdan Bakiyesi</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wallet?.balance ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Kullanılabilir kredi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kurulum Kredisi</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partner?.pricing?.setupCredits ?? '-'}</div>
            <p className="text-xs text-muted-foreground mt-1">Her kurulum için</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Üye</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Aktif kullanıcı</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">İşlem Sayısı</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ledger.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Ledger kaydı</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="customers">
            Müşteriler ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="members">Üyeler ({members.length})</TabsTrigger>
          <TabsTrigger value="ledger">İşlem Geçmişi ({ledger.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Wallet Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Cüzdan Yönetimi
                </CardTitle>
                <CardDescription>Partner bakiyesine kredi ekleyin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Mevcut Bakiye</span>
                    <span className="text-2xl font-bold">{wallet?.balance ?? 0}</span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="grant-amount">Yüklenecek Kredi Miktarı</Label>
                  <Input
                    id="grant-amount"
                    type="number"
                    min="1"
                    value={amount}
                    onChange={e => setAmount(parseInt(e.target.value || '0'))}
                    disabled={grantLoading}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleGrant}
                  disabled={grantLoading || amount <= 0}
                >
                  {grantLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Yükleniyor...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Kredi Yükle
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Pricing Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Fiyatlandırma Ayarları
                </CardTitle>
                <CardDescription>Kurulum maliyeti ayarlarını düzenleyin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Mevcut Kurulum Kredisi</span>
                    <span className="text-2xl font-bold">{partner?.pricing?.setupCredits ?? '-'}</span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="setup-credits">Yeni Kurulum Kredisi</Label>
                  <Input
                    id="setup-credits"
                    type="number"
                    min="1"
                    value={setupCredits}
                    onChange={e => setSetupCredits(parseInt(e.target.value || '1'))}
                    disabled={pricingLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Her müşteri kurulumu için düşülecek kredi miktarı
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={handleSetPricing}
                  disabled={pricingLoading || setupCredits <= 0}
                >
                  {pricingLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Kaydet
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Add Member */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Yeni Üye Ekle
              </CardTitle>
              <CardDescription>Yeni kullanıcı oluşturun ve partner organizasyonuna ekleyin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="member-email">E-posta *</Label>
                  <Input
                    id="member-email"
                    type="email"
                    placeholder="kullanici@ornek.com"
                    value={newMember.email}
                    onChange={e => setNewMember(v => ({ ...v, email: e.target.value }))}
                    disabled={memberLoading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-password">Şifre *</Label>
                  <Input
                    id="member-password"
                    type="password"
                    placeholder="En az 6 karakter"
                    value={newMember.password}
                    onChange={e => setNewMember(v => ({ ...v, password: e.target.value }))}
                    disabled={memberLoading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-name">İsim (opsiyonel)</Label>
                  <Input
                    id="member-name"
                    placeholder="Ahmet Yılmaz"
                    value={newMember.name}
                    onChange={e => setNewMember(v => ({ ...v, name: e.target.value }))}
                    disabled={memberLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-role">Rol *</Label>
                  <Select
                    value={newMember.role}
                    onValueChange={(v) => setNewMember(m => ({ ...m, role: v as any }))}
                    disabled={memberLoading}
                  >
                    <SelectTrigger id="member-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PARTNER_ADMIN">Admin</SelectItem>
                      <SelectItem value="PARTNER_INSTALLER">Installer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleAddMember}
                disabled={memberLoading || !newMember.email || !newMember.password || newMember.password.length < 6}
              >
                {memberLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Ekleniyor...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Üye Ekle
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Partner Üyeleri</CardTitle>
              <CardDescription>Organizasyona bağlı tüm kullanıcılar</CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Henüz üye yok</h3>
                  <p className="text-sm text-muted-foreground">İlk üyeyi ekleyerek başlayın</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Kullanıcı</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Rol</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m: any) => (
                        <tr key={m.id} className="border-b transition-colors hover:bg-muted/50">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{m.user?.email || 'N/A'}</span>
                            </div>
                            {m.user?.name && (
                              <div className="text-sm text-muted-foreground mt-1">{m.user.name}</div>
                            )}
                          </td>
                          <td className="p-4">
                            {getRoleBadge(m.role)}
                          </td>
                          <td className="p-4">
                            <code className="text-xs bg-muted px-2 py-1 rounded">{m.userId}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle>Müşteri Listesi</CardTitle>
              <CardDescription>Bu partnere ait tüm müşteriler ve durumları</CardDescription>
            </CardHeader>
            <CardContent>
              <CustomersTable
                customers={customers}
                loading={customersLoading}
                error={customersError}
                actionLoading={actionLoading}
                onStart={handleStart}
                onStop={handleStop}
                onRestart={handleRestart}
                onDelete={(customerId, domain) => {
                  const customer = customers.find(c => c.id === customerId);
                  if (customer) setDeleteCustomer(customer);
                }}
                onInfo={(customer) => setInfoCustomer(customer)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <CardTitle>İşlem Geçmişi</CardTitle>
              <CardDescription>Tüm kredi hareketleri ve işlemler</CardDescription>
            </CardHeader>
            <CardContent>
              {ledger.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Henüz işlem yok</h3>
                  <p className="text-sm text-muted-foreground">İşlem geçmişi burada görünecek</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ledger.map((l: any) => (
                    <div key={l.id} className="flex items-start gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        l.delta > 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
                      }`}>
                        {l.delta > 0 ? (
                          <ArrowUpRight className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{l.reason}</p>
                          <p className={`font-bold ${l.delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {l.delta > 0 ? '+' : ''}{l.delta}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{new Date(l.createdAt).toLocaleString('tr-TR')}</span>
                          {l.reference && (
                            <code className="bg-muted px-2 py-0.5 rounded">{l.reference}</code>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Customer Info Dialog */}
      <CustomerInfoDialog
        customer={infoCustomer}
        open={!!infoCustomer}
        onOpenChange={(open) => !open && setInfoCustomer(null)}
      />

      {/* Delete Customer Dialog */}
      <DeleteCustomerDialog
        customer={deleteCustomer}
        open={!!deleteCustomer}
        onOpenChange={(open) => !open && setDeleteCustomer(null)}
        onConfirm={async () => {
          if (deleteCustomer) {
            await handleDelete(deleteCustomer.id, deleteCustomer.domain);
            setDeleteCustomer(null);
          }
        }}
      />
    </div>
  );
}
