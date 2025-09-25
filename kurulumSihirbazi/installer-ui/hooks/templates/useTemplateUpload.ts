"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export function useTemplateUpload(onSuccess?: () => void) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const uploadTemplate = useCallback(async (
    templateName: string,
    file: File,
    version: string = "2.4.0"
  ) => {
    // Validate file type
    if (!file.name.endsWith('.zip')) {
      toast.error("Lütfen ZIP dosyası seçin");
      return false;
    }

    // Validate file name format
    const expectedPrefix = templateName.split('-')[0];
    if (!file.name.startsWith(expectedPrefix)) {
      toast.error(`Dosya adı ${expectedPrefix} ile başlamalı`);
      return false;
    }

    setUploading(templateName);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('template', file);
    formData.append('name', templateName);
    formData.append('version', version);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await apiFetch("/api/templates/upload", {
        method: "POST",
        body: formData as any,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        const componentName = getComponentName(templateName);
        toast.success(`${componentName} başarıyla yüklendi`);

        if (onSuccess) {
          setTimeout(onSuccess, 500);
        }

        return true;
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Yükleme başarısız");
      }
    } catch (error) {
      const componentName = getComponentName(templateName);
      const message = error instanceof Error ? error.message : "Yükleme başarısız";
      toast.error(`${componentName} yüklenemedi: ${message}`);
      return false;
    } finally {
      setUploading(null);
      setUploadProgress(0);
    }
  }, [onSuccess]);

  const getComponentName = (templateName: string) => {
    const [component] = templateName.split('-');
    const componentNames: { [key: string]: string } = {
      backend: "Backend API",
      admin: "Admin Panel",
      store: "Store Frontend",
    };
    return componentNames[component] || templateName;
  };

  return {
    uploading,
    uploadProgress,
    uploadTemplate,
  };
}