"use client";

import {
  Database,
  Terminal,
  AlertCircle,
  Loader2,
  Play,
  CheckCircle,
  Info,
  RefreshCw,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DatabaseOperations, DatabaseOutput } from "@/hooks/customers/useCustomerDatabase";

interface DatabaseTabProps {
  operations: DatabaseOperations;
  output: DatabaseOutput;
  onGeneratePrismaClient: () => Promise<any>;
  onPushSchema: () => Promise<any>;
  onRunMigrations: () => Promise<any>;
  onSeedDatabase: () => Promise<any>;
}

const DATABASE_OPERATIONS = [
  {
    id: "generate",
    title: "Prisma Client Oluştur",
    description: "Prisma Client'ı yeniden oluşturur",
    command: "npx prisma generate",
    icon: Terminal,
    color: "blue",
    loadingKey: "generating" as keyof DatabaseOperations,
    action: "onGeneratePrismaClient" as keyof Omit<DatabaseTabProps, "operations" | "output">,
    buttonText: "Çalıştır",
  },
  {
    id: "push",
    title: "Veritabanı Şemasını Güncelle",
    description: "Schema değişikliklerini veritabanına uygular",
    command: "npx prisma db push",
    icon: Database,
    color: "green",
    loadingKey: "pushing" as keyof DatabaseOperations,
    action: "onPushSchema" as keyof Omit<DatabaseTabProps, "operations" | "output">,
    buttonText: "Güncelle",
  },
  {
    id: "migrate",
    title: "Migration'ları Uygula",
    description: "Production migration'larını uygular",
    command: "npx prisma migrate deploy",
    icon: Layers,
    color: "purple",
    loadingKey: "migrating" as keyof DatabaseOperations,
    action: "onRunMigrations" as keyof Omit<DatabaseTabProps, "operations" | "output">,
    buttonText: "Migration Uygula",
  },
  {
    id: "seed",
    title: "Seed Verilerini Yükle",
    description: "Başlangıç verilerini yükler (kategoriler, iller, admin vs.)",
    command: "npm run db:seed",
    icon: RefreshCw,
    color: "orange",
    loadingKey: "seeding" as keyof DatabaseOperations,
    action: "onSeedDatabase" as keyof Omit<DatabaseTabProps, "operations" | "output">,
    buttonText: "Seed Çalıştır",
  },
];

const getColorClasses = (color: string) => {
  const colors = {
    blue: {
      button: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white",
      icon: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    green: {
      button: "bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white",
      icon: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    purple: {
      button: "bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white",
      icon: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    orange: {
      button: "bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white",
      icon: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/20",
    },
  };
  return colors[color as keyof typeof colors] || colors.blue;
};

export function DatabaseTab({
  operations,
  output,
  onGeneratePrismaClient,
  onPushSchema,
  onRunMigrations,
  onSeedDatabase,
}: DatabaseTabProps) {
  const actions = {
    onGeneratePrismaClient,
    onPushSchema,
    onRunMigrations,
    onSeedDatabase,
  };

  return (
    <div className="space-y-6">
      {/* Warning Alert */}
      <Alert className="border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/20">
        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">Dikkat</AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
          Bu işlemler veritabanı şemasını günceller. İşlem sırasında backend servisi yeniden başlatılabilir.
          Lütfen işlemleri dikkatli bir şekilde gerçekleştirin.
        </AlertDescription>
      </Alert>

      {/* Database Operations */}
      <div className="space-y-4">
        {DATABASE_OPERATIONS.map((operation) => {
          const Icon = operation.icon;
          const isLoading = operations[operation.loadingKey];
          const hasOutput = output[operation.id as keyof DatabaseOutput];
          const colorClasses = getColorClasses(operation.color);

          return (
            <Card key={operation.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colorClasses.bg}`}>
                      <Icon className={`h-5 w-5 ${colorClasses.icon}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{operation.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {operation.description}
                      </CardDescription>
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded mt-2 inline-block font-mono">
                        {operation.command}
                      </code>
                    </div>
                  </div>
                  <Button
                    onClick={actions[operation.action]}
                    disabled={isLoading || Object.values(operations).some(Boolean)}
                    className={`gap-2 ${colorClasses.button}`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Çalışıyor...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        {operation.buttonText}
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>

              {hasOutput && (
                <>
                  <Separator />
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Terminal className="h-4 w-4" />
                        <span>Komut Çıktısı</span>
                        {hasOutput.includes("success") ||
                        hasOutput.includes("Successfully") ? (
                          <Badge variant="default" className="gap-1 ml-auto">
                            <CheckCircle className="h-3 w-3" />
                            Başarılı
                          </Badge>
                        ) : null}
                      </div>
                      <ScrollArea className="h-40 w-full rounded-md border bg-gray-900 dark:bg-gray-950">
                        <pre className="p-4 text-xs text-gray-100 font-mono whitespace-pre-wrap break-all">
                          {hasOutput}
                        </pre>
                      </ScrollArea>
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          );
        })}
      </div>

      {/* Recommended Steps */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-5 w-5" />
            Önerilen Adımlar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">1</Badge>
              <span className="text-gray-700 dark:text-gray-300">
                Önce "Prisma Client Oluştur" komutunu çalıştırın
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">2</Badge>
              <span className="text-gray-700 dark:text-gray-300">
                Sonra "Veritabanı Şemasını Güncelle" ile şema değişikliklerini uygulayın
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">3</Badge>
              <span className="text-gray-700 dark:text-gray-300">
                Gerekirse "Seed Çalıştır" ile başlangıç verilerini yükleyin
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">4</Badge>
              <span className="text-gray-700 dark:text-gray-300">
                İşlemler tamamlandıktan sonra backend servisini yeniden başlatın
              </span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}