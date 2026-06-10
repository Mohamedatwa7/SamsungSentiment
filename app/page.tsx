"use client"

import Link from "next/link"
import Image from "next/image"
import { LayoutDashboard, MessageSquareText, ArrowRight, Star, ShoppingCart } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

export default function HomePage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Image 
              src="/images/samsung-logo.jpg" 
              alt="Samsung" 
              width={120} 
              height={24}
              className="dark:invert"
              style={{ width: 'auto', height: '24px' }}
            />
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Sentiment AI
              </span>
            </div>
          </div>
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-full transition-colors hover:bg-muted"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-12 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
            Customer Sentiment Intelligence
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Analyze customer feedback from Samsung Gulf social media channels
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Dashboard Card */}
          <Link href="/dashboard" className="group animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards">
            <Card className="h-full card-elevated hover-lift transition-all duration-200 group-hover:border-primary/50">
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <LayoutDashboard className="h-7 w-7" />
                </div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  Social Reviews Dashboard
                  <ArrowRight className="h-5 w-5 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </CardTitle>
                <CardDescription className="text-base">
                  View sentiment analytics, engagement metrics, and customer feedback from Instagram, TikTok, X, and Facebook.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Sentiment Analysis</span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Comments Feed</span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Engagement Metrics</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Marketplace Reviews Card */}
          <Link href="/marketplace" className="group animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-backwards">
            <Card className="h-full card-elevated hover-lift transition-all duration-200 group-hover:border-primary/50">
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <ShoppingCart className="h-7 w-7" />
                </div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  Marketplace Reviews
                  <ArrowRight className="h-5 w-5 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </CardTitle>
                <CardDescription className="text-base">
                  Analyze customer reviews from Amazon and Noon marketplaces. Track ratings, purchase intent, and competitor mentions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Amazon & Noon</span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Purchase Intent</span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Competitor Analysis</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* S.com Reviews Card */}
          <Link href="/reviews" className="group animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-backwards">
            <Card className="h-full card-elevated hover-lift transition-all duration-200 group-hover:border-primary/50">
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <Star className="h-7 w-7" />
                </div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  S.com Reviews
                  <ArrowRight className="h-5 w-5 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </CardTitle>
                <CardDescription className="text-base">
                  Analyze Samsung.com product reviews. Compare S26 vs S25 sentiment with YoY, MoM, and QoQ trends.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Product Reviews</span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">S26 vs S25</span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Theme Analysis</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* AI Chatbot Card */}
          <Link href="/chatbot" className="group animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-backwards">
            <Card className="h-full card-elevated hover-lift transition-all duration-200 group-hover:border-primary/50">
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <MessageSquareText className="h-7 w-7" />
                </div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  AI Chatbot
                  <ArrowRight className="h-5 w-5 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </CardTitle>
                <CardDescription className="text-base">
                  Ask questions about Samsung Gulf customer sentiment. Get insights powered by AI analysis of social media data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Natural Language</span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Gulf Region Focus</span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Source Citations</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Footer Info */}
        <div className="mt-16 border-t border-border/50 pt-8 text-center animate-in fade-in duration-700 delay-300 fill-mode-backwards">
          <p className="text-sm text-muted-foreground">
            Data sourced from @samsunggulf social media channels across UAE, Kuwait, Qatar, Bahrain, and Oman
          </p>
        </div>
      </main>
    </div>
  )
}
