"use client"

import { useEffect, useState } from "react"
import {
  Activity,
  CreditCard,
  DollarSign,
  Download,
  Users,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

export default function DashboardPage() {
  const [systemResources, setSystemResources] = useState({
    cpu: 0,
    memory: 0,
    disk: 0,
  })
  const [customerStats, setCustomerStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Sistem kaynakları
        const resourcesRes = await fetch("http://localhost:3031/api/system/resources")
        const resources = await resourcesRes.json()

        // Müşteri istatistikleri
        const customersRes = await fetch("http://localhost:3031/api/customers")
        const customers = await customersRes.json()

        setSystemResources({
          cpu: resources.cpu?.usage || 0,
          memory: resources.memory?.usedPercent || 0,
          disk: resources.disk?.usedPercent || 0,
        })

        setCustomerStats({
          total: customers.length,
          active: customers.filter((c: any) => c.status === "running").length,
          inactive: customers.filter((c: any) => c.status !== "running").length,
        })
      } catch (error) {
        console.error("Dashboard data fetch failed:", error)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">v2.4.0</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Toplam Müşteri
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {customerStats.active} aktif, {customerStats.inactive} pasif
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Aktif Kurulum
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerStats.active}</div>
            <p className="text-xs text-muted-foreground">
              +20% son aydan
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Kullanımı</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemResources.cpu.toFixed(1)}%</div>
            <Progress value={systemResources.cpu} className="h-2 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              RAM Kullanımı
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemResources.memory.toFixed(1)}%</div>
            <Progress value={systemResources.memory} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Sistem Durumu</CardTitle>
            <CardDescription>
              Kritik servislerin durumu ve performansı
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="space-y-4">
              <ServiceStatus service="PostgreSQL" status="running" usage={45} />
              <ServiceStatus service="Redis" status="running" usage={23} />
              <ServiceStatus service="Nginx" status="running" usage={67} />
              <ServiceStatus service="PM2" status="running" usage={52} />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Son Aktiviteler</CardTitle>
            <CardDescription>
              Sistemde gerçekleşen son işlemler
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ActivityItem
                title="Yeni müşteri eklendi"
                description="testmusteri.local başarıyla kuruldu"
                time="2 dk önce"
                type="success"
              />
              <ActivityItem
                title="Sistem güncellendi"
                description="v2.4.0 versiyonu yüklendi"
                time="1 saat önce"
                type="info"
              />
              <ActivityItem
                title="Backup alındı"
                description="Günlük yedekleme tamamlandı"
                time="3 saat önce"
                type="success"
              />
              <ActivityItem
                title="SSL sertifikası yenilendi"
                description="example.com için SSL güncellendi"
                time="5 saat önce"
                type="warning"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function ServiceStatus({ service, status, usage }: { service: string; status: string; usage: number }) {
  return (
    <div className="flex items-center space-x-4">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium leading-none">{service}</p>
          <Badge variant={status === "running" ? "default" : "destructive"}>
            {status}
          </Badge>
        </div>
        <Progress value={usage} className="h-2" />
      </div>
    </div>
  )
}

function ActivityItem({
  title,
  description,
  time,
  type
}: {
  title: string
  description: string
  time: string
  type: "success" | "warning" | "error" | "info"
}) {
  const colors = {
    success: "text-green-600 bg-green-50",
    warning: "text-yellow-600 bg-yellow-50",
    error: "text-red-600 bg-red-50",
    info: "text-blue-600 bg-blue-50",
  }

  return (
    <div className="flex items-start space-x-4">
      <div className={`p-2 rounded-full ${colors[type]}`}>
        <Activity className="h-3 w-3" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium leading-none">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  )
}