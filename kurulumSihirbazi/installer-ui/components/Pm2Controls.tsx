"use client";

import { useEffect, useState } from "react";
import { Activity, Settings, Save, RefreshCw, StopCircle, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export function Pm2Controls() {
  const [info, setInfo] = useState<{ bin: string | null; version: string | null } | null>(null);
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState<string | null>(null);

  const refreshInfo = async () => {
    try {
      const res = await apiFetch("/api/system/pm2/info");
      if (!res.ok) return;
      const json = await res.json();
      setInfo(json);
    } catch {}
  };

  useEffect(() => {
    refreshInfo();
  }, []);

  const run = async (key: string, path: string, successMsg: string) => {
    setLoading(key);
    try {
      const res = await apiFetch(path, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(successMsg);
      } else {
        toast.error(json?.output || json?.error || "İşlem başarısız");
      }
      setOutput(String(json?.output || ""));
    } catch (e: any) {
      setOutput(String(e?.message || e));
      toast.error("İşlem sırasında hata oluştu");
    } finally {
      setLoading(null);
      refreshInfo();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">PM2 Yönetimi</h2>
        </div>
        <div className="text-xs text-gray-500">
          {info?.version ? `PM2 ${info.version}` : "PM2 bilgisi"} {info?.bin ? `• ${info.bin}` : ""}
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Save className="w-4 h-4 text-gray-700" />
              <span className="font-medium text-gray-900">pm2 save</span>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Şu an çalışan süreç listesini kaydeder. pm2 startup ile birlikte kullanıldığında reboot sonrasında aynı süreçler otomatik olarak yeniden başlatılır.
            </p>
            <button
              onClick={() => run("save", "/api/system/pm2/save", "Süreç listesi kaydedildi")}
              disabled={loading === "save"}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded disabled:opacity-50"
            >
              {loading === "save" ? "Kaydediliyor..." : "Kaydet (pm2 save)"}
            </button>
          </div>

          <div className="p-3 bg-gray-50 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-4 h-4 text-gray-700" />
              <span className="font-medium text-gray-900">pm2 startup</span>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              PM2&apos;yi sistem açılışında otomatik başlatmak için init entegrasyonunu kurar. Bazı sistemlerde çıktıdaki komutu sudo ile manuel çalıştırmanız gerekebilir.
            </p>
            <button
              onClick={() => run("startup", "/api/system/pm2/startup", "Startup komutu çalıştırıldı")}
              disabled={loading === "startup"}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded disabled:opacity-50"
            >
              {loading === "startup" ? "Çalıştırılıyor..." : "Kur (pm2 startup)"}
            </button>
          </div>

          <div className="p-3 bg-gray-50 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Upload className="w-4 h-4 text-gray-700" />
              <span className="font-medium text-gray-900">pm2 update</span>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              &quot;In-memory PM2 is out-of-date&quot; uyarısını giderir. Daemon&apos;ı güncel sürüme reload eder ve süreçleri yeni PM2 ile yeniden başlatır.
            </p>
            <button
              onClick={() => run("update", "/api/system/pm2/update", "PM2 güncellendi (daemon reload)")}
              disabled={loading === "update"}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded disabled:opacity-50"
            >
              {loading === "update" ? "Güncelleniyor..." : "Güncelle (pm2 update)"}
            </button>
          </div>

          <div className="p-3 bg-gray-50 rounded">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="w-4 h-4 text-gray-700" />
              <span className="font-medium text-gray-900">Restart All</span>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Tüm PM2 süreçlerini yeniden başlatır. Konfigürasyon değişikliklerinden sonra kullanışlıdır.
            </p>
            <button
              onClick={() => run("restart-all", "/api/system/pm2/restart-all", "Tüm süreçler yeniden başlatıldı")}
              disabled={loading === "restart-all"}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded disabled:opacity-50"
            >
              {loading === "restart-all" ? "Yeniden başlatılıyor..." : "Yeniden Başlat (pm2 restart all)"}
            </button>
          </div>

          <div className="p-3 bg-gray-50 rounded">
            <div className="flex items-center gap-2 mb-1">
              <StopCircle className="w-4 h-4 text-gray-700" />
              <span className="font-medium text-gray-900">Stop All</span>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Tüm PM2 süreçlerini durdurur. Bakım için geçici durdurmalarda kullanın.
            </p>
            <button
              onClick={() => run("stop-all", "/api/system/pm2/stop-all", "Tüm süreçler durduruldu")}
              disabled={loading === "stop-all"}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded disabled:opacity-50"
            >
              {loading === "stop-all" ? "Durduruluyor..." : "Durdur (pm2 stop all)"}
            </button>
          </div>
        </div>

        {output && (
          <div className="mt-2">
            <div className="text-xs font-medium text-gray-700 mb-1">Komut Çıktısı</div>
            <pre className="p-3 bg-black text-gray-100 text-xs rounded overflow-auto max-h-60 whitespace-pre-wrap">{output}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
