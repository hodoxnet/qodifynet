"use client";

import { useState, useEffect } from "react";
import { Upload, AlertTriangle, CheckCircle, XCircle, FileArchive, Loader2, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";

interface TemplateFile {
  name: string;
  version: string;
  uploaded: boolean;
  size?: string;
  uploadDate?: string;
}

interface TemplateCheckResult {
  available: boolean;
  missing: string[];
  uploaded?: string[];
  message?: string;
  templates?: TemplateFile[];
  files?: {
    [filename: string]: {
      uploaded: boolean;
      size?: string;
      uploadDate?: string;
      category?: string;
      path?: string;
    };
  };
}

export function TemplateManager() {
  const [checking, setChecking] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<TemplateCheckResult | null>(null);
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
  const [templateFiles, setTemplateFiles] = useState<{ [key: string]: TemplateFile }>({});

  const checkTemplates = async () => {
    setChecking(true);
    try {
      const response = await fetch("http://localhost:3031/api/templates/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: "2.4.0" }),
      });

      const data = await response.json();
      setTemplateStatus(data);

      // Create template file states from API response (real size/date)
      const templateNames = ['backend-2.4.0.zip', 'admin-2.4.0.zip', 'store-2.4.0.zip'];
      const filesMap: { [key: string]: TemplateFile } = {};

      templateNames.forEach(template => {
        const detail = data.files?.[template];
        const isUploaded = detail?.uploaded ?? !data.missing?.includes(template);
        filesMap[template] = {
          name: template,
          version: '2.4.0',
          uploaded: isUploaded,
          size: detail?.size,
          // Show a friendly date in TR locale if available
          uploadDate: detail?.uploadDate
            ? new Date(detail.uploadDate).toLocaleDateString('tr-TR')
            : undefined,
        };
      });

      setTemplateFiles(filesMap);

      if (!data.available) {
        toast.error(data.message || "Template dosyaları eksik!");
      } else {
        toast.success("Tüm template dosyaları hazır!");
      }
    } catch (error) {
      console.error("Template check error:", error);
      toast.error("Template kontrolü sırasında hata oluştu");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkTemplates();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      checkTemplates();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = async (templateName: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.zip')) {
      toast.error("Lütfen ZIP dosyası seçin");
      return;
    }

    // Validate file name format
    const expectedPrefix = templateName.split('-')[0]; // Extract "backend", "admin", or "store"
    if (!file.name.startsWith(expectedPrefix)) {
      toast.error(`Dosya adı ${expectedPrefix} ile başlamalı`);
      return;
    }

    setUploading(prev => ({ ...prev, [templateName]: true }));

    const formData = new FormData();
    formData.append('template', file);
    formData.append('name', templateName);
    formData.append('version', '2.4.0');

    try {
      const response = await fetch("http://localhost:3031/api/templates/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        // Update local state immediately
        setTemplateFiles(prev => ({
          ...prev,
          [templateName]: {
            name: templateName,
            version: 'latest',
            uploaded: true,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            uploadDate: new Date().toLocaleDateString('tr-TR')
          }
        }));

        toast.success(`${getTemplateComponent(templateName)} başarıyla yüklendi!`);

        // Force refresh after successful upload
        setTimeout(async () => {
          await checkTemplates();
          // Force component re-render
          setTemplateStatus(prev => ({ ...prev }));
        }, 500);
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      toast.error(`${getTemplateComponent(templateName)} yüklenemedi`);
      console.error("Upload error:", error);
    } finally {
      setUploading(prev => ({ ...prev, [templateName]: false }));
      // Reset file input
      event.target.value = '';
    }
  };

  const getTemplateComponent = (templateName: string) => {
    const [component] = templateName.split('-');
    const componentNames: { [key: string]: string } = {
      backend: "Backend API",
      admin: "Admin Panel",
      store: "Store Frontend",
    };
    return componentNames[component] || templateName;
  };

  if (checking) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          <span className="text-gray-600">Template dosyaları kontrol ediliyor...</span>
        </div>
      </div>
    );
  }

  if (!templateStatus) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Template Dosyaları</h2>
          <button
            onClick={checkTemplates}
            disabled={checking}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Yeniden Kontrol Et
          </button>
        </div>
      </div>

      <div className="p-6">
        {templateStatus.available ? (
          <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Tüm template dosyaları hazır!</p>
              <p className="text-sm text-green-700 mt-1">Yeni müşteri kurulumu yapabilirsiniz.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
            <AlertTriangle className="w-6 h-6 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-900">Template dosyaları eksik!</p>
              <p className="text-sm text-amber-700 mt-1">
                Kurulum yapabilmek için aşağıdaki dosyaları yüklemeniz gerekiyor.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">Template Dosyaları:</p>
          {['backend-2.4.0.zip', 'admin-2.4.0.zip', 'store-2.4.0.zip'].map((template) => {
            const file = templateFiles[template];
            const isUploaded = file?.uploaded || false;

            return (
              <div
                key={template}
                className={`flex items-center justify-between p-4 border rounded-lg transition-all duration-300 ${
                  isUploaded
                    ? 'border-green-200 bg-green-50 hover:bg-green-100'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    isUploaded ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {isUploaded ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <FileArchive className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className={`font-medium ${
                      isUploaded ? 'text-green-900' : 'text-gray-900'
                    }`}>
                      {getTemplateComponent(template)}
                    </p>
                    <p className={`text-sm ${
                      isUploaded ? 'text-green-700' : 'text-gray-500'
                    }`}>
                      {isUploaded ? (
                        <>
                          <span className="font-medium">Yüklendi</span>
                          {file?.size && ` • ${file.size}`}
                          {file?.uploadDate && ` • ${file.uploadDate}`}
                        </>
                      ) : (
                        template
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <label className="relative">
                    <input
                      type="file"
                      accept=".zip"
                      onChange={(e) => handleFileUpload(template, e)}
                      disabled={uploading[template]}
                      className="hidden"
                    />
                    <button
                      onClick={(e) => {
                        const input = e.currentTarget.parentElement?.querySelector('input');
                        input?.click();
                      }}
                      disabled={uploading[template]}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 disabled:opacity-50 ${
                        isUploaded
                          ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          : 'bg-gradient-to-r from-gray-900 to-slate-800 text-white hover:from-gray-800 hover:to-slate-700'
                      }`}
                    >
                      {uploading[template] ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Yükleniyor...</span>
                        </>
                      ) : isUploaded ? (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Değiştir</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Yükle</span>
                        </>
                      )}
                    </button>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Not:</strong> Template dosyalarını yüklerken dosya adlarının doğru formatta olduğundan emin olun:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            <li>• backend-latest.zip veya backend-2.4.0.zip</li>
            <li>• admin-latest.zip veya admin-2.4.0.zip</li>
            <li>• store-latest.zip veya store-2.4.0.zip</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
