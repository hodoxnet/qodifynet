"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Calendar, ExternalLink, Download, Filter } from "lucide-react";
import { toast } from "sonner";

interface CompletedDeployment {
  id: string;
  domain: string;
  status: "completed" | "failed";
  completedAt: string;
  duration: number;
  storeName: string;
  adminEmail: string;
  templateVersion: string;
  ports?: {
    backend: number;
    admin: number;
    store: number;
  };
  errorMessage?: string;
}

export default function CompletedWizardPage() {
  const [deployments, setDeployments] = useState<CompletedDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "failed">("all");

  useEffect(() => {
    fetchCompletedDeployments();
  }, []);

  const fetchCompletedDeployments = async () => {
    try {
      setLoading(true);
      // Simulated data - gerçek API'ye bağlanacak
      const mockData: CompletedDeployment[] = [
        {
          id: "1",
          domain: "testmusteri.local",
          status: "completed",
          completedAt: new Date(Date.now() - 86400000).toISOString(),
          duration: 325,
          storeName: "Test Mağaza",
          adminEmail: "admin@test.com",
          templateVersion: "v2.4.0",
          ports: {
            backend: 4001,
            admin: 4002,
            store: 4003,
          },
        },
        {
          id: "2",
          domain: "example.com",
          status: "failed",
          completedAt: new Date(Date.now() - 172800000).toISOString(),
          duration: 45,
          storeName: "Example Store",
          adminEmail: "admin@example.com",
          templateVersion: "v2.4.0",
          errorMessage: "DNS A kaydı doğrulanamadı",
        },
        {
          id: "3",
          domain: "demo.qodify.com",
          status: "completed",
          completedAt: new Date(Date.now() - 259200000).toISOString(),
          duration: 412,
          storeName: "Demo Store",
          adminEmail: "demo@qodify.com",
          templateVersion: "v2.3.8",
          ports: {
            backend: 4004,
            admin: 4005,
            store: 4006,
          },
        },
      ];

      setDeployments(mockData);
    } catch (error) {
      toast.error("Tamamlanan kurulumlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} dk ${remainingSeconds} sn`;
  };

  const filteredDeployments = deployments.filter((d) => {
    if (filter === "all") return true;
    return d.status === filter;
  });

  const downloadReport = (deployment: CompletedDeployment) => {
    // Rapor indirme işlemi
    toast.success("Rapor indiriliyor...");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tamamlanan Kurulumlar</h1>
          <p className="text-sm text-gray-600">
            Başarılı ve başarısız kurulum geçmişi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Filtre:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          >
            <option value="all">Tümü</option>
            <option value="completed">Başarılı</option>
            <option value="failed">Başarısız</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Toplam Kurulum</p>
              <p className="text-2xl font-bold text-gray-900">{deployments.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Başarılı</p>
              <p className="text-2xl font-bold text-green-600">
                {deployments.filter(d => d.status === "completed").length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Başarısız</p>
              <p className="text-2xl font-bold text-red-600">
                {deployments.filter(d => d.status === "failed").length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Deployments Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : filteredDeployments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <Filter className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Kurulum Bulunamadı
          </h3>
          <p className="text-sm text-gray-600">
            Seçili filtreye uygun tamamlanmış kurulum yok
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mağaza
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Süre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tarih
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDeployments.map((deployment) => (
                <tr key={deployment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {deployment.domain}
                        </div>
                        <div className="text-xs text-gray-500">
                          {deployment.templateVersion}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{deployment.storeName}</div>
                    <div className="text-xs text-gray-500">{deployment.adminEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {deployment.status === "completed" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        Başarılı
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" />
                        Başarısız
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(deployment.duration)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(deployment.completedAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {deployment.status === "completed" && deployment.ports && (
                        <a
                          href={`http://localhost:${deployment.ports.store}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-gray-900"
                          title="Siteyi Görüntüle"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => downloadReport(deployment)}
                        className="text-gray-600 hover:text-gray-900"
                        title="Rapor İndir"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}