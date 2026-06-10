"use client"

import { useState, useMemo } from "react"
import { Facebook, Instagram, ThumbsUp, MessageCircle, Share2, ExternalLink, RefreshCw, Eye, Play, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { type Platform } from "@/lib/social-data"
import { type DateRange } from "@/components/dashboard/date-filter"
import { useDashboardData, type CommentPlatform } from "@/contexts/dashboard-data-context"

interface SocialPost {
  id: string
  platform: Platform
  url: string
  content: string
  likes: number
  comments: number
  shares: number
  views?: number
  product: string
  publishDate: string
}

// X (Twitter) icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

// TikTok icon component
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  )
}

function PlatformIcon({ platform }: { platform: Platform }) {
  const iconConfig = {
    facebook: { bg: "bg-[#1877F2]/10", color: "text-[#1877F2]", Icon: Facebook },
    instagram: { bg: "bg-[#E4405F]/10", color: "text-[#E4405F]", Icon: Instagram },
    twitter: { bg: "bg-foreground/10", color: "text-foreground", Icon: XIcon },
    tiktok: { bg: "bg-foreground/10", color: "text-foreground", Icon: TikTokIcon },
  }

  const config = iconConfig[platform]
  const IconComponent = config.Icon

  return (
    <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", config.bg)}>
      <IconComponent className={cn("h-4 w-4", config.color)} />
    </div>
  )
}

function getPlatformLabel(platform: Platform): string {
  const labels: Record<Platform, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    twitter: "X",
    tiktok: "TikTok",
  }
  return labels[platform]
}

function SocialPostCard({ post }: { post: SocialPost }) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  return (
    <div className="group rounded-xl border border-border/50 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-sm">
      <div className="flex items-start gap-3">
        <PlatformIcon platform={post.platform} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Samsung Gulf</span>
              <span className="text-xs text-muted-foreground">@samsunggulf</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {getPlatformLabel(post.platform)}
              </Badge>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDate(post.publishDate)}</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 line-clamp-3">{post.content}</p>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>{formatNumber(post.likes)}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{formatNumber(post.comments)}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Share2 className="h-3.5 w-3.5" />
                <span>{formatNumber(post.shares)}</span>
              </div>
              {post.views && post.views > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Play className="h-3.5 w-3.5" />
                  <span>{formatNumber(post.views)}</span>
                </div>
              )}
            </div>
            <Badge variant="outline" className="text-xs font-normal">
              {post.product}
            </Badge>
          </div>
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 opacity-0 transition-opacity group-hover:opacity-100"
              asChild
            >
              <a href={post.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                View on {getPlatformLabel(post.platform)}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SocialFeedProps {
  platformFilter?: Platform[]
  dateRange?: DateRange
}

type FeedDateRange = "7" | "30" | "90" | "365" | "all"

export function SocialFeed({ platformFilter, dateRange }: SocialFeedProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<"all" | Platform>("all")
  const [localDateRange, setLocalDateRange] = useState<FeedDateRange>("all")

  // Pull merged synced + static data from the dashboard context
  const { getFilteredPosts, comments } = useDashboardData()

  // Build a comment-count map keyed by post URL
  const commentCountByUrl = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of comments) {
      if (c.postUrl) counts[c.postUrl] = (counts[c.postUrl] || 0) + 1
    }
    return counts
  }, [comments])

  // Get all posts (synced + static) and map to the feed card shape
  const allPostsUnfiltered = useMemo(() => {
    const normalized = getFilteredPosts(platformFilter as CommentPlatform[] | undefined, undefined)
    return normalized
      .map((post) => ({
        id: post.id,
        platform: post.platform as Platform,
        url: post.url,
        content: post.caption,
        likes: post.likes || 0,
        comments: commentCountByUrl[post.url] || 0,
        shares: 0,
        views: post.views || 0,
        product: post.productModel || post.productCategory || "Samsung",
        publishDate: post.timestamp,
      }))
      .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
  }, [getFilteredPosts, platformFilter, commentCountByUrl])

  // Apply local date filter
  const allPosts = useMemo(() => {
    if (localDateRange === "all") return allPostsUnfiltered
    
    const now = new Date()
    const days = parseInt(localDateRange)
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - days)
    
    return allPostsUnfiltered.filter(post => {
      const postDate = new Date(post.publishDate)
      return postDate >= cutoff
    })
  }, [allPostsUnfiltered, localDateRange])

  // Limit to 50 posts per view for performance
  const filteredPosts = (activeTab === "all" 
    ? allPosts 
    : allPosts.filter(post => post.platform === activeTab)
  ).slice(0, 50)

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const platformCounts = {
    all: allPosts.length,
    facebook: allPosts.filter(p => p.platform === "facebook").length,
    instagram: allPosts.filter(p => p.platform === "instagram").length,
    twitter: allPosts.filter(p => p.platform === "twitter").length,
    tiktok: allPosts.filter(p => p.platform === "tiktok").length,
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-semibold">Samsung Gulf Social Feed</CardTitle>
          <CardDescription>Recent posts from @samsunggulf across all platforms</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={localDateRange} onValueChange={(v) => setLocalDateRange(v as FeedDateRange)}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="all" className="text-xs">
              All ({platformCounts.all})
            </TabsTrigger>
            <TabsTrigger value="instagram" className="text-xs">
              <Instagram className="h-3 w-3 mr-1" />
              {platformCounts.instagram}
            </TabsTrigger>
            <TabsTrigger value="tiktok" className="text-xs">
              <TikTokIcon className="h-3 w-3 mr-1" />
              {platformCounts.tiktok}
            </TabsTrigger>
            <TabsTrigger value="twitter" className="text-xs">
              <XIcon className="h-3 w-3 mr-1" />
              {platformCounts.twitter}
            </TabsTrigger>
            <TabsTrigger value="facebook" className="text-xs">
              <Facebook className="h-3 w-3 mr-1" />
              {platformCounts.facebook}
            </TabsTrigger>
          </TabsList>
          <ScrollArea className="h-[550px] pr-4">
            <div className="flex flex-col gap-3">
              {filteredPosts.map((post) => (
                <SocialPostCard key={post.id} post={post as SocialPost} />
              ))}
            </div>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  )
}
