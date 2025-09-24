"use client"

import * as React from "react"
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
  Settings2,
  SquareTerminal,
  Users,
  Wand2,
  Server,
  FileCode,
  Activity,
  Package,
  Rocket,
  History,
  FileText,
  Database,
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
      title: "WordPress Tarzı Setup",
      url: "/setup",
      icon: Rocket,
    },
    {
      title: "Kurulum Sihirbazı",
      url: "#",
      icon: Wand2,
      items: [
        {
          title: "Yeni Kurulum",
          url: "/wizard/new",
          icon: Rocket,
        },
        {
          title: "Devam Eden Kurulumlar",
          url: "/wizard",
          icon: Settings2,
        },
        {
          title: "Tamamlanan Kurulumlar",
          url: "/wizard/completed",
          icon: History,
        },
        {
          title: "Kurulum Şablonları",
          url: "/wizard/templates",
          icon: FileText,
        },
      ],
    },
    {
      title: "Sistem Durumu",
      url: "/system",
      icon: Server,
    },
    {
      title: "Müşteriler",
      url: "/customers",
      icon: Users,
    },
    {
      title: "Template Dosyaları",
      url: "/templates",
      icon: FileCode,
    },
    {
      title: "Son Aktiviteler",
      url: "/activities",
      icon: Activity,
    },
  ],
  navSecondary: [
    {
      title: "Destek",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Geri Bildirim",
      url: "#",
      icon: Send,
    },
  ],
  projects: [
    {
      name: "Aktif Müşteriler",
      url: "#",
      icon: Package,
    },
    {
      name: "Son Kurulumlar",
      url: "#",
      icon: Rocket,
    },
    {
      name: "Sistem Kaynakları",
      url: "#",
      icon: Database,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState(data.user)

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
        const res = await fetch((process.env.NEXT_PUBLIC_INSTALLER_API_URL || 'http://localhost:3031') + '/api/auth/me', {
          credentials: 'include',
          headers: (() => {
            try {
              const t = typeof window !== 'undefined' ? window.localStorage.getItem('qid_access') : null
              return t ? { Authorization: 'Bearer ' + t } : {}
            } catch { return {} }
          })(),
        })
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
      await fetch((process.env.NEXT_PUBLIC_INSTALLER_API_URL || 'http://localhost:3031') + '/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
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
              <a href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Qodify</span>
                  <span className="truncate text-xs">Kurulum Sihirbazı</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={handleLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
