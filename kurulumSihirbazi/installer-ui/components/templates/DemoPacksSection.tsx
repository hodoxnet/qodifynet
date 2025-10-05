"use client";

import { useState, useCallback } from "react";
import { Upload, Trash2, FileArchive, Loader2, RefreshCw, Package, AlertCircle } from "lucide-react";
import { useDemoPacks } from "@/hooks/templates/useDemoPacks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function DemoPacksSection() {
  const { packs, loading, error, latestVersion, refresh, uploadDemoPack, deleteDemoPack } = useDemoPacks();
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.zip')) {
      setUploadingFile(file.name);
      setUploadProgress(0);

      // Simulate progress (gerçek progress için XMLHttpRequest kullanılabilir)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const success = await uploadDemoPack(file, latestVersion);

      clearInterval(progressInterval);
      setUploadProgress(100);

      setTimeout(() => {
        setUploadingFile(null);
        setUploadProgress(0);
      }, 500);
    }
  }, [uploadDemoPack, latestVersion]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingFile(file.name);
      setUploadProgress(0);

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const success = await uploadDemoPack(file, latestVersion);

      clearInterval(progressInterval);
      setUploadProgress(100);

      setTimeout(() => {
        setUploadingFile(null);
        setUploadProgress(0);
      }, 500);

      (e.target as any).value = '';
    }
  };

  const handleDelete = async (filename: string) => {
    setDeletingFile(filename);
    await deleteDemoPack(filename, latestVersion);
    setDeletingFile(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Demo Veriler</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Versiyon {latestVersion} için demo paketlerini yönetin
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refresh(latestVersion)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Drag & Drop Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg transition-all ${
          dragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={!!uploadingFile}
        />

        <div className="p-8 text-center">
          {uploadingFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {uploadingFile} yükleniyor...
                </p>
                <div className="w-full max-w-xs mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{uploadProgress}%</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 rounded-full bg-gradient-to-r from-gray-900 to-slate-800 dark:from-gray-800 dark:to-slate-700">
                  <Upload className="h-8 w-8 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                Demo paketi yüklemek için dosyayı sürükleyin veya tıklayın
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ZIP dosyası (maksimum 1GB)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && !uploadingFile ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Demo Packs Grid */}
          {packs.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4 py-8">
                  <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800">
                    <Package className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      Henüz demo paketi bulunmuyor
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Yukarıdaki alana demo paketi yükleyerek başlayın
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packs.map((pack) => (
                <Card
                  key={`${pack.category}-${pack.name}`}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                          <FileArchive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {pack.name}
                          </p>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {pack.size}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(pack.uploadDate).toLocaleString('tr-TR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            {pack.category && (
                              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                {pack.category}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(pack.name)}
                        disabled={deletingFile === pack.name}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                      >
                        {deletingFile === pack.name ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Info Section */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Demo Paketleri Hakkında
        </h3>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <li>• Demo paketleri ZIP formatında olmalıdır</li>
          <li>• Her paket ilgili versiyonun demo verilerini içerir</li>
          <li>• Kurulum sırasında müşterilere demo data yüklenebilir</li>
          <li>• Maksimum dosya boyutu: 1GB</li>
        </ul>
      </div>
    </div>
  );
}

