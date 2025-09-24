"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SystemOverviewTab } from "@/components/system/tabs/SystemOverviewTab";
import { SystemServicesTab } from "@/components/system/tabs/SystemServicesTab";
import { SystemConfigTab } from "@/components/system/tabs/SystemConfigTab";
import { Pm2ManagementTab } from "@/components/system/tabs/Pm2ManagementTab";
import { Activity, Server, Settings, Layers } from "lucide-react";

export default function SystemPage() {
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