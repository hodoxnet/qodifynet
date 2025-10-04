"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { XCircle, AlertTriangle } from "lucide-react";

export function RejectApplicationDialog({
  open,
  onOpenChange,
  onReject
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onReject: (reason?: string) => Promise<void> | void
}) {
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await onReject(reason || undefined);
      onOpenChange(false);
      // Reset form
      setReason("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            Başvuruyu Reddet
          </DialogTitle>
          <DialogDescription>
            Bu başvuruyu reddediyorsunuz. İsterseniz red gerekçesini belirtebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Dikkat:</strong> Bu işlem geri alınamaz. Başvuru sahibi bilgilendirilmeyecektir.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Ret Gerekçesi (Opsiyonel)
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Neden reddedildiğini açıklayın..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Bu gerekçe sadece dahili kayıtlarda tutulacaktır
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            İptal
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={loading}
          >
            {loading ? 'Reddediliyor...' : 'Başvuruyu Reddet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
