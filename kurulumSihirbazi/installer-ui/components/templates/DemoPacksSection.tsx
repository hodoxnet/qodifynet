"use client";

import { useRef } from "react";
import { Upload, Trash2, FileArchive, Loader2 } from "lucide-react";
import { useDemoPacks } from "@/hooks/templates/useDemoPacks";

export function DemoPacksSection() {
  const { packs, loading, error, latestVersion, refresh, uploadDemoPack, deleteDemoPack } = useDemoPacks();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Demo Veriler</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Versiyon {latestVersion} için demo paketlerini yönetin</p>
        </div>
        <div className="flex items-center gap-3">
          <input ref={fileInputRef} type="file" accept=".zip" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) { await uploadDemoPack(f, latestVersion); (e.target as any).value = ''; }
          }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-gray-900 to-slate-800 text-white hover:from-gray-800 hover:to-slate-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Yükle
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.length === 0 ? (
            <div className="col-span-full text-sm text-gray-600 dark:text-gray-400">Henüz demo paketi bulunmuyor.</div>
          ) : (
            packs.map((p) => (
              <div key={`${p.category}-${p.name}`} className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <FileArchive className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.size} • {new Date(p.uploadDate).toLocaleString('tr-TR')} {p.category ? `• ${p.category}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => deleteDemoPack(p.name, latestVersion)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

