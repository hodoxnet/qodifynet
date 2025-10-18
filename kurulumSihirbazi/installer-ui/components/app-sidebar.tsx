"use client"

import * as React from "react"
import Link from "next/link"
import {
  BookOpen,
  Bot,
  Command,
  Frame,
  LayoutDashboard,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  SquareTerminal,
  Users,
  Server,
  FileCode,
  Activity,
  Package,
  Rocket,
  Database,
  ListChecks,
  Plus,
  Clock,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/context/AuthContext"
import { apiFetch } from "@/lib/api"

const data = {
  user: {
    name: "",
    email: "",
    avatar: "/api/avatar",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
      isActive: true,
    },
    {
      title: "Kurulum Yönetimi",
      url: "/setup",
      icon: Rocket,
      items: [
        {
          title: "Yeni Kurulum",
          url: "/setup",
          icon: Plus,
        },
        {
          title: "Aktif Kurulumlar",
          url: "/setup/active",
          icon: ListChecks,
        },
      ],
    },
    {
      title: "Müşteriler",
      url: "/customers",
      icon: Users,
    },
    {
      title: "Son Aktiviteler",
      url: "/activities",
      icon: Activity,
    },
  ],
  navSecondary: [
    {
      title: "Sistem Durumu",
      url: "/system",
      icon: Server,
    },
    {
      title: "Template Dosyaları",
      url: "/templates",
      icon: FileCode,
    },
  ],
  projects: [],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user: authUser } = useAuth()
  const [user, setUser] = React.useState(data.user)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const navItems = React.useMemo(() => {
    if (!mounted) return data.navMain
    let items = [...data.navMain]

    // Son Aktiviteler sadece SUPER_ADMIN için
    if (authUser?.role !== 'SUPER_ADMIN') {
      items = items.filter(i => i.url !== '/activities')
    }

    if (authUser?.role === 'SUPER_ADMIN') {
      if (!items.find(i => i.url === '/partners')) {
        items.splice(3, 0, { title: 'Partnerler', url: '/partners', icon: Users })
      }
      if (!items.find(i => i.url === '/partners/applications')) {
        // Ekleme: Partner Başvuruları
        items.splice(4, 0, { title: 'Partner Başvuruları', url: '/partners/applications', icon: Send })
      }
    }
    return items
  }, [authUser, mounted])

  const navSecondaryItems = React.useMemo(() => {
    if (!mounted) return data.navSecondary
    // Sistem Durumu ve Template Dosyaları sadece SUPER_ADMIN için
    if (authUser?.role === 'SUPER_ADMIN') {
      return data.navSecondary
    }
    return []
  }, [authUser, mounted])

  React.useEffect(() => {
    const defaultAvatar = process.env.NEXT_PUBLIC_USER_AVATAR || "/api/avatar"
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('qid_user') : null
    if (stored) {
      try {
        const u = JSON.parse(stored)
        setUser({
          name: u?.name || u?.email || 'Kullanıcı',
          email: u?.email || '',
          avatar: u?.avatar || defaultAvatar,
        })
      } catch {}
    }

    // Fetch from API for fresh data
    ;(async () => {
      try {
        const res = await apiFetch('/api/auth/me')
        if (!res.ok) return
        const data = await res.json()
        const u = data?.user || {}
        const avatar = (typeof window !== 'undefined' ? window.localStorage.getItem('qid_avatar') : null) || defaultAvatar
        const next = {
          name: u?.name || u?.email || 'Kullanıcı',
          email: u?.email || '',
          avatar,
        }
        setUser(next)
        try { window.localStorage.setItem('qid_user', JSON.stringify(next)) } catch {}
      } catch {}
    })()
  }, [])

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    try {
      window.localStorage.removeItem('qid_access')
      window.localStorage.removeItem('qid_user')
      window.localStorage.removeItem('qid_avatar')
    } catch {}
    window.location.href = '/login'
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-gray-900 dark:text-gray-100">Qodify</span>
                  <span className="truncate text-xs text-gray-600 dark:text-gray-400">Kurulum Sihirbazı</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
        <NavProjects projects={data.projects} />
        <NavSecondary items={navSecondaryItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={handleLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
