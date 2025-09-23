"use client";

import { TemplateManager } from "@/components/TemplateManager";
import { FileCode, Download, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function TemplatesPage() {
  const [version, setVersion] = useState<string>("-");
  const [files, setFiles] = useState<Record<string, { uploaded: boolean; size?: string; uploadDate?: string }>>({});

  useEffect(() => {
    (async () => {
      try {
        // Get available templates and pick latest
        const listRes = await apiFetch("/api/templates");
        if (listRes.ok) {
          const list = await listRes.json();
          if (Array.isArray(list) && list.length > 0) {
            setVersion(list[0].version);
          }
        }
      } catch {}
      try {
        const v = (prev => prev !== '-' ? prev : 'latest')(version as any);
        const checkRes = await apiFetch("/api/templates/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: v }),
        });
        if (checkRes.ok) {
          const data = await checkRes.json();
          setFiles(data?.files || {});
          // If version was unknown, try to derive from keys
          if (version === '-' && data?.files) {
            const key = Object.keys(data.files)[0] || '';
            const m = key.match(/-(.+)\.zip$/);
            if (m) setVersion(m[1]);
          }
        }
      } catch {}
    })();
  }, []);

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
  const F = (name: string) => files[name] || {} as any;
  const v = version === '-' ? 'latest' : version;
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Template Dosyaları</h1>
          <p className="text-sm text-gray-600">
            Kurulum template dosyalarını yönetin ve güncelleyin
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            <span>Backup Al</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-900 to-slate-800 text-white rounded-lg hover:from-gray-800 hover:to-slate-700 transition-all">
            <Upload className="w-4 h-4" />
            <span>Yeni Template Yükle</span>
          </button>
        </div>
      </div>

      {/* Template Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileCode className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Backend Template</h3>
              <p className="text-xs text-gray-600">v{version}</p>
            </div>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Boyut:</span>
              <span className="text-gray-900 font-medium">{F(`backend-${v}.zip`).size || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Son Güncelleme:</span>
              <span className="text-gray-900 font-medium">{fmt(F(`backend-${v}.zip`).uploadDate)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FileCode className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Admin Template</h3>
              <p className="text-xs text-gray-600">v{version}</p>
            </div>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Boyut:</span>
              <span className="text-gray-900 font-medium">{F(`admin-${v}.zip`).size || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Son Güncelleme:</span>
              <span className="text-gray-900 font-medium">{fmt(F(`admin-${v}.zip`).uploadDate)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileCode className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Store Template</h3>
              <p className="text-xs text-gray-600">v{version}</p>
            </div>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Boyut:</span>
              <span className="text-gray-900 font-medium">{F(`store-${v}.zip`).size || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Son Güncelleme:</span>
              <span className="text-gray-900 font-medium">{fmt(F(`store-${v}.zip`).uploadDate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Template Manager Component */}
      <TemplateManager />
    </div>
  );
}
