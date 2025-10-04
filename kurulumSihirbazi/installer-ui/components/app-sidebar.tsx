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
      title: "Kurulum Sihirbazı",
      url: "/setup",
      icon: Rocket,
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
  const { user: authUser } = useAuth()
  const [user, setUser] = React.useState(data.user)
  const navItems = React.useMemo(() => {
    const items = [...data.navMain]
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
  }, [authUser])

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
          ...((() => {
            try {
              const t = typeof window !== 'undefined' ? window.localStorage.getItem('qid_access') : null
              return t ? { headers: { Authorization: 'Bearer ' + t } } : {}
            } catch { return {} }
          })()),
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
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={handleLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
