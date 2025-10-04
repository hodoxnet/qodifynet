"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Coins } from "lucide-react";

export function ApproveApplicationDialog({
  open,
  onOpenChange,
  onApprove
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApprove: (payload: any) => Promise<void> | void
}) {
  const [setupCredits, setSetupCredits] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await onApprove({ setupCredits });
      onOpenChange(false);
      // Reset form
      setSetupCredits(1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Başvuruyu Onayla
          </DialogTitle>
          <DialogDescription>
            Başvuruyu onaylayarak yeni partner oluşturun. Başvuru formundaki admin bilgileriyle otomatik kullanıcı hesabı oluşturulacaktır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Otomatik İşlemler:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Partner kaydı oluşturulacak</li>
                <li>Başvurudaki admin bilgileriyle kullanıcı hesabı açılacak</li>
                <li>Kullanıcı PARTNER_ADMIN rolüyle partnerlik eklenecek</li>
                <li>Partner başvuruda verdiği bilgilerle giriş yapabilecek</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="setupCredits" className="flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Başlangıç Kurulum Kredisi
            </Label>
            <Input
              id="setupCredits"
              type="number"
              min={1}
              max={1000}
              value={setupCredits}
              onChange={e => setSetupCredits(Math.max(1, parseInt(e.target.value || '1')))}
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Partner bu kredi ile müşteri kurulumu yapabilir
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
            onClick={submit}
            disabled={loading}
          >
            {loading ? 'Onaylanıyor...' : 'Başvuruyu Onayla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
