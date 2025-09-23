"use client";

import { useEffect, useState } from "react";
import { Database, Server, Save, TestTubes, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type Settings = {
  db?: { host?: string; port?: number; user?: string; password?: string };
  redis?: { host?: string; port?: number; prefix?: string };
  paths?: { templates?: string; customers?: string };
};

export function SystemConfig() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingDb, setTestingDb] = useState(false);
  const [testingRedis, setTestingRedis] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/system/settings");
        if (!res.ok) return;
        const json = await res.json();
        setSettings(json || {});
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/system/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Ayarlar kaydedilemedi");
      const json = await res.json();
      setSettings(json);
      toast.success("Ayarlar kaydedildi");
    } catch (e: any) {
      toast.error(e?.message || "Kayıt sırasında hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const testDb = async () => {
    setTestingDb(true);
    try {
      const res = await apiFetch("/api/system/test/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings.db || {}),
      });
      const json = await res.json();
      if (res.ok) toast.success("PostgreSQL bağlantısı başarılı");
      else toast.error(json?.message || "PostgreSQL bağlantı hatası");
    } catch (e: any) {
      toast.error(e?.message || "PostgreSQL test hatası");
    } finally {
      setTestingDb(false);
    }
  };

  const testRedis = async () => {
    setTestingRedis(true);
    try {
      const res = await apiFetch("/api/system/test/redis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings.redis || {}),
      });
      const json = await res.json();
      if (res.ok) toast.success("Redis bağlantısı başarılı");
      else toast.error(json?.message || "Redis bağlantı hatası");
    } catch (e: any) {
      toast.error(e?.message || "Redis test hatası");
    } finally {
      setTestingRedis(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center space-x-2 text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Ayarlar yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Bağlantı Ayarları</h2>
        <p className="text-xs text-gray-600 mt-1">Smart Environment Management ile uyumlu varsayılan DB/Redis ayarları</p>
      </div>
      <div className="p-4 space-y-6">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Server className="w-4 h-4 text-gray-700" />
            <h3 className="font-medium text-gray-900">Yol Ayarları</h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <input
              placeholder="Templates Path (örn. /Users/..../templates)"
              value={settings.paths?.templates || ""}
              onChange={(e) => setSettings(s => ({ ...s, paths: { ...s.paths, templates: e.target.value } }))}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Template ZIP dosyalarının bulunduğu klasör. Altında stable/beta/archived dizinleri isteğe bağlıdır.</p>
        </div>

        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Database className="w-4 h-4 text-gray-700" />
            <h3 className="font-medium text-gray-900">PostgreSQL</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              placeholder="Host (örn. localhost)"
              value={settings.db?.host || ""}
              onChange={(e) => setSettings(s => ({ ...s, db: { ...s.db, host: e.target.value } }))}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              placeholder="Port (örn. 5432)"
              value={settings.db?.port ?? ""}
              onChange={(e) => setSettings(s => ({ ...s, db: { ...s.db, port: Number(e.target.value) || undefined } }))}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              placeholder="Kullanıcı (örn. postgres)"
              value={settings.db?.user || ""}
              onChange={(e) => setSettings(s => ({ ...s, db: { ...s.db, user: e.target.value } }))}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="password"
              placeholder="Şifre"
              value={settings.db?.password || ""}
              onChange={(e) => setSettings(s => ({ ...s, db: { ...s.db, password: e.target.value } }))}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="mt-2">
            <button onClick={testDb} disabled={testingDb} className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg disabled:opacity-50">
              {testingDb ? "Test ediliyor..." : "Bağlantıyı Test Et"}
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Server className="w-4 h-4 text-gray-700" />
            <h3 className="font-medium text-gray-900">Redis</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              placeholder="Host (örn. localhost)"
              value={settings.redis?.host || ""}
              onChange={(e) => setSettings(s => ({ ...s, redis: { ...s.redis, host: e.target.value } }))}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              placeholder="Port (örn. 6379)"
              value={settings.redis?.port ?? ""}
              onChange={(e) => setSettings(s => ({ ...s, redis: { ...s.redis, port: Number(e.target.value) || undefined } }))}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              placeholder="Prefix (örn. domain_ veya hodox_)"
              value={settings.redis?.prefix || ""}
              onChange={(e) => setSettings(s => ({ ...s, redis: { ...s.redis, prefix: e.target.value } }))}
              className="px-3 py-2 border border-gray-300 rounded-lg md:col-span-2"
            />
          </div>
          <div className="mt-2">
            <button onClick={testRedis} disabled={testingRedis} className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg disabled:opacity-50">
              {testingRedis ? "Test ediliyor..." : "Bağlantıyı Test Et"}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-gradient-to-r from-gray-900 to-slate-800 text-white rounded-lg disabled:opacity-50">
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
