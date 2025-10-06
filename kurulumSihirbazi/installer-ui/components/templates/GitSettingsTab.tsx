"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Lock, Unlock } from "lucide-react";
import { useGitSettings } from "@/hooks/system/useGitSettings";

export function GitSettingsTab() {
  const {
    settings,
    setSettings,
    tokenInput,
    setTokenInput,
    clearToken,
    setClearToken,
    loading,
    saving,
    saveSettings,
    refresh,
  } = useGitSettings();

  const tokenStatus = useMemo(() => {
    if (clearToken) return { label: "Token silinecek", variant: "destructive" as const, icon: Unlock };
    if (settings.tokenSet) return { label: "Token kayıtlı", variant: "secondary" as const, icon: Lock };
    return { label: "Token girilmemiş", variant: "outline" as const, icon: Unlock };
  }, [settings.tokenSet, clearToken]);

  const TokenStatusIcon = tokenStatus.icon;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Varsayılan Git Ayarları</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Gizli repolara erişim için kullanılacak kimlik bilgilerini yönetin. Boş bırakılan alanlar mevcut değeri korur.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={tokenStatus.variant} className="gap-1">
                <TokenStatusIcon className="h-3 w-3" />
                {tokenStatus.label}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="git-default-repo">Varsayılan Repo URL</Label>
              <Input
                id="git-default-repo"
                type="text"
                value={settings.defaultRepo}
                onChange={(e) => setSettings(prev => ({ ...prev, defaultRepo: e.target.value }))}
                placeholder="https://github.com/org/project.git"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="git-default-branch">Varsayılan Branch</Label>
              <Input
                id="git-default-branch"
                type="text"
                value={settings.defaultBranch}
                onChange={(e) => setSettings(prev => ({ ...prev, defaultBranch: e.target.value }))}
                placeholder="main"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="git-depth">Clone Derinliği</Label>
              <Input
                id="git-depth"
                type="number"
                min={1}
                value={settings.depth}
                onChange={(e) => setSettings(prev => ({ ...prev, depth: Number(e.target.value) || 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="git-username">Git Kullanıcı Adı (opsiyonel)</Label>
              <Input
                id="git-username"
                type="text"
                value={settings.username}
                onChange={(e) => setSettings(prev => ({ ...prev, username: e.target.value }))}
                placeholder="deploy-user"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="git-token">Yeni Token</Label>
              <Input
                id="git-token"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="ghp_..."
              />
              <p className="text-xs text-gray-500">
                Bir token girerseniz mevcut token değiştirilir. Token alanını boş bırakırsanız mevcut değer korunur.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Tokenı sil</p>
                <p className="text-xs text-gray-500">Aktif tokenı kaldırmak için anahtarı aktif edin.</p>
              </div>
              <Switch checked={clearToken} onCheckedChange={setClearToken} disabled={!settings.tokenSet && !clearToken} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={refresh} disabled={loading || saving}>
              Yenile
            </Button>
            <Button onClick={() => saveSettings()} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Kaydet
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
