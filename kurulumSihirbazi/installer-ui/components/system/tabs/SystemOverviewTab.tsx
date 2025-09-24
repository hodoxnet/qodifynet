"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useSystemResources } from "@/hooks/system/useSystemResources";
import { Cpu, HardDrive, Network, Activity, Server, Database, Globe, CircuitBoard } from "lucide-react";

export function SystemOverviewTab() {
  const { resources, loading } = useSystemResources();

  if (loading && !resources) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Sistem bilgileri yükleniyor...</div>
      </div>
    );
  }

  if (!resources) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Sistem bilgileri alınamadı</div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Resource Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CPU Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <CardTitle className="text-sm font-medium">CPU Kullanımı</CardTitle>
              </div>
              <Badge variant="secondary">{resources.cpu.cores} Core</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">
              {resources.cpu.usage?.toFixed(1) || 0}%
            </div>
            <Progress value={resources.cpu.usage || 0} className="h-2" />
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {resources.cpu.model || "Bilinmiyor"}
            </div>
          </CardContent>
        </Card>

        {/* Memory Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CircuitBoard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-sm font-medium">Bellek Kullanımı</CardTitle>
              </div>
              <Badge variant="secondary">{resources.memory.totalGB?.toFixed(1) || 0} GB</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">
              {resources.memory.usedPercent?.toFixed(1) || 0}%
            </div>
            <Progress value={resources.memory.usedPercent || 0} className="h-2" />
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {resources.memory.usedGB?.toFixed(1) || 0} GB / {resources.memory.totalGB?.toFixed(1) || 0} GB
            </div>
          </CardContent>
        </Card>

        {/* Disk Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <CardTitle className="text-sm font-medium">Disk Kullanımı</CardTitle>
              </div>
              <Badge variant="secondary">{resources.disk.totalGB?.toFixed(1) || 0} GB</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">
              {resources.disk.usedPercent?.toFixed(1) || 0}%
            </div>
            <Progress value={resources.disk.usedPercent || 0} className="h-2" />
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {resources.disk.usedGB?.toFixed(1) || 0} GB / {resources.disk.totalGB?.toFixed(1) || 0} GB
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Info */}
      {resources.network && resources.network.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Network className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <CardTitle>Ağ Arayüzleri</CardTitle>
              <CardDescription>Aktif network bağlantıları</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resources.network.map((iface, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <div className="font-medium text-sm">{iface.iface}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{iface.ip}</div>
                    </div>
                  </div>
                  <Badge variant="outline">Aktif</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <CardTitle>Sistem Detayları</CardTitle>
            <CardDescription>Donanım ve yazılım bilgileri</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm font-medium">
                <Cpu className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span>CPU</span>
              </div>
              <dl className="space-y-1">
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500 dark:text-gray-400">Model:</dt>
                  <dd className="font-medium truncate max-w-[200px]">{resources.cpu.model || "N/A"}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500 dark:text-gray-400">Çekirdek:</dt>
                  <dd className="font-medium">{resources.cpu.cores || "N/A"}</dd>
                </div>
              </dl>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm font-medium">
                <CircuitBoard className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span>Bellek</span>
              </div>
              <dl className="space-y-1">
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500 dark:text-gray-400">Toplam:</dt>
                  <dd className="font-medium">{resources.memory.totalGB?.toFixed(1) || 0} GB</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500 dark:text-gray-400">Boş:</dt>
                  <dd className="font-medium">
                    {((resources.memory.totalGB || 0) - (resources.memory.usedGB || 0)).toFixed(1)} GB
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm font-medium">
                <HardDrive className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span>Disk</span>
              </div>
              <dl className="space-y-1">
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500 dark:text-gray-400">Toplam:</dt>
                  <dd className="font-medium">{resources.disk.totalGB?.toFixed(1) || 0} GB</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500 dark:text-gray-400">Boş:</dt>
                  <dd className="font-medium">
                    {((resources.disk.totalGB || 0) - (resources.disk.usedGB || 0)).toFixed(1)} GB
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}