"use client";

import { useEffect, useMemo, useState } from "react";
import { GitBranch, RefreshCw, Hammer, Database as DatabaseIcon, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
    gitUpdate,
    reinstallDependencies,
    buildApplications,
    prismaPush,
  } = useCustomerUpdate(customerId);

  const [branch, setBranch] = useState<string>("");
  const [heapLimit, setHeapLimit] = useState<number>(defaultHeapMB || 4096);
  const [skipTypeCheck, setSkipTypeCheck] = useState<boolean>(false);

  useEffect(() => {
    if (!branch && info?.branch) {
      setBranch(info.branch);
    }
  }, [info, branch]);

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

  const handlePrismaPush = async () => {
    await prismaPush();
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
                  <Label htmlFor="branch">Branch</Label>
                  <Input
                    id="branch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                  />
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Button
              onClick={handleGitUpdate}
              disabled={operation !== null || !isGitSource}
              className="gap-2"
            >
              {operation === 'git' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
              Git'ten Güncelle
            </Button>
            <Button
              onClick={handleDependencies}
              variant="outline"
              disabled={operation !== null}
              className="gap-2"
            >
              {operation === 'deps' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Bağımlılıkları Güncelle
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
                <p className="text-xs text-gray-500">Next.js build sırasında typescript kontrolü devre dışı kalır.</p>
              </div>
              <Switch checked={skipTypeCheck} onCheckedChange={setSkipTypeCheck} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Button
              onClick={handleBuild}
              disabled={operation !== null}
              className="gap-2"
            >
              {operation === 'build' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
              Build Çalıştır
            </Button>
            <Button
              onClick={handlePrismaPush}
              variant="outline"
              disabled={operation !== null}
              className="gap-2"
            >
              {operation === 'prisma' ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseIcon className="h-4 w-4" />}
              Prisma DB Push
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">İşlem Logları</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
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
