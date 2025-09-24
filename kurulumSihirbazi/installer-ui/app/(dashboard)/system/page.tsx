"use client";

import { SystemStatus } from "@/components/SystemStatus";
import { SystemConfig } from "@/components/SystemConfig";
import { Pm2Controls } from "@/components/Pm2Controls";
import { useState, useEffect } from "react";
import { Server, Database, HardDrive, Cpu, Network, RefreshCw, Activity } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function SystemPage() {
  const [systemStatus, setSystemStatus] = useState({
    postgres: "checking",
    redis: "checking",
    nginx: "checking",
    pm2: "checking",
  });
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkSystemStatus();
    fetchSystemInfo();

    const interval = setInterval(() => {
      checkSystemStatus();
      fetchSystemInfo();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const checkSystemStatus = async () => {
    try {
      const response = await apiFetch("/api/system/status");
      if (!response.ok) return;
      const data = await response.json();
      if (data && typeof data === 'object') setSystemStatus(data);
    } catch (error) {
      console.error("System status check failed:", error);
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const response = await apiFetch("/api/system/resources");
      if (!response.ok) return;
      const data = await response.json();
      setSystemInfo(data);
    } catch (error) {
      console.error("System info fetch failed:", error);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([checkSystemStatus(), fetchSystemInfo()]);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sistem Durumu</h1>
          <p className="text-sm text-gray-600">
            Sistem servisleri ve kaynak kullanımını izleyin
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Yenile</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Services */}
        <div>
          <SystemStatus status={systemStatus} onRefresh={checkSystemStatus} />
        </div>

        {/* System Configuration */}
        <div>
          <SystemConfig />
        </div>
      </div>

      {/* PM2 Controls */}
      <Pm2Controls />

      {/* System Resources Details */}
      {systemInfo && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">
              Sistem Kaynakları Detayı
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* CPU Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">CPU</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Model:</span>
                  <span className="text-gray-900 font-medium">
                    {systemInfo.cpu?.model || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Çekirdek:</span>
                  <span className="text-gray-900 font-medium">
                    {systemInfo.cpu?.cores || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Kullanım:</span>
                  <span className="text-gray-900 font-medium">
                    {systemInfo.cpu?.usage?.toFixed(1) || "0"}%
                  </span>
                </div>
              </div>
            </div>

            {/* Memory Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Bellek</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Toplam:</span>
                  <span className="text-gray-900 font-medium">
                    {(systemInfo.memory?.totalGB ?? (systemInfo.memory?.total || 0)).toFixed ? (systemInfo.memory?.totalGB ?? systemInfo.memory?.total).toFixed(1) : (systemInfo.memory?.totalGB ?? systemInfo.memory?.total ?? 0)} GB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Kullanılan:</span>
                  <span className="text-gray-900 font-medium">
                    {(systemInfo.memory?.usedGB ?? (systemInfo.memory?.used || 0)).toFixed ? (systemInfo.memory?.usedGB ?? systemInfo.memory?.used).toFixed(1) : (systemInfo.memory?.usedGB ?? systemInfo.memory?.used ?? 0)} GB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Kullanım:</span>
                  <span className="text-gray-900 font-medium">
                    {(systemInfo.memory?.usedPercent ?? systemInfo.memory?.percentage ?? 0).toFixed ? (systemInfo.memory?.usedPercent ?? systemInfo.memory?.percentage).toFixed(1) : (systemInfo.memory?.usedPercent ?? systemInfo.memory?.percentage ?? 0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Disk Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Disk</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Toplam:</span>
                  <span className="text-gray-900 font-medium">
                    {(systemInfo.disk?.totalGB ?? 0).toFixed ? (systemInfo.disk?.totalGB).toFixed(1) : (systemInfo.disk?.totalGB ?? 0)} GB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Kullanılan:</span>
                  <span className="text-gray-900 font-medium">
                    {(systemInfo.disk?.usedGB ?? 0).toFixed ? (systemInfo.disk?.usedGB).toFixed(1) : (systemInfo.disk?.usedGB ?? 0)} GB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Kullanım:</span>
                  <span className="text-gray-900 font-medium">
                    {(systemInfo.disk?.usedPercent ?? (typeof systemInfo.disk?.percentage === 'string' ? parseFloat(String(systemInfo.disk?.percentage).replace('%','')) : 0)).toFixed ? (systemInfo.disk?.usedPercent ?? parseFloat(String(systemInfo.disk?.percentage || 0).toString().replace('%',''))).toFixed(1) : (systemInfo.disk?.usedPercent ?? (typeof systemInfo.disk?.percentage === 'string' ? parseFloat(String(systemInfo.disk?.percentage).replace('%','')) : 0))}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Network Info */}
          {systemInfo.network && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Network className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Ağ Arayüzleri</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {systemInfo.network.map((iface: any, index: number) => (
                  <div key={index} className="text-sm space-y-1">
                    <div className="font-medium text-gray-900">{iface.iface}</div>
                    <div className="text-gray-600">IP: {iface.ip}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
