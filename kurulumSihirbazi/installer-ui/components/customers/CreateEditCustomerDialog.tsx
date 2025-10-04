"use client";

import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Switch } from "@/components/ui/switch";

const Schema = z.object({
  domain: z.string().min(3),
  partnerId: z.string().optional(),
  mode: z.enum(["local", "production"]).default("local"),
  ports: z.object({
    backend: z.number().int().min(1024).max(65535),
    admin: z.number().int().min(1024).max(65535),
    store: z.number().int().min(1024).max(65535)
  }),
});

type FormValues = z.infer<typeof Schema>;

export function CreateEditCustomerDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Partial<FormValues> & { id?: string };
  onSubmit: (values: FormValues) => Promise<void> | void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: initial || { domain: "", partnerId: "", mode: "local", ports: { backend: 4000, admin: 4001, store: 4002 } },
  });

  useEffect(() => {
    form.reset(initial || { domain: "", partnerId: "", mode: "local", ports: { backend: 4000, admin: 4001, store: 4002 } });
  }, [initial, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit({ ...values, partnerId: values.partnerId || undefined });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "İşlem başarısız");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Müşteri Düzenle" : "Yeni Müşteri"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Domain</Label>
              <Input {...form.register("domain")} placeholder="example.com veya test.local" />
            </div>
            <div>
              <Label>Partner ID (opsiyonel)</Label>
              <Input {...form.register("partnerId")} placeholder="par_..." />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Backend Port</Label>
              <Input type="number" {...form.register("ports.backend", { valueAsNumber: true })} />
            </div>
            <div>
              <Label>Admin Port</Label>
              <Input type="number" {...form.register("ports.admin", { valueAsNumber: true })} />
            </div>
            <div>
              <Label>Store Port</Label>
              <Input type="number" {...form.register("ports.store", { valueAsNumber: true })} />
            </div>
            <div className="md:col-span-3">
              <Button type="button" variant="outline" onClick={async () => {
                try {
                  const res = await apiFetch('/api/customers/next-port');
                  const j = await res.json();
                  form.setValue('ports.backend', Number(j?.backend || j?.base || 4000));
                  form.setValue('ports.admin', Number(j?.admin || ((j?.base||4000)+1)));
                  form.setValue('ports.store', Number(j?.store || ((j?.base||4000)+2)));
                } catch { toast.error('Port önerisi alınamadı'); }
              }}>Otomatik Port Ata</Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.watch("mode") === "production"} onCheckedChange={(v) => form.setValue("mode", v ? "production" : "local")}/>
            <span className="text-sm">Production modu</span>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit">Kaydet</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
