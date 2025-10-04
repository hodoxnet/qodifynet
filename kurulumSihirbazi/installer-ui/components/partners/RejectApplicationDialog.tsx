"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function RejectApplicationDialog({ open, onOpenChange, onReject }: { open: boolean; onOpenChange: (o: boolean) => void; onReject: (reason?: string) => Promise<void> | void }) {
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try { await onReject(reason); onOpenChange(false); } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Başvuruyu Reddet</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Gerekçe (opsiyonel)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Kısa açıklama" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'İşleniyor...' : 'Reddet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

