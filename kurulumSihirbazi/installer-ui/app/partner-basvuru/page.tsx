"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme-toggle";
import { Building2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function PartnerApplicationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    taxId: "",
    address: "",
    adminEmail: "",
    adminName: "",
    adminPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Backend endpoint'e POST isteği
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3031';
      const res = await fetch(`${API_URL}/api/partner-public/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: { message: 'Sunucu hatası' } }));
        throw new Error(data.error?.message || "Başvuru gönderilemedi");
      }

      const data = await res.json();
      setSuccess(true);
      toast.success("Başvurunuz başarıyla alındı!");
    } catch (e: any) {
      setError(e?.message || "Başvuru gönderilemedi");
      toast.error(e?.message || "Başvuru gönderilemedi");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl">Başvurunuz Alındı!</CardTitle>
            <CardDescription>
              Başvurunuz başarıyla kaydedildi. En kısa sürede size dönüş yapacağız.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push("/login")}
              variant="outline"
              className="w-full"
            >
              Giriş Sayfasına Dön
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50">
            <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl">Partner Başvuru Formu</CardTitle>
          <CardDescription>
            Qodify partnerliği için başvurunuzu yapın
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Firma Bilgileri */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Firma Bilgileri
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Firma Adı <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="ABC Yazılım Ltd. Şti."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Firma E-posta <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="info@firma.com"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+90 555 123 4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">Vergi No</Label>
                  <Input
                    id="taxId"
                    name="taxId"
                    type="text"
                    value={formData.taxId}
                    onChange={handleChange}
                    placeholder="1234567890"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adres</Label>
                <Textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Firma adresi..."
                  rows={3}
                />
              </div>
            </div>

            {/* Yönetici Bilgileri */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Yönetici Bilgileri
              </h3>
              <p className="text-sm text-muted-foreground -mt-2">
                Sisteme giriş yapabilmek için yönetici bilgilerinizi girin
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="adminName">
                    Yönetici Adı <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="adminName"
                    name="adminName"
                    type="text"
                    value={formData.adminName}
                    onChange={handleChange}
                    required
                    placeholder="Ahmet Yılmaz"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">
                    Yönetici E-posta <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="adminEmail"
                    name="adminEmail"
                    type="email"
                    value={formData.adminEmail}
                    onChange={handleChange}
                    required
                    placeholder="admin@firma.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">
                  Şifre <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="adminPassword"
                  name="adminPassword"
                  type="password"
                  value={formData.adminPassword}
                  onChange={handleChange}
                  required
                  minLength={6}
                  placeholder="En az 6 karakter"
                />
                <p className="text-xs text-muted-foreground">
                  Başvurunuz onaylandıktan sonra bu bilgilerle giriş yapabileceksiniz
                </p>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? "Gönderiliyor..." : "Başvuruyu Gönder"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Başvurunuz yöneticiler tarafından incelenecektir.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
