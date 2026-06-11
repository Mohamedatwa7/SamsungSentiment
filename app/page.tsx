"use client"

import Link from "next/link"
import Image from "next/image"
import { LayoutDashboard, MessageSquareText, ArrowRight, Star } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-20">
        <div className="accent-top rule-b mb-14 pb-12 pt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="section-label mb-4">Sentiment AI</p>
          <h1 className="display-title text-4xl md:text-6xl">
            <span className="text-gradient">Customer Sentiment</span>{" "}
            <span className="text-foreground">Intelligence</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Analyze customer feedback from Samsung Gulf social media channels
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Dashboard Card */}
          <Link href="/dashboard" className="group animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards">
            <Card className="h-full transition-colors duration-200 group-hover:border-foreground/60 group-hover:bg-muted/30">
              <CardHeader>
                <div className="mb-4 text-muted-foreground">
                  <LayoutDashboard className="h-7 w-7" />
                </div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  Social Reviews Dashboard
                  <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </CardTitle>
                <CardDescription className="text-base">
                  View sentiment analytics, engagement metrics, and customer feedback from Instagram, TikTok, X, and Facebook.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-sm border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">Sentiment Analysis</span>
                  <span className="rounded-sm border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">Comments Feed</span>
                  <span className="rounded-sm border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">Engagement Metrics</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* S.com Reviews Card */}
          <Link href="/reviews" className="group animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-backwards">
            <Card className="h-full transition-colors duration-200 group-hover:border-foreground/60 group-hover:bg-muted/30">
              <CardHeader>
                <div className="mb-4 text-muted-foreground">
                  <Star className="h-7 w-7" />
                </div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  S.com Reviews
                  <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </CardTitle>
                <CardDescription className="text-base">
                  Analyze Samsung.com product reviews. Compare S26 vs S25 sentiment with YoY, MoM, and QoQ trends.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-sm border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">Product Reviews</span>
                  <span className="rounded-sm border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">S26 vs S25</span>
                  <span className="rounded-sm border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">Theme Analysis</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* AI Chatbot Card */}
          <Link href="/chatbot" className="group animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-backwards">
            <Card className="h-full transition-colors duration-200 group-hover:border-foreground/60 group-hover:bg-muted/30">
              <CardHeader>
                <div className="mb-4 text-muted-foreground">
                  <MessageSquareText className="h-7 w-7" />
                </div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  AI Chatbot
                  <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </CardTitle>
                <CardDescription className="text-base">
                  Ask questions about Samsung Gulf customer sentiment. Get insights powered by AI analysis of social media data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-sm border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">Natural Language</span>
                  <span className="rounded-sm border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">Gulf Region Focus</span>
                  <span className="rounded-sm border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">Source Citations</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Footer Info */}
        <div className="mt-20 rule-t pt-8 text-center animate-in fade-in duration-700 delay-300 fill-mode-backwards">
          <p className="text-sm text-muted-foreground">
            Data sourced from @samsunggulf social media channels across UAE, Kuwait, Qatar, Bahrain, and Oman
          </p>
        </div>
      </main>
    </div>
  )
}
