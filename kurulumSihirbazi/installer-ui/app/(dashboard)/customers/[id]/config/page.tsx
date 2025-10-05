"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  RefreshCw,
  Save,
  AlertCircle,
  Server,
  Monitor,
  ShoppingBag,
  Users,
  Database,
  ArrowLeft,
  Loader2,
  Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Hooks
import { useCustomerConfig } from "@/hooks/customers/useCustomerConfig";
import { useCustomerAdmins } from "@/hooks/customers/useCustomerAdmins";
import { useCustomerDatabase } from "@/hooks/customers/useCustomerDatabase";

// Components
import { EnvironmentTab } from "@/components/customers/config/EnvironmentTab";
import { AdminsTab } from "@/components/customers/config/AdminsTab";
import { DatabaseTab } from "@/components/customers/config/DatabaseTab";
import { DemoDataTab } from "@/components/customers/config/DemoDataTab";

const TAB_CONFIG = [
  { value: "backend", label: "Backend API", icon: Server },
  { value: "admin", label: "Admin Panel", icon: Monitor },
  { value: "store", label: "Store", icon: ShoppingBag },
  { value: "admins", label: "Yöneticiler", icon: Users },
  { value: "database", label: "Veritabanı", icon: Database },
  { value: "demo", label: "Demo Veriler", icon: Upload },
];

export default function CustomerConfigPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [activeTab, setActiveTab] = useState<string>("backend");

  // Custom Hooks
  const {
    loading,
    saving,
    envConfig,
    modifiedValues,
    restarting,
    handleValueChange,
    saveChanges,
    restartService,
    hasModifications,
  } = useCustomerConfig(customerId);

  const { admins, loading: loadingAdmins, creating, createAdmin } = useCustomerAdmins(customerId);

  const {
    operations,
    output,
    generatePrismaClient,
    pushSchema,
    runMigrations,
    seedDatabase,
  } = useCustomerDatabase(customerId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">Konfigürasyon yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!envConfig) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            Konfigürasyon yüklenemedi
          </p>
          <Button onClick={() => router.push("/customers")} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Geri Dön
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Environment Konfigürasyonu
            </h1>
            <Badge variant="outline" className="font-mono">
              {envConfig.domain}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <span>Backend:</span>
              <span className="font-mono font-semibold">{envConfig.ports.backend}</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1">
              <span>Admin:</span>
              <span className="font-mono font-semibold">{envConfig.ports.admin}</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1">
              <span>Store:</span>
              <span className="font-mono font-semibold">{envConfig.ports.store}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={saveChanges}
            disabled={saving || !hasModifications}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Değişiklikleri Kaydet
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => restartService()}
            disabled={restarting !== null}
            className="gap-2"
          >
            {restarting === "all" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Yeniden Başlatılıyor...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Tümünü Yeniden Başlat
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => router.push("/customers")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Geri
          </Button>
        </div>
      </div>

      {/* Warning Message */}
      {hasModifications && (
        <Alert className="border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/20">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            <strong className="font-semibold">Kaydedilmemiş değişiklikler var!</strong>
            <br />
            Değişiklikleri uygulamak için &quot;Değişiklikleri Kaydet&quot; butonuna tıklayın.
          </AlertDescription>
        </Alert>
      )}

      {/* Configuration Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-6 py-3 font-medium"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <CardContent className="pt-6">
            {/* Environment Config Tabs */}
            {["backend", "admin", "store"].map((service) => (
              <TabsContent key={service} value={service} className="mt-0 space-y-4">
                <EnvironmentTab
                  service={service as "backend" | "admin" | "store"}
                  envConfig={envConfig}
                  modifiedValues={modifiedValues}
                  restarting={restarting}
                  onValueChange={handleValueChange}
                  onRestartService={restartService}
                />
              </TabsContent>
            ))}

            {/* Admins Tab */}
            <TabsContent value="admins" className="mt-0">
              <AdminsTab
                admins={admins}
                loading={loadingAdmins}
                creating={creating}
                onCreateAdmin={createAdmin}
              />
            </TabsContent>

            {/* Database Tab */}
            <TabsContent value="database" className="mt-0">
              <DatabaseTab
                operations={operations}
                output={output}
                onGeneratePrismaClient={generatePrismaClient}
                onPushSchema={pushSchema}
                onRunMigrations={runMigrations}
                onSeedDatabase={seedDatabase}
              />
            </TabsContent>

            {/* Demo Data Tab */}
            <TabsContent value="demo" className="mt-0">
              <DemoDataTab domain={envConfig.domain} />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
