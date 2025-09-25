"use client";

import { useState, useCallback } from "react";
import { Upload, X, FileArchive, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TemplateFile } from "@/hooks/templates/useTemplates";

interface TemplateUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateFile | null;
  onUpload: (file: File) => Promise<boolean>;
  uploading: boolean;
  uploadProgress: number;
}

export function TemplateUploadDialog({
  open,
  onOpenChange,
  template,
  onUpload,
  uploading,
  uploadProgress,
}: TemplateUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);

    if (!file.name.endsWith(".zip")) {
      setError("Sadece ZIP dosyaları yüklenebilir");
      return;
    }

    const expectedPrefix = template?.category || "";
    if (!file.name.startsWith(expectedPrefix)) {
      setError(`Dosya adı "${expectedPrefix}" ile başlamalıdır`);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const success = await onUpload(selectedFile);
    if (success) {
      setSelectedFile(null);
      onOpenChange(false);
    }
  };

  const getTemplateTitle = () => {
    const titles = {
      backend: "Backend API",
      admin: "Admin Panel",
      store: "Store Frontend",
    };
    return titles[template?.category as keyof typeof titles] || "Template";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {getTemplateTitle()} Dosyası Yükle
          </DialogTitle>
          <DialogDescription>
            {template?.uploaded ? "Mevcut dosyayı değiştirmek için" : "Yeni template dosyası yüklemek için"} bir ZIP dosyası seçin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
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
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={uploading}
            />

            <FileArchive className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />

            {selectedFile ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Dosya sürükleyin veya tıklayın
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ZIP dosyası (maksimum 100MB)
                </p>
              </>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Yükleniyor...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* File Requirements */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Dosya gereksinimleri:
            </p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
              <li>• Dosya adı: {template?.category}-{template?.version}.zip</li>
              <li>• Format: ZIP arşivi</li>
              <li>• Maksimum boyut: 100MB</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            İptal
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>Yükleniyor...</>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Yükle
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}