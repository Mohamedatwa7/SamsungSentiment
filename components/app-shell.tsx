"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  MessageSquareText,
  Home,
  Star,
  LogOut,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const navItems = [
  { title: "Home", href: "/", icon: Home },
  { title: "Social Reviews Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "S.com Reviews", href: "/reviews", icon: Star },
  { title: "AI Chatbot", href: "/chatbot", icon: MessageSquareText },
]

/* Floating glass dock — vertical rail on desktop (left, vertically centered),
   horizontal pill docked to the bottom on mobile. Replaces the conventional
   sidebar entirely. */
function FloatingDock() {
  const pathname = usePathname()

  return (
    <TooltipProvider delayDuration={150}>
      <nav
        className={cn(
          "fixed z-40 flex items-center gap-1.5 border border-white/[0.08] bg-card/70 p-2 backdrop-blur-xl",
          "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)]",
          // mobile: bottom-centered horizontal pill
          "bottom-4 left-1/2 -translate-x-1/2 flex-row rounded-2xl",
          // desktop: left-centered vertical rail
          "lg:bottom-auto lg:left-4 lg:top-1/2 lg:-translate-x-0 lg:-translate-y-1/2 lg:flex-col lg:rounded-3xl",
        )}
      >
        <Link
          href="/"
          className="mb-0 mr-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-sm font-black tracking-tighter text-white shadow-[0_0_18px_var(--glow-primary)] lg:mb-1.5 lg:mr-0"
          aria-label="Samsung Sentiment AI"
        >
          S
        </Link>
        <div className="h-6 w-px bg-white/[0.08] lg:h-px lg:w-6" />
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  aria-label={item.title}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                    active
                      ? "bg-primary/20 text-foreground shadow-[0_0_16px_var(--glow-primary)]"
                      : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  {active && (
                    <span className="absolute -left-2 hidden h-5 w-[3px] rounded-full bg-gradient-to-b from-primary to-accent lg:block" />
                  )}
                  {active && (
                    <span className="absolute -bottom-2 block h-[3px] w-5 rounded-full bg-gradient-to-r from-primary to-accent lg:hidden" />
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className="hidden lg:block">
                {item.title}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </TooltipProvider>
  )
}

function TopNav() {
  const router = useRouter()

  const handleLogout = async () => {
    // Clear bypass cookie for hardcoded users
    document.cookie = 'samsung_auth_bypass=;path=/;max-age=0'
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-white/[0.06] bg-background/70 px-4 backdrop-blur-xl lg:pl-24">
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/images/samsung-logo.jpg"
          alt="Samsung"
          width={100}
          height={20}
          className="dark:invert"
          style={{ width: 'auto', height: '18px' }}
        />
        <span className="section-label hidden sm:inline">Sentiment AI</span>
      </Link>

      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
          </span>
          LIVE DATA
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="rounded-full text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-5 w-5" />
          <span className="sr-only">Logout</span>
        </Button>
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <FloatingDock />
      <TopNav />
      {/* Left padding clears the dock on desktop; bottom padding clears it on mobile */}
      <main className="pb-24 lg:pb-0 lg:pl-24 lg:pr-4">
        {children}
      </main>
    </div>
  )
}
