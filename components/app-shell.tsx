"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  MessageSquareText,
  Home,
  Moon,
  Sun,
  Star,
  ShoppingCart,
  Settings,
  LogOut,
} from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
const navItems = [
  {
    title: "Home",
    href: "/",
    icon: Home,
  },
  {
    title: "Social Reviews Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "S.com Reviews",
    href: "/reviews",
    icon: Star,
  },
  {
    title: "AI Chatbot",
    href: "/chatbot",
    icon: MessageSquareText,
  },
]

function TopNav() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = async () => {
    // Clear bypass cookie for hardcoded users
    document.cookie = 'samsung_auth_bypass=;path=/;max-age=0'
    // Sign out from Supabase
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      
      <div className="flex items-center gap-2">
        {mounted && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-full"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="rounded-full text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Logout</span>
            </Button>
          </>
        )}
      </div>
    </header>
  )
}

function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-auto items-center justify-center group-data-[collapsible=icon]:w-9">
            <Image 
              src="/images/samsung-logo.jpg" 
              alt="Samsung" 
              width={120} 
              height={24}
              className="dark:invert"
              style={{ width: 'auto', height: 'auto' }}
            />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">
              Sentiment AI
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                    className="h-11 gap-3"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
          </span>
          <span className="text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            System Online
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <TopNav />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
