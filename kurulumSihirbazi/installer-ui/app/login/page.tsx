"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (e: any) {
      setError(e?.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h1 className="text-xl font-semibold mb-1">Kurulum Sihirbazı</h1>
        <p className="text-sm text-gray-500 mb-6">Yönetim paneline giriş yapın</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm mb-1 block">E-posta</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@example.com" />
          </div>
          <div>
            <label className="text-sm mb-1 block">Parola</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>
        </form>
        <p className="text-xs text-gray-500 mt-4">İlk kullanıcı kayıt için API: POST /api/auth/register</p>
      </div>
    </div>
  );
}

