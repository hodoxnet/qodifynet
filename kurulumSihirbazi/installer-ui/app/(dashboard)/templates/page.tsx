"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Download,
  RefreshCw,
  Settings,
  FileCode,
  Loader2,
  FolderOpen,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

// Components
import { TemplateCard } from "@/components/templates/TemplateCard";
import { TemplateUploadDialog } from "@/components/templates/TemplateUploadDialog";
import { TemplateStatusAlert } from "@/components/templates/TemplateStatusAlert";
import { TemplateDeleteDialog } from "@/components/templates/TemplateDeleteDialog";

// Hooks
import { useTemplates, TemplateFile } from "@/hooks/templates/useTemplates";
import { useTemplateUpload } from "@/hooks/templates/useTemplateUpload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoPacksSection } from "@/components/templates/DemoPacksSection";

export default function TemplatesPage() {
  const { user } = useAuth();
  const {
    templates,
    loading,
    error,
    status,
    latestVersion,
    autoRefresh,
    setAutoRefresh,
    refreshTemplates,
    deleteTemplate,
  } = useTemplates();

  const { uploading, uploadProgress, uploadTemplate } = useTemplateUpload(() => refreshTemplates(false));

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenUploadDialog = (template: TemplateFile) => {
    setSelectedTemplate(template);
    setUploadDialogOpen(true);
  };

  const handleUpload = async (file: File) => {
    if (!selectedTemplate) return false;

    const success = await uploadTemplate(selectedTemplate.name, file, latestVersion);
    if (success) {
      setUploadDialogOpen(false);
      setSelectedTemplate(null);
    }
    return success;
  };

  const handleDownload = (template: TemplateFile) => {
    // TODO: Implement download functionality
    toast.info("İndirme özelliği yakında eklenecek");
  };

  const handleDelete = (template: TemplateFile) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTemplate) return;

    setIsDeleting(true);
    const success = await deleteTemplate(selectedTemplate.name);

    if (success) {
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
    }

    setIsDeleting(false);
  };

  const handleBackupAll = () => {
    // TODO: Implement backup all functionality
    toast.info("Toplu yedekleme özelliği yakında eklenecek");
  };

  const handleUploadAll = () => {
    // TODO: Implement bulk upload functionality
    toast.info("Toplu yükleme özelliği yakında eklenecek");
  };

  if (user?.role !== "SUPER_ADMIN") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/20">
                <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Yetkisiz Erişim
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Bu sayfaya erişim yetkiniz bulunmamaktadır. Template dosya yönetimi özellikleri sadece SUPER_ADMIN rolüne sahip kullanıcılar tarafından kullanılabilir.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Template Dosyaları
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Kurulum template dosyalarını yönetin ve güncelleyin
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleBackupAll}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Backup Al</span>
          </Button>
          <Button
            onClick={handleUploadAll}
            className="gap-2 bg-gradient-to-r from-gray-900 to-slate-800 hover:from-gray-800 hover:to-slate-700 text-white dark:from-gray-800 dark:to-slate-700 dark:hover:from-gray-700 dark:hover:to-slate-600"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Toplu Yükle</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger value="templates" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-6 py-3 font-medium">
            Template Dosyaları
          </TabsTrigger>
          <TabsTrigger value="demo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-6 py-3 font-medium">
            Demo Veriler
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6 space-y-6">
          {/* Status Alert */}
          <TemplateStatusAlert
            status={status}
            loading={loading}
            onRefresh={() => refreshTemplates(true)}
          />

          {/* Settings Bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Versiyon: {latestVersion}
                </span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {templates.filter(t => t.uploaded).length}/{templates.length} dosya yüklü
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
                  Otomatik Yenile
                </Label>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refreshTemplates(true)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Template Cards Grid */}
          {loading && templates.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-64 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button
                variant="outline"
                onClick={() => refreshTemplates(true)}
                className="mt-4"
              >
                Tekrar Dene
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.name}
                  template={template}
                  onUpload={() => handleOpenUploadDialog(template)}
                  onDownload={() => handleDownload(template)}
                  onDelete={() => handleDelete(template)}
                  uploading={uploading === template.name}
                  uploadProgress={uploading === template.name ? uploadProgress : 0}
                />
              ))}
            </div>
          )}

          {/* Upload Dialog */}
          <TemplateUploadDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            template={selectedTemplate}
            onUpload={handleUpload}
            uploading={!!uploading}
            uploadProgress={uploadProgress}
          />

          {/* Delete Dialog */}
          <TemplateDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            template={selectedTemplate}
            onConfirm={confirmDelete}
            isDeleting={isDeleting}
          />

          {/* Info Section */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Template Dosya Formatları
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="space-y-1">
                <p className="font-medium text-gray-700 dark:text-gray-300">Backend API</p>
                <p className="text-gray-600 dark:text-gray-400">backend-{latestVersion}.zip</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-gray-700 dark:text-gray-300">Admin Panel</p>
                <p className="text-gray-600 dark:text-gray-400">admin-{latestVersion}.zip</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-gray-700 dark:text-gray-300">Store Frontend</p>
                <p className="text-gray-600 dark:text-gray-400">store-{latestVersion}.zip</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              Not: Template dosyalarının adlandırma formatına uygun olduğundan emin olun.
              Yanlış adlandırılmış dosyalar sistem tarafından tanınmayacaktır.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="demo" className="mt-6">
          <DemoPacksSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
