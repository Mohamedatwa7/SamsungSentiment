"use client"

import { useState, useMemo } from "react"
import { Calendar, MessageCircle, ThumbsUp, ThumbsDown, Minus, ExternalLink, Instagram, Music2, Facebook, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { type DateRange } from "@/components/dashboard/date-filter"
import { useDashboardData, type CommentPlatform, type Sentiment } from "@/contexts/dashboard-data-context"

interface LastWeekPostsProps {
  platformFilter?: ("instagram" | "tiktok" | "facebook")[]
  dateRange?: DateRange
}

interface RecentActivityPost {
  id: string
  platform: CommentPlatform
  postUrl: string
  caption: string
  postDate: string
  totalComments: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  positivePercent: number
  negativePercent: number
  neutralPercent: number
  latestCommentDate: string
  sampleComments: { text: string; sentiment: Sentiment; username: string }[]
}

function SentimentBar({ positive, negative, neutral }: { positive: number; negative: number; neutral: number }) {
  const total = positive + negative + neutral
  if (total === 0) return null
  
  const posPercent = Math.round((positive / total) * 100)
  const negPercent = Math.round((negative / total) * 100)
  const neuPercent = 100 - posPercent - negPercent

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      <div 
        className="bg-positive transition-all" 
        style={{ width: `${posPercent}%` }} 
      />
      <div 
        className="bg-amber-500 transition-all" 
        style={{ width: `${neuPercent}%` }} 
      />
      <div 
        className="bg-negative transition-all" 
        style={{ width: `${negPercent}%` }} 
      />
    </div>
  )
}

