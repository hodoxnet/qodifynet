"use client";

import { useState } from "react";
import { usePartnerApplications } from "@/hooks/partners/usePartnerApplications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApproveApplicationDialog } from "@/components/partners/ApproveApplicationDialog";
import { RejectApplicationDialog } from "@/components/partners/RejectApplicationDialog";

export default function PartnerApplicationsPage() {
  const { status, setStatus, items, loading, approve, reject, refresh } = usePartnerApplications("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Partner Başvuruları</h1>
        <p className="text-sm text-gray-600">Süper admin onay/ret işlemleri</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Başvurular</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Bekleyen</SelectItem>
                <SelectItem value="approved">Onaylanan</SelectItem>
                <SelectItem value="rejected">Reddedilen</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refresh()}>Yenile</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">Yükleniyor...</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-gray-500">Kayıt yok</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Ad</th>
                    <th className="px-3 py-2 text-left">E‑posta</th>
                    <th className="px-3 py-2 text-left">Durum</th>
                    <th className="px-3 py-2 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(app => {
                    const form = app.form || {};
                    return (
                      <tr key={app.id} className="border-b">
                        <td className="px-3 py-2 font-mono text-xs">{app.id}</td>
                        <td className="px-3 py-2">{form.name || '-'}</td>
                        <td className="px-3 py-2">{form.email || '-'}</td>
                        <td className="px-3 py-2">{app.status}</td>
                        <td className="px-3 py-2 text-right">
                          {app.status === 'pending' ? (
                            <div className="flex items-center gap-2 justify-end">
                              <Button size="sm" onClick={() => { setSelectedId(app.id); setApproveOpen(true); }}>Onayla</Button>
                              <Button size="sm" variant="destructive" onClick={() => { setSelectedId(app.id); setRejectOpen(true); }}>Reddet</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(app.id)}>Kopyala</Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ApproveApplicationDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        onApprove={async (payload) => { if (selectedId) await approve(selectedId, payload); }}
      />

      <RejectApplicationDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onReject={async (reason) => { if (selectedId) await reject(selectedId, reason); }}
      />
    </div>
  );
}

