"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ApproveApplicationDialog({ open, onOpenChange, onApprove }: { open: boolean; onOpenChange: (o: boolean) => void; onApprove: (payload: any) => Promise<void> | void }) {
  const [setupCredits, setSetupCredits] = useState<number>(1);
  const [createUser, setCreateUser] = useState<{ email: string; password: string; name?: string }>({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const payload: any = { setupCredits };
      if (createUser.email && createUser.password) payload.createUser = createUser;
      await onApprove(payload);
      onOpenChange(false);
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Başvuruyu Onayla</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Kurulum Kredisi</Label>
            <Input type="number" value={setupCredits} onChange={e => setSetupCredits(parseInt(e.target.value || '1'))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Kullanıcı E‑posta (opsiyonel)</Label>
              <Input value={createUser.email} onChange={e => setCreateUser(v => ({ ...v, email: e.target.value }))} />
            </div>
            <div>
              <Label>Parola (opsiyonel)</Label>
              <Input type="password" value={createUser.password} onChange={e => setCreateUser(v => ({ ...v, password: e.target.value }))} />
            </div>
            <div>
              <Label>İsim (opsiyonel)</Label>
              <Input value={createUser.name || ''} onChange={e => setCreateUser(v => ({ ...v, name: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'İşleniyor...' : 'Onayla'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

