"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SystemOverviewTab } from "@/components/system/tabs/SystemOverviewTab";
import { SystemServicesTab } from "@/components/system/tabs/SystemServicesTab";
import { SystemConfigTab } from "@/components/system/tabs/SystemConfigTab";
import { Pm2ManagementTab } from "@/components/system/tabs/Pm2ManagementTab";
import { Activity, Server, Settings, Layers, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";

export default function SystemPage() {
  const { user } = useAuth();

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
                  Bu sayfaya erişim yetkiniz bulunmamaktadır. Sistem yönetimi özellikleri sadece SUPER_ADMIN rolüne sahip kullanıcılar tarafından kullanılabilir.
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Sistem Durumu
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Sistem servislerini, kaynak kullanımını ve ayarları yönetin
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Genel Bakış</span>
            <span className="sm:hidden">Genel</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">Servisler</span>
            <span className="sm:hidden">Servis</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Ayarlar</span>
            <span className="sm:hidden">Ayar</span>
          </TabsTrigger>
          <TabsTrigger value="pm2" className="flex items-center space-x-2">
            <Layers className="h-4 w-4" />
            <span>PM2</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <SystemOverviewTab />
        </TabsContent>

        <TabsContent value="services" className="mt-6">
          <SystemServicesTab />
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <SystemConfigTab />
        </TabsContent>

        <TabsContent value="pm2" className="mt-6">
          <Pm2ManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}