function PostCard({ post, index }: { post: RecentActivityPost; index: number }) {
  const [expanded, setExpanded] = useState(false)
  
  const truncatedCaption = post.caption.length > 120 
    ? post.caption.slice(0, 120) + "..." 
    : post.caption

  const sentimentTrend = post.positivePercent - post.negativePercent

  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-sm",
      sentimentTrend > 20 && "border-positive/30",
      sentimentTrend < -20 && "border-negative/30",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white",
            post.platform === "instagram" && "bg-[#E4405F]",
            post.platform === "tiktok" && "bg-[#00f2ea]",
            post.platform === "facebook" && "bg-[#1877F2]"
          )}>
            {post.platform === "instagram" ? (
              <Instagram className="h-4 w-4" />
            ) : post.platform === "tiktok" ? (
              <Music2 className="h-4 w-4" />
            ) : (
              <Facebook className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {truncatedCaption || "(No caption)"}
            </p>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {post.totalComments} comments
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(post.postDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          asChild
        >
          <a href={post.postUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>

      {/* Sentiment Breakdown */}
      <div className="mt-3 space-y-2">
        <SentimentBar 
          positive={post.positiveCount} 
          negative={post.negativeCount} 
          neutral={post.neutralCount} 
        />
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-positive">
              <ThumbsUp className="h-3 w-3" />
              {post.positivePercent}%
            </span>
            <span className="flex items-center gap-1 text-amber-500">
              <Minus className="h-3 w-3" />
              {post.neutralPercent}%
            </span>
            <span className="flex items-center gap-1 text-negative">
              <ThumbsDown className="h-3 w-3" />
              {post.negativePercent}%
            </span>
          </div>
          <div className={cn(
            "flex items-center gap-1 font-medium",
            sentimentTrend > 0 ? "text-positive" : sentimentTrend < 0 ? "text-negative" : "text-muted-foreground"
          )}>
            {sentimentTrend > 0 ? <TrendingUp className="h-3 w-3" /> : sentimentTrend < 0 ? <TrendingDown className="h-3 w-3" /> : null}
            {sentimentTrend > 0 ? "+" : ""}{sentimentTrend}% net
          </div>
        </div>
      </div>

      {/* Sample Comments */}
      {post.sampleComments.length > 0 && (
        <div className="mt-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 text-xs gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : "Show"} sample comments
          </Button>
          
          {expanded && (
            <div className="mt-2 space-y-2">
              {post.sampleComments.map((c, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "rounded-lg p-2 text-xs",
                    c.sentiment === "positive" && "bg-positive/10",
                    c.sentiment === "negative" && "bg-negative/10",
                    c.sentiment === "neutral" && "bg-muted/50",
                  )}
                >
                  <span className="font-medium">@{c.username}:</span>{" "}
                  <span className="text-muted-foreground">{c.text.slice(0, 150)}{c.text.length > 150 ? "..." : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type PlatformTab = "all" | "instagram" | "tiktok" | "facebook"
type TimeRange = "7" | "14" | "30" | "90" | "all"

export function LastWeekPosts({ platformFilter, dateRange }: LastWeekPostsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformTab>("all")
  const [timeRange, setTimeRange] = useState<TimeRange>("7")

  // Pull merged synced + static data from the dashboard context
  const { getFilteredPosts, comments } = useDashboardData()

  // Group comments by post URL for fast lookup
  const commentsByUrl = useMemo(() => {
    const map = new Map<string, typeof comments>()
    for (const c of comments) {
      if (!c.postUrl) continue
      const arr = map.get(c.postUrl)
      if (arr) arr.push(c)
      else map.set(c.postUrl, [c])
    }
    return map
  }, [comments])

  // Build RecentActivityPost objects (all posts that have comment activity)
  const postsWithSentiment = useMemo<RecentActivityPost[]>(() => {
    const posts = getFilteredPosts(platformFilter as CommentPlatform[] | undefined, undefined)
    return posts
      .map((post) => {
        const pc = commentsByUrl.get(post.url) || []
        const positive = pc.filter((c) => c.sentiment === "positive").length
        const negative = pc.filter((c) => c.sentiment === "negative").length
        const neutral = pc.filter((c) => c.sentiment === "neutral").length
        const total = pc.length

        // Most recent comment date (fallback to the post timestamp)
        let latestCommentDate = post.timestamp
        let latestTime = 0
        for (const c of pc) {
          const t = new Date(c.createdAt).getTime()
          if (!Number.isNaN(t) && t > latestTime) {
            latestTime = t
            latestCommentDate = c.createdAt
          }
        }

        const sampleComments = pc
          .filter((c) => c.text && c.text.trim().length > 0)
          .slice(0, 3)
          .map((c) => ({ text: c.text, sentiment: c.sentiment, username: c.username }))

        return {
          id: post.id,
          platform: post.platform,
          postUrl: post.url,
          caption: post.caption,
          postDate: post.timestamp,
          totalComments: total,
          positiveCount: positive,
          negativeCount: negative,
          neutralCount: neutral,
          positivePercent: total > 0 ? Math.round((positive / total) * 100) : 0,
          negativePercent: total > 0 ? Math.round((negative / total) * 100) : 0,
          neutralPercent: total > 0 ? Math.round((neutral / total) * 100) : 0,
          latestCommentDate,
          sampleComments,
        }
      })
      .filter((p) => p.totalComments > 0)
      .sort((a, b) => new Date(b.latestCommentDate).getTime() - new Date(a.latestCommentDate).getTime())
  }, [getFilteredPosts, platformFilter, commentsByUrl])

  // Anchor the rolling window to the most recent comment date in the data
  const effectiveDateRange = useMemo((): DateRange | undefined => {
    if (timeRange === "all" || postsWithSentiment.length === 0) return undefined

    let maxDate = new Date(0)
    for (const post of postsWithSentiment) {
      const d = new Date(post.latestCommentDate)
      if (d > maxDate) maxDate = d
    }

    const from = new Date(maxDate)
    from.setDate(from.getDate() - parseInt(timeRange))
    return { from, to: maxDate }
  }, [timeRange, postsWithSentiment])

  // Apply the selected time range
  const allPosts = useMemo(() => {
    if (timeRange === "all" || !effectiveDateRange?.from) return postsWithSentiment
    const cutoff = effectiveDateRange.from.getTime()
    return postsWithSentiment.filter((p) => {
      const t = new Date(p.latestCommentDate).getTime()
      return !Number.isNaN(t) && t >= cutoff
    })
  }, [postsWithSentiment, timeRange, effectiveDateRange])
  
  // Filter posts by selected platform tab
  const posts = useMemo(() => {
    if (selectedPlatform === "all") return allPosts
    return allPosts.filter(p => p.platform === selectedPlatform)
  }, [allPosts, selectedPlatform])
  
  // Count posts per platform for tab badges
  const platformCounts = useMemo(() => ({
    all: allPosts.length,
    instagram: allPosts.filter(p => p.platform === "instagram").length,
    tiktok: allPosts.filter(p => p.platform === "tiktok").length,
    facebook: allPosts.filter(p => p.platform === "facebook").length,
  }), [allPosts])

  // Calculate overall stats
  const stats = useMemo(() => {
    const totalComments = posts.reduce((sum, p) => sum + p.totalComments, 0)
    const totalPositive = posts.reduce((sum, p) => sum + p.positiveCount, 0)
    const totalNegative = posts.reduce((sum, p) => sum + p.negativeCount, 0)
    const totalNeutral = posts.reduce((sum, p) => sum + p.neutralCount, 0)
    
    const avgPositive = totalComments > 0 ? Math.round((totalPositive / totalComments) * 100) : 0
    const avgNegative = totalComments > 0 ? Math.round((totalNegative / totalComments) * 100) : 0
    
    return {
      totalPosts: posts.length,
      totalComments,
      totalPositive,
      totalNegative,
      totalNeutral,
      avgPositive,
      avgNegative,
      netSentiment: avgPositive - avgNegative,
    }
  }, [posts])

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Posts with comment sentiment
              {effectiveDateRange?.from && effectiveDateRange?.to && (
                <span className="ml-1">
                  ({effectiveDateRange.from.toLocaleDateString()} - {effectiveDateRange.to.toLocaleDateString()})
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 px-2 gap-1"
            >
              {isCollapsed ? (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Expand
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Collapse
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Platform Tabs */}
        <Tabs value={selectedPlatform} onValueChange={(v) => setSelectedPlatform(v as PlatformTab)} className="px-6">
          <TabsList className="h-9 w-auto">
            <TabsTrigger value="all" className="gap-1.5 text-xs px-3">
              All
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{platformCounts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="instagram" className="gap-1.5 text-xs px-3">
              <Instagram className="h-3.5 w-3.5 text-[#E4405F]" />
              Instagram
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{platformCounts.instagram}</Badge>
            </TabsTrigger>
            <TabsTrigger value="tiktok" className="gap-1.5 text-xs px-3">
              <Music2 className="h-3.5 w-3.5 text-[#00f2ea]" />
              TikTok
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{platformCounts.tiktok}</Badge>
            </TabsTrigger>
            <TabsTrigger value="facebook" className="gap-1.5 text-xs px-3">
              <Facebook className="h-3.5 w-3.5 text-[#1877F2]" />
              Facebook
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{platformCounts.facebook}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent className="pt-4">
          {/* Summary Stats */}
          <div className="mb-4 grid grid-cols-4 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xl font-bold text-foreground">{stats.totalPosts}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xl font-bold text-foreground">{stats.totalComments.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Comments</p>
            </div>
            <div className="rounded-lg bg-positive/10 p-3 text-center">
              <p className="text-xl font-bold text-positive">{stats.avgPositive}%</p>
              <p className="text-xs text-muted-foreground">Positive</p>
            </div>
            <div className="rounded-lg bg-negative/10 p-3 text-center">
              <p className="text-xl font-bold text-negative">{stats.avgNegative}%</p>
              <p className="text-xs text-muted-foreground">Negative</p>
            </div>
          </div>

          {/* Overall Sentiment Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Overall Sentiment Distribution</span>
              <span className={cn(
                "font-medium",
                stats.netSentiment > 0 ? "text-positive" : stats.netSentiment < 0 ? "text-negative" : "text-muted-foreground"
              )}>
                Net: {stats.netSentiment > 0 ? "+" : ""}{stats.netSentiment}%
              </span>
            </div>
            <SentimentBar 
              positive={stats.totalPositive} 
              negative={stats.totalNegative} 
              neutral={stats.totalNeutral} 
            />
          </div>

          {/* Posts List */}
          <div className="mb-2 text-xs text-muted-foreground">
            {posts.length} posts with activity
            {timeRange === "all" ? " (all time)" : ` in the last ${timeRange} days`}
          </div>
          <ScrollArea className="h-[400px] pr-4">
            <div className="flex flex-col gap-3">
              {posts.length > 0 ? (
                posts.map((post, index) => (
                  <PostCard key={post.postUrl} post={post} index={index} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No posts with comments {timeRange === "all" ? "" : `in the last ${timeRange} days`}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  )
}
