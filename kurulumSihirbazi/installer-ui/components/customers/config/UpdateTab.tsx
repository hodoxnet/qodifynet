"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, RefreshCw, Hammer, Database as DatabaseIcon, Loader2, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomerUpdate } from "@/hooks/customers/useCustomerUpdate";

interface UpdateTabProps {
  customerId: string;
  domain: string;
  defaultHeapMB?: number;
}

export function UpdateTab({ customerId, domain, defaultHeapMB }: UpdateTabProps) {
  const {
    info,
    loading,
    operation,
    logs,
    branches,
    loadingBranches,
    fetchBranches,
    gitUpdate,
    reinstallDependencies,
    buildApplications,
    prismaGenerate,
    prismaPush,
    fixDatabaseOwnership,
  } = useCustomerUpdate(customerId, domain);

  const [branch, setBranch] = useState<string>("");
  const [heapLimit, setHeapLimit] = useState<number>(defaultHeapMB || 4096);
  const [skipTypeCheck, setSkipTypeCheck] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!branch && info?.branch) {
      setBranch(info.branch);
    }
  }, [info, branch]);

  // Git source ise branch listesini yükle
  useEffect(() => {
    if (info?.source === 'git' && branches.length === 0 && !loadingBranches) {
      fetchBranches();
    }
  }, [info?.source, branches.length, loadingBranches, fetchBranches]);

  // Logs değiştiğinde TextArea'yı en alta scroll et
  useEffect(() => {
    if (textareaRef.current && logs.length > 0) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [logs]);

  const lastCommitShort = useMemo(() => {
    if (!info?.lastCommit) return null;
    return info.lastCommit.substring(0, 7);
  }, [info?.lastCommit]);

  if (loading && !info) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const isGitSource = info?.source === 'git';

  const handleGitUpdate = async () => {
    await gitUpdate({ branch: branch || undefined });
  };

  const handleDependencies = async () => {
    await reinstallDependencies();
  };

  const handleBuild = async () => {
    await buildApplications({ heapMB: heapLimit, skipTypeCheck });
  };

  const handlePrismaGenerate = async () => {
    await prismaGenerate();
  };

  const handlePrismaPush = async () => {
    await prismaPush();
  };

  const handleFixOwnership = async () => {
    await fixDatabaseOwnership();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Kaynak Bilgileri</CardTitle>
            <p className="text-sm text-gray-500">Müşteri: {domain}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{info?.source === 'git' ? 'Git' : 'Template'}</Badge>
            {lastCommitShort && (
              <Badge variant="secondary">Commit: {lastCommitShort}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGitSource ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Depo URL</p>
                <p className="font-medium text-gray-900 break-all">{info?.repoUrl}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="branch">Branch</Label>
                    {loadingBranches && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Yükleniyor...
                      </span>
                    )}
                  </div>
                  {branches.length > 0 ? (
                    <Select value={branch} onValueChange={setBranch}>
                      <SelectTrigger id="branch">
                        <SelectValue placeholder="Branch seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="branch"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                      disabled={loadingBranches}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Son Senkron</Label>
                  <p className="text-sm text-gray-600">
                    {info?.lastSyncAt ? new Date(info.lastSyncAt).toLocaleString('tr-TR') : 'Bilinmiyor'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Bu müşteri template ile kurulmuş. Git güncellemesi yapmak için önce Git kaynağına taşımanız gerekir.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Güncelleme İşlemleri</CardTitle>
          <p className="text-sm text-gray-500 mt-2">
            Güncellemeleri aşağıdaki sırayla yapmanız önerilir
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Adım 1: Git Güncelleme */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="w-8 h-8 rounded-full flex items-center justify-center">1</Badge>
              <Label className="text-base font-semibold">Git&apos;ten Güncelle</Label>
              {!isGitSource && <Badge variant="secondary">Sadece Git için</Badge>}
            </div>
            <p className="text-xs text-gray-500 ml-10">
              Kod değişikliklerini çeker. Branch değiştirmek için yukarıdan seçin.
            </p>
            <Button
              onClick={handleGitUpdate}
              disabled={operation !== null || !isGitSource}
              className="gap-2 ml-10"
            >
              {operation === 'git' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
              Git Güncelle
            </Button>
          </div>

          <Separator />

          {/* Adım 2: Prisma Generate */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="w-8 h-8 rounded-full flex items-center justify-center">2</Badge>
              <Label className="text-base font-semibold">Prisma Client Oluştur</Label>
            </div>
            <p className="text-xs text-gray-500 ml-10">
              <strong>Önemli:</strong> Schema değiştiyse mutlaka çalıştırın! TypeScript type&apos;larını günceller.
            </p>
            <Button
              onClick={handlePrismaGenerate}
              variant="outline"
              disabled={operation !== null}
              className="gap-2 ml-10"
            >
              {operation === 'prisma' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Prisma Generate
            </Button>
          </div>

          <Separator />

          {/* Adım 3: Bağımlılıklar */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="w-8 h-8 rounded-full flex items-center justify-center">3</Badge>
              <Label className="text-base font-semibold">Bağımlılıkları Güncelle</Label>
              <Badge variant="secondary">Opsiyonel</Badge>
            </div>
            <p className="text-xs text-gray-500 ml-10">
              package.json değiştiyse çalıştırın. Yeni kütüphaneler yüklenir.
            </p>
            <Button
              onClick={handleDependencies}
              variant="outline"
              disabled={operation !== null}
              className="gap-2 ml-10"
            >
              {operation === 'deps' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Bağımlılıkları Güncelle
            </Button>
          </div>

          <Separator />

          {/* Adım 4: Build */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="w-8 h-8 rounded-full flex items-center justify-center">4</Badge>
              <Label className="text-base font-semibold">Uygulamaları Derle</Label>
            </div>
            <p className="text-xs text-gray-500 ml-10">
              Backend, Admin ve Store uygulamalarını production için derler.
            </p>

            <div className="grid gap-4 md:grid-cols-2 ml-10">
              <div className="space-y-2">
                <Label htmlFor="heap-limit">Build Bellek Limiti (MB)</Label>
                <Input
                  id="heap-limit"
                  type="number"
                  min={2048}
                  step={256}
                  value={heapLimit}
                  onChange={(e) => setHeapLimit(Number(e.target.value) || heapLimit)}
                />
              </div>
              <div className="space-y-2 flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Tip Kontrolünü Atla</p>
                  <p className="text-xs text-gray-500">Build hızlandırır ama hataları gizleyebilir.</p>
                </div>
                <Switch checked={skipTypeCheck} onCheckedChange={setSkipTypeCheck} />
              </div>
            </div>

            <Button
              onClick={handleBuild}
              disabled={operation !== null}
              className="gap-2 ml-10"
            >
              {operation === 'build' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
              Build Çalıştır
            </Button>
          </div>

          <Separator />

          {/* Adım 5: İlave DB İşlemleri */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">5</Badge>
              <Label className="text-base font-semibold">İlave Veritabanı İşlemleri</Label>
              <Badge variant="secondary">Opsiyonel</Badge>
            </div>
            <p className="text-xs text-gray-500 ml-10">
              Sorun çıkarsa bu işlemleri kullanın.
            </p>
            <div className="grid gap-2 md:grid-cols-2 ml-10">
              <Button
                onClick={handlePrismaPush}
                variant="outline"
                disabled={operation !== null}
                className="gap-2"
              >
                {operation === 'prisma' ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseIcon className="h-4 w-4" />}
                Prisma DB Push
              </Button>
              <Button
                onClick={handleFixOwnership}
                variant="outline"
                disabled={operation !== null}
                className="gap-2"
              >
                {operation === 'prisma' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                DB Yetkilerini Düzelt
              </Button>
            </div>
            <p className="text-xs text-gray-500 ml-10">
              <strong>DB Push:</strong> Veritabanı tablolarını günceller (dikkatli kullanın!). <strong>Yetkileri Düzelt:</strong> Prisma bağlantı hatalarını çözer.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">İşlem Logları</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            ref={textareaRef}
            value={logs.join("\n")}
            readOnly
            className="min-h-[200px] font-mono text-sm"
            placeholder="Henüz log yok"
          />
        </CardContent>
      </Card>
    </div>
  );
}
