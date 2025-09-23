"use client";

import { useState, useEffect } from "react";
import { Plus, Clock, CheckCircle, AlertCircle, Loader2, Play, Pause, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Deployment {
  id: string;
  domain: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number;
  startedAt: string;
  completedAt?: string;
  currentStep?: string;
  error?: string;
}

export default function WizardPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeployments();
  }, []);

  const fetchDeployments = async () => {
    try {
      setLoading(true);
      // API'den deployment listesini çek
      const response = await fetch("http://localhost:3031/api/deployments");
      const data = await response.json();
      setDeployments(data.filter((d: Deployment) => d.status === "in_progress" || d.status === "pending"));
    } catch (error) {
      toast.error("Kurulumlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (id: string) => {
    try {
      await fetch(`http://localhost:3031/api/deployments/${id}/pause`, {
        method: "POST",
      });
      toast.success("Kurulum duraklatıldı");
      fetchDeployments();
    } catch (error) {
      toast.error("İşlem başarısız");
    }
  };

  const handleResume = async (id: string) => {
    try {
      await fetch(`http://localhost:3031/api/deployments/${id}/resume`, {
        method: "POST",
      });
      toast.success("Kurulum devam ettiriliyor");
      fetchDeployments();
    } catch (error) {
      toast.error("İşlem başarısız");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu kurulumu iptal etmek istediğinize emin misiniz?")) return;

    try {
      await fetch(`http://localhost:3031/api/deployments/${id}`, {
        method: "DELETE",
      });
      toast.success("Kurulum iptal edildi");
      fetchDeployments();
    } catch (error) {
      toast.error("İşlem başarısız");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "in_progress":
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "failed":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "in_progress":
        return "Devam Ediyor";
      case "completed":
        return "Tamamlandı";
      case "failed":
        return "Başarısız";
      case "pending":
        return "Bekliyor";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devam Eden Kurulumlar</h1>
          <p className="text-sm text-gray-600">
            Aktif ve bekleyen kurulum işlemlerini takip edin
          </p>
        </div>
        <Link
          href="/wizard/new"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-900 to-slate-800 text-white rounded-lg hover:from-gray-800 hover:to-slate-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>Yeni Kurulum</span>
        </Link>
      </div>

      {/* Deployments List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : deployments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Devam Eden Kurulum Yok
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Henüz aktif veya bekleyen kurulum bulunmuyor
          </p>
          <Link
            href="/wizard/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-900 to-slate-800 text-white rounded-lg hover:from-gray-800 hover:to-slate-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>İlk Kurulumu Başlat</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {deployments.map((deployment) => (
            <div
              key={deployment.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(deployment.status)}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {deployment.domain}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {getStatusText(deployment.status)} • {deployment.currentStep || "Hazırlanıyor"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {deployment.status === "in_progress" ? (
                    <button
                      onClick={() => handlePause(deployment.id)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Duraklat"
                    >
                      <Pause className="w-5 h-5" />
                    </button>
                  ) : deployment.status === "pending" ? (
                    <button
                      onClick={() => handleResume(deployment.id)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Devam Et"
                    >
                      <Play className="w-5 h-5" />
                    </button>
                  ) : null}
                  <button
                    onClick={() => handleDelete(deployment.id)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="İptal Et"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                    style={{ width: `${deployment.progress}%` }}
                  />
                </div>
                <span className="absolute right-0 -top-6 text-sm font-medium text-gray-700">
                  {deployment.progress}%
                </span>
              </div>

              {deployment.error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{deployment.error}</p>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>Başlangıç: {new Date(deployment.startedAt).toLocaleString("tr-TR")}</span>
                {deployment.completedAt && (
                  <span>Bitiş: {new Date(deployment.completedAt).toLocaleString("tr-TR")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}