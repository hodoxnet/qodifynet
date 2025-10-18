"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DemoPacksSection } from "@/components/templates/DemoPacksSection";
import { GitSettingsTab } from "@/components/templates/GitSettingsTab";

export default function TemplatesPage() {
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
                  Bu sayfaya erişim yetkiniz bulunmamaktadır. Demo veri ve Git yapılandırma ayarlarına yalnızca SUPER_ADMIN kullanıcılar erişebilir.
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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Demo ve Git Yapılandırması</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Demo veri paketlerini yönetin ve kurulumlarda kullanılacak Git deposu ayarlarını güncelleyin.
        </p>
      </div>

      <Tabs defaultValue="demo" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger value="demo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-6 py-3 font-medium">
            Demo Verileri
          </TabsTrigger>
          <TabsTrigger value="git" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-6 py-3 font-medium">
            Git Ayarları
          </TabsTrigger>
        </TabsList>

        <TabsContent value="demo" className="mt-6">
          <DemoPacksSection />
        </TabsContent>

        <TabsContent value="git" className="mt-6">
          <GitSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
