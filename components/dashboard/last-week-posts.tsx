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
  platformFilter?: ("instagram" | "tiktok" | "facebook" | "twitter")[]
  dateRange?: DateRange
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
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
    <div className="flex h-1.5 w-full overflow-hidden bg-muted">
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
      "border-b border-border/70 py-4 px-0 transition-colors last:border-0 hover:bg-muted/40",
      sentimentTrend > 20 && "border-l-2 border-l-positive pl-4",
      sentimentTrend < -20 && "border-l-2 border-l-negative pl-4",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center">
            {post.platform === "instagram" ? (
              <Instagram className="h-4 w-4 text-[#E4405F]" />
            ) : post.platform === "tiktok" ? (
              <Music2 className="h-4 w-4 text-[#00f2ea]" />
            ) : post.platform === "twitter" ? (
              <XIcon className="h-4 w-4 text-foreground" />
            ) : (
              <Facebook className="h-4 w-4 text-[#1877F2]" />
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
      {post.totalComments === 0 ? (
        <p className="mt-3 text-xs italic text-muted-foreground/70">No comments yet</p>
      ) : (
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
      )}

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
                    "border-l-2 py-1 pl-3 text-xs",
                    c.sentiment === "positive" && "border-l-positive",
                    c.sentiment === "negative" && "border-l-negative",
                    c.sentiment === "neutral" && "border-l-border",
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

type PlatformTab = "all" | "instagram" | "tiktok" | "facebook" | "twitter"
type TimeRange = "7" | "14" | "30" | "90" | "all"

export function LastWeekPosts({ platformFilter, dateRange }: LastWeekPostsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformTab>("all")
  // 30 days by default: X replies and Facebook comments arrive in bursts, so a
  // 7-day window often shows almost nothing for those platforms.
  const [timeRange, setTimeRange] = useState<TimeRange>("30")

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
      // Zero-comment posts stay in the list (their latestCommentDate falls
      // back to the publish date) — "activity" includes posting itself, and
      // platforms with thin reply volume (X) would otherwise look empty.
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
    twitter: allPosts.filter(p => p.platform === "twitter").length,
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
    <Card className="animate-in fade-in duration-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Recent posts and their comment sentiment
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
        <Tabs value={selectedPlatform} onValueChange={(v) => setSelectedPlatform(v as PlatformTab)}>
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
            <TabsTrigger value="twitter" className="gap-1.5 text-xs px-3">
              <XIcon className="h-3.5 w-3.5" />
              X
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{platformCounts.twitter}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent className="pt-4">
          {/* Summary Stats */}
          <div className="stat-rail divide-none mb-4 grid grid-cols-2 gap-y-4 text-center lg:grid-cols-4">
            <div className="py-1">
              <p className="kpi-value text-3xl text-foreground">{stats.totalPosts}</p>
              <p className="section-label mt-1">Posts</p>
            </div>
            <div className="py-1">
              <p className="kpi-value text-3xl text-foreground">{stats.totalComments.toLocaleString()}</p>
              <p className="section-label mt-1">Comments</p>
            </div>
            <div className="py-1">
              <p className="kpi-value text-3xl text-positive">{stats.avgPositive}%</p>
              <p className="section-label mt-1">Positive</p>
            </div>
            <div className="py-1">
              <p className="kpi-value text-3xl text-negative">{stats.avgNegative}%</p>
              <p className="section-label mt-1">Negative</p>
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
            {posts.length} posts
            {timeRange === "all" ? " (all time)" : ` in the last ${timeRange} days`}
            {posts.length > 200 && " · showing the 200 most recent"}
          </div>
          <ScrollArea className="nice-scroll h-[400px] pr-4">
            <div className="flex flex-col">
              {posts.length > 0 ? (
                posts.slice(0, 200).map((post, index) => (
                  <PostCard key={post.postUrl} post={post} index={index} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No posts {timeRange === "all" ? "" : `in the last ${timeRange} days`}
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
