"use client";

import {
  FileArchive,
  Upload,
  RefreshCw,
  Check,
  Download,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TemplateFile } from "@/hooks/templates/useTemplates";

interface TemplateCardProps {
  template: TemplateFile;
  onUpload: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  uploading: boolean;
  uploadProgress?: number;
}

const getTemplateInfo = (category: string) => {
  const info = {
    backend: {
      title: "Backend API",
      description: "Node.js API servisi",
      color: "blue",
      icon: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
      badge: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    },
    admin: {
      title: "Admin Panel",
      description: "Next.js yönetim paneli",
      color: "green",
      icon: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
      badge: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    },
    store: {
      title: "Store Frontend",
      description: "Next.js mağaza arayüzü",
      color: "purple",
      icon: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
      badge: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
    },
  };
  return info[category as keyof typeof info] || info.backend;
};

export function TemplateCard({
  template,
  onUpload,
  onDownload,
  onDelete,
  uploading,
  uploadProgress = 0,
}: TemplateCardProps) {
  const info = getTemplateInfo(template.category);

  const formatDate = (date?: string) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Card className={`relative overflow-hidden transition-all hover:shadow-lg ${
      template.uploaded
        ? "border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-white to-emerald-50/30 dark:from-gray-900 dark:to-emerald-900/10"
        : "border-gray-200 dark:border-gray-700"
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${info.icon}`}>
              <FileArchive className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{info.title}</CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {info.description}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {template.uploaded && (
                <>
                  <DropdownMenuItem onClick={onDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    İndir
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={onDelete}
                className="text-red-600 dark:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <Badge
            variant={template.uploaded ? "default" : "secondary"}
            className={template.uploaded ? info.badge : ""}
          >
            {template.uploaded ? (
              <>
                <Check className="mr-1 h-3 w-3" />
                Yüklü
              </>
            ) : (
              "Yüklenmedi"
            )}
          </Badge>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            v{template.version}
          </span>
        </div>

        {/* File Info */}
        {template.uploaded && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Boyut:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {template.size || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Tarih:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatDate(template.uploadDate)}
              </span>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Yükleniyor...</span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Upload Button */}
        {!uploading && (
          <Button
            onClick={onUpload}
            variant={template.uploaded ? "outline" : "default"}
            className="w-full"
            size="sm"
          >
            {template.uploaded ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Değiştir
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Yükle
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}