"use client";

import { useEffect, useMemo, useState } from "react";
import { useDemoPacks } from "@/hooks/templates/useDemoPacks";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Upload, RefreshCw } from "lucide-react";

export function DemoDataTab({ domain }: { domain: string }) {
  const { packs, loading, error, latestVersion, refresh } = useDemoPacks();
  const [selected, setSelected] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [output, setOutput] = useState<string[]>([]);

  useEffect(() => {
    if (packs.length > 0 && !selected) {
      setSelected(packs[0].name);
    }
  }, [packs, selected]);

  const submit = async () => {
    if (!selected) { toast.error("Lütfen bir demo paketi seçin"); return; }
    setSubmitting(true);
    setOutput([]);
    try {
      const res = await apiFetch('/api/setup/import-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, version: latestVersion, packName: selected, overwriteUploads: true, mode: 'schema-restore' }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || j?.error || 'Demo veriler yüklenemedi');
      }
      const j = await res.json();
      toast.success(j?.message || 'Demo veriler yüklendi');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'İşlem başarısız';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Demo Verileri Yükle</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Domain: <span className="font-mono">{domain}</span> • Versiyon: {latestVersion}</p>
        </div>
        <button onClick={() => refresh(latestVersion)} className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border">
          <RefreshCw className="h-4 w-4" /> Yenile
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : error ? (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Demo Paketi</label>
            <select
              className="w-full max-w-md border rounded-md px-3 py-2 bg-white dark:bg-gray-900"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {packs.map(p => (
                <option key={`${p.category}-${p.name}`} value={p.name}>
                  {p.name} ({p.size})
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={submit}
              disabled={submitting || !selected}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-gray-900 to-slate-800 text-white hover:from-gray-800 hover:to-slate-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {submitting ? 'Yükleniyor...' : 'Demo Verileri Yükle'}
            </button>
          </div>
        </div>
      )}

      {output.length > 0 && (
        <div className="rounded-lg border p-4 bg-gray-50 dark:bg-gray-900">
          <pre className="text-xs whitespace-pre-wrap">{output.join('\n')}</pre>
        </div>
      )}
    </div>
  );
}
