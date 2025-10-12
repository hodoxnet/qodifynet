"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Download, HardDrive, Loader2, Play, Trash2, Plus, Archive } from "lucide-react";
import { useCustomerBackups } from "@/hooks/customers/useCustomerBackups";

export function BackupsTab({ customerId, domain }: { customerId: string; domain: string }) {
  const { backups, loading, operating, logs, percent, refresh, createBackup, deleteBackup, restoreBackup, downloadBackup } = useCustomerBackups(customerId, domain);
  const [includeArtifacts, setIncludeArtifacts] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(false);

  const totalSize = useMemo(() => backups.reduce((acc, b) => acc + (b.sizeBytes || 0), 0), [backups]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            <CardTitle className="text-lg">Yedekler</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs flex items-center gap-2">
              <input type="checkbox" className="accent-gray-900" checked={includeArtifacts} onChange={(e) => setIncludeArtifacts(e.target.checked)} />
              Artefaktları dahil et (node_modules/.next/dist)
            </label>
            <label className="text-xs flex items-center gap-2">
              <input type="checkbox" className="accent-gray-900" checked={includeLogs} onChange={(e) => setIncludeLogs(e.target.checked)} />
              Logları dahil et
            </label>
            <Button onClick={() => createBackup({ includeArtifacts, includeLogs })} disabled={operating} className="gap-2">
              {operating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Yeni Yedek
            </Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4">
          {(operating || percent > 0) && (
            <div className="w-full">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>İlerleme</span>
                <span>%{percent}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 transition-all" style={{ width: `${Math.max(5, Math.min(100, percent))}%` }} />
              </div>
            </div>
          )}
          <div className="text-xs text-gray-600 flex items-center gap-4">
            <span>Toplam: <strong>{backups.length}</strong> yedek</span>
            <span>Boyut: <strong>{(totalSize / (1024*1024)).toFixed(1)} MB</strong></span>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              Yenile
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Yedekler yükleniyor...</div>
          ) : backups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-600">
              <Archive className="h-10 w-10 text-gray-300 mb-3" />
              Henüz yedek yok. "Yeni Yedek" ile oluşturun.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Yedek ID</th>
                    <th className="py-2 pr-4">Tarih</th>
                    <th className="py-2 pr-4">Boyut</th>
                    <th className="py-2 pr-4">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map(b => (
                    <tr key={b.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 font-mono">{b.id}</td>
                      <td className="py-2 pr-4">{new Date(b.createdAt).toLocaleString('tr-TR')}</td>
                      <td className="py-2 pr-4">{(b.sizeBytes/(1024*1024)).toFixed(1)} MB</td>
                      <td className="py-2 pr-4 flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadBackup(b.id)}>
                          <Download className="h-4 w-4" />İndir
                        </Button>
                        <Button variant="default" size="sm" className="gap-2" disabled={operating} onClick={() => restoreBackup(b.id)}>
                          {operating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          Yedeği Kur
                        </Button>
                        <Button variant="destructive" size="sm" className="gap-2" disabled={operating} onClick={() => deleteBackup(b.id)}>
                          <Trash2 className="h-4 w-4" />Sil
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">İşlem Logları</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="min-h-[180px] max-h-[260px] overflow-y-auto bg-slate-950 text-slate-100 p-3 rounded-md text-xs font-mono whitespace-pre-wrap">{logs.join("\n") || "Henüz log yok"}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
