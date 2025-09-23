"use client";

import { useEffect, useState } from "react";
import { SystemStatus } from "@/components/SystemStatus";
import { CustomersList } from "@/components/CustomersList";
import { DeploymentWizard } from "@/components/DeploymentWizard";
import { TemplateManager } from "@/components/TemplateManager";
import { SystemConfig } from "@/components/SystemConfig";
import { Plus, Server, Activity } from "lucide-react";

export default function HomePage() {
  const [activeView, setActiveView] = useState<"dashboard" | "deploy">("dashboard");
  const [systemStatus, setSystemStatus] = useState({
    postgres: "checking",
    redis: "checking",
    nginx: "checking",
    pm2: "checking",
  });

  useEffect(() => {
    // System status kontrolü
    checkSystemStatus();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      checkSystemStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const checkSystemStatus = async () => {
    try {
      const response = await fetch("http://localhost:3031/api/system/status");
      const data = await response.json();
      setSystemStatus(data);
    } catch (error) {
      console.error("System status check failed:", error);
    }
  };

  if (activeView === "deploy") {
    return (
      <DeploymentWizard
        onBack={() => setActiveView("dashboard")}
        onComplete={() => {
          setActiveView("dashboard");
          checkSystemStatus();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Server className="w-8 h-8 text-gray-900" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Qodify Installer
                </h1>
                <p className="text-sm text-gray-600">
                  Multi-Tenant E-Commerce Deployment System
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveView("deploy")}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-gray-900 to-slate-800 text-white rounded-lg hover:from-gray-800 hover:to-slate-700 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>Yeni Müşteri Kur</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <SystemStatus status={systemStatus} onRefresh={checkSystemStatus} />
            <div className="mt-6">
              <SystemConfig />
            </div>
          </div>
          <div className="lg:col-span-2">
            <CustomersList onRefresh={checkSystemStatus} />
          </div>
        </div>

        <div className="mt-6">
          <TemplateManager />
        </div>

        <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Activity className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">
              Son Aktiviteler
            </h2>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-gray-500 text-center py-4">
              Henüz aktivite bulunmuyor
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
