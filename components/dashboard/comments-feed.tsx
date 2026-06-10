"use client"

import { useState, useMemo, useEffect } from "react"
import { Instagram, ThumbsUp, ThumbsDown, Minus, ExternalLink, RefreshCw, MessageCircle, Music2, Facebook, Sparkles, Search, X, AlertTriangle, DollarSign, ShoppingCart, Swords, CircleAlert } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { type Comment, type Sentiment, type CommentPlatform, type SentimentFlag } from "@/lib/comments-data"
import { useDashboardData } from "@/contexts/dashboard-data-context"
import { type DateRange } from "@/components/dashboard/date-filter"
import { useSegmentation } from "@/components/dashboard/segmentation-filter"

// Flag display configuration. The LLM emits snake_case flags (price_complaint,
// green_line_defect, comparison_iphone, ...), so we resolve by pattern instead
// of exact key so every meaningful flag gets an icon.
const FLAG_CONFIG: Record<string, { icon: typeof AlertTriangle; label: string; color: string }> = {
  sarcasm: { icon: CircleAlert, label: "Sarcasm Detected", color: "text-amber-500" },
  competitor: { icon: Swords, label: "Competitor Mention", color: "text-red-500" },
  mixed: { icon: Minus, label: "Mixed Sentiment", color: "text-blue-500" },
  safety: { icon: AlertTriangle, label: "Safety Issue", color: "text-red-600" },
  price: { icon: DollarSign, label: "Price Complaint", color: "text-orange-500" },
  purchase: { icon: ShoppingCart, label: "Purchase Intent", color: "text-green-500" },
}

function resolveFlagConfig(flag: string): { icon: typeof AlertTriangle; label: string; color: string } | null {
  const f = flag.toLowerCase()
  if (f.includes("sarcas")) return FLAG_CONFIG.sarcasm
  if (f.includes("competitor") || f.startsWith("comparison")) return FLAG_CONFIG.competitor
  if (f.includes("safety") || f.includes("overheat") || f.includes("defect") || f.includes("green_line")) return FLAG_CONFIG.safety
  if (f.includes("price")) return FLAG_CONFIG.price
  if (f.includes("purchase") || f.includes("preorder") || f.includes("pre_order")) return FLAG_CONFIG.purchase
  if (f.includes("mixed")) return FLAG_CONFIG.mixed
  return null
}

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 text-xs font-medium capitalize",
        sentiment === "positive" && "bg-positive/10 text-positive hover:bg-positive/20",
        sentiment === "neutral" && "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20",
        sentiment === "negative" && "bg-negative/10 text-negative hover:bg-negative/20"
      )}
    >
      {sentiment === "positive" && <ThumbsUp className="h-3 w-3" />}
      {sentiment === "neutral" && <Minus className="h-3 w-3" />}
      {sentiment === "negative" && <ThumbsDown className="h-3 w-3" />}
      {sentiment}
    </Badge>
  )
}

function CommentCard({ comment }: { comment: Comment }) {
  // Truncate long comments
  const truncatedText = comment.text.length > 300 
    ? comment.text.slice(0, 300) + "..." 
    : comment.text

  const flags = comment.sentimentFlags || []

  return (
    <TooltipProvider>
      <div className={cn(
        "group rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-sm",
        comment.sentiment === "negative" && "border-negative/30 bg-negative/5",
        comment.sentiment === "positive" && "border-positive/30 bg-positive/5",
        comment.sentiment === "neutral" && "border-border/50"
      )}>
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={comment.profilePicUrl} alt={comment.username} />
            <AvatarFallback className="text-xs">
              {comment.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">@{comment.username}</span>
                {comment.platform === "instagram" ? (
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E4405F]/10">
                    <Instagram className="h-2.5 w-2.5 text-[#E4405F]" />
                  </div>
                ) : comment.platform === "tiktok" ? (
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#00f2ea]/10">
                    <Music2 className="h-2.5 w-2.5 text-[#00f2ea]" />
                  </div>
                ) : (
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1877F2]/10">
                    <Facebook className="h-2.5 w-2.5 text-[#1877F2]" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {/* Sentiment Flags */}
                {flags.length > 0 && (
                  <div className="flex items-center gap-0.5">
                    {flags.map((flag) => {
                      const config = resolveFlagConfig(String(flag))
                      if (!config) return null
                      const Icon = config.icon
                      return (
                        <Tooltip key={flag}>
                          <TooltipTrigger asChild>
                            <div className={cn("flex h-5 w-5 items-center justify-center rounded", config.color)}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {config.label}
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                )}
                <SentimentBadge sentiment={comment.sentiment} />
              </div>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {truncatedText}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <Badge variant="outline" className="text-xs font-normal">
                {comment.product}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 opacity-0 transition-opacity group-hover:opacity-100"
                asChild
              >
                <a href={comment.postUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  View Post
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

interface CommentsFeedProps {
  platformFilter?: ("instagram" | "tiktok" | "facebook")[]
  dateRange?: DateRange
}

const PAGE_SIZE = 50

export function CommentsFeed({ platformFilter, dateRange }: CommentsFeedProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | Sentiment>("all")
  const [activePlatform, setActivePlatform] = useState<"all" | "instagram" | "tiktok" | "facebook">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSearch, setActiveSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  
  // Convert platform filter to comment platform filter
  const commentPlatformFilter: CommentPlatform[] | undefined = platformFilter?.filter(
    (p): p is CommentPlatform => p === "instagram" || p === "tiktok" || p === "facebook"
  )
  const { segmentation } = useSegmentation()
  
  // Use the dashboard data context for merged static + synced data
  const { getFilteredComments, getCommentMetrics, isLoading } = useDashboardData()

  const allComments = getFilteredComments(commentPlatformFilter, dateRange, segmentation)
  const metrics = getCommentMetrics(commentPlatformFilter, dateRange, segmentation)
  
  const handleSearch = () => {
    setActiveSearch(searchQuery.trim().toLowerCase())
    setCurrentPage(1) // Reset to first page on new search
  }

  const clearSearch = () => {
    setSearchQuery("")
    setActiveSearch("")
    setCurrentPage(1)
  }

  // Live search: apply the query as the user types (debounced) so the search
  // bar works without needing to press Enter or the Search button.
  useEffect(() => {
    const handle = setTimeout(() => {
      setActiveSearch(searchQuery.trim().toLowerCase())
      setCurrentPage(1)
    }, 250)
    return () => clearTimeout(handle)
  }, [searchQuery])
  
  const handleAIAnalysis = async () => {
    setIsAnalyzing(true)
    setAnalysisStatus("Analyzing comments with AI...")
    
    try {
      const response = await fetch("/api/analyze-sentiment", { method: "POST" })
      const data = await response.json()
      
      if (data.success) {
        setAnalysisStatus(`Analysis complete! Positive: ${data.positivePercent}%, Negative: ${data.negativePercent}%, Neutral: ${data.neutralPercent}%`)
        // Reload the page to refresh data
        setTimeout(() => window.location.reload(), 2000)
      } else {
        setAnalysisStatus(`Error: ${data.error}`)
      }
    } catch (error) {
      setAnalysisStatus("Failed to analyze comments")
    } finally {
      setIsAnalyzing(false)
    }
  }
  
  // Apply search across ALL comments first so platform tab counts stay accurate,
  // then narrow by platform, then by sentiment.
  const searchedAll = useMemo(() => {
    if (!activeSearch) return allComments
    return allComments.filter(c =>
      (c.text || "").toLowerCase().includes(activeSearch) ||
      (c.username || "").toLowerCase().includes(activeSearch) ||
      (c.product || "").toLowerCase().includes(activeSearch) ||
      (c.productModel || "").toLowerCase().includes(activeSearch)
    )
  }, [allComments, activeSearch])

  const searchFiltered = useMemo(() => (
    activePlatform === "all"
      ? searchedAll
      : searchedAll.filter(c => c.platform === activePlatform)
  ), [searchedAll, activePlatform])

  // Filter by sentiment
  const filteredComments = activeTab === "all"
    ? searchFiltered
    : searchFiltered.filter(c => c.sentiment === activeTab)

  // Reset page when filters change
  const totalPages = Math.ceil(filteredComments.length / PAGE_SIZE)
  const validPage = Math.min(currentPage, totalPages || 1)
  
  // Paginate results - only render PAGE_SIZE comments at a time for performance
  const paginatedComments = useMemo(() => {
    const start = (validPage - 1) * PAGE_SIZE
    return filteredComments.slice(start, start + PAGE_SIZE)
  }, [filteredComments, validPage])
  
  const searchResultCount = activeSearch ? searchFiltered.length : null

  // Platform counts always reflect the search (but not the platform tab itself),
  // so switching platforms never zeroes out the other tabs.
  const instagramCount = searchedAll.filter(c => c.platform === "instagram").length
  const tiktokCount = searchedAll.filter(c => c.platform === "tiktok").length
  const facebookCount = searchedAll.filter(c => c.platform === "facebook").length

  // Sentiment metrics reflect the current search + platform selection.
  const displayMetrics = useMemo(() => {
    const commentsToAnalyze = searchFiltered
    const total = commentsToAnalyze.length
    const positiveCount = commentsToAnalyze.filter(c => c.sentiment === "positive").length
    const negativeCount = commentsToAnalyze.filter(c => c.sentiment === "negative").length
    const neutralCount = commentsToAnalyze.filter(c => c.sentiment === "neutral").length
    
    // Calculate percentages that always add up to 100%
    let positivePercentage = 0
    let negativePercentage = 0
    let neutralPercentage = 0
    
    if (total > 0) {
      positivePercentage = Math.floor((positiveCount / total) * 100)
      negativePercentage = Math.floor((negativeCount / total) * 100)
      neutralPercentage = 100 - positivePercentage - negativePercentage
    }
    
    return {
      totalComments: total,
      positiveCount,
      negativeCount,
      neutralCount,
      positivePercentage,
      negativePercentage,
      neutralPercentage,
    }
  }, [searchFiltered])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Comments Analysis
          </CardTitle>
          <CardDescription>
            {activeSearch
              ? `${displayMetrics.totalComments.toLocaleString()} comments matching "${activeSearch}"`
              : `${metrics.total.toLocaleString()} comments analyzed from Instagram, TikTok and Facebook`
            }
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAIAnalysis}
            disabled={isAnalyzing}
            className="gap-1.5"
          >
            <Sparkles className={cn("h-4 w-4", isAnalyzing && "animate-pulse")} />
            {isAnalyzing ? "Analyzing..." : "AI Analysis"}
          </Button>
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
        {/* Analysis Status */}
        {analysisStatus && (
          <div className={cn(
            "mb-4 p-3 rounded-lg text-sm",
            analysisStatus.includes("Error") || analysisStatus.includes("Failed") 
              ? "bg-negative/10 text-negative" 
              : "bg-primary/10 text-primary"
          )}>
            {analysisStatus}
          </div>
        )}
        
        {/* Keyword Search */}
        <div className="mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search keywords in comments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button onClick={handleSearch} className="gap-1.5">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
          {activeSearch && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Search className="h-3 w-3" />
                {`"${activeSearch}"`}
                <button onClick={clearSearch} className="ml-1 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
              <span className="text-sm text-muted-foreground">
                {searchResultCount} {searchResultCount === 1 ? "result" : "results"} found
              </span>
            </div>
          )}
        </div>
        
        {/* Platform Filter */}
        <div className="mb-4 flex gap-2">
          <Button
            variant={activePlatform === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => { setActivePlatform("all"); setCurrentPage(1); }}
            className="flex-1"
          >
            All ({searchedAll.length.toLocaleString()})
          </Button>
          <Button
            variant={activePlatform === "instagram" ? "default" : "outline"}
            size="sm"
            onClick={() => { setActivePlatform("instagram"); setCurrentPage(1); }}
            className="flex-1 gap-1.5"
          >
            <Instagram className="h-4 w-4" />
            Instagram ({instagramCount})
          </Button>
          <Button
            variant={activePlatform === "tiktok" ? "default" : "outline"}
            size="sm"
            onClick={() => { setActivePlatform("tiktok"); setCurrentPage(1); }}
            className="flex-1 gap-1.5"
          >
            <Music2 className="h-4 w-4" />
            TikTok ({tiktokCount})
          </Button>
          <Button
            variant={activePlatform === "facebook" ? "default" : "outline"}
            size="sm"
            onClick={() => { setActivePlatform("facebook"); setCurrentPage(1); }}
            className="flex-1 gap-1.5"
          >
            <Facebook className="h-4 w-4" />
            Facebook ({facebookCount})
          </Button>
        </div>

        {/* Sentiment Summary */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-positive/10 p-3 text-center">
            <p className="text-2xl font-bold text-positive">{displayMetrics.positivePercentage}%</p>
            <p className="text-xs text-muted-foreground">Positive ({displayMetrics.positiveCount})</p>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{displayMetrics.neutralPercentage}%</p>
            <p className="text-xs text-muted-foreground">Neutral ({displayMetrics.neutralCount})</p>
          </div>
          <div className="rounded-lg bg-negative/10 p-3 text-center">
            <p className="text-2xl font-bold text-negative">{displayMetrics.negativePercentage}%</p>
            <p className="text-xs text-muted-foreground">Negative ({displayMetrics.negativeCount})</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setCurrentPage(1); }} className="mb-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">
              All ({searchFiltered.length.toLocaleString()})
            </TabsTrigger>
            <TabsTrigger value="positive" className="text-positive data-[state=active]:text-positive">
              Positive ({displayMetrics.positiveCount.toLocaleString()})
            </TabsTrigger>
            <TabsTrigger value="neutral">
              Neutral ({displayMetrics.neutralCount.toLocaleString()})
            </TabsTrigger>
            <TabsTrigger value="negative" className="text-negative data-[state=active]:text-negative">
              Negative ({displayMetrics.negativeCount.toLocaleString()})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Comments List */}
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {((validPage - 1) * PAGE_SIZE) + 1}-{Math.min(validPage * PAGE_SIZE, filteredComments.length)} of {filteredComments.length.toLocaleString()} comments
          </span>
          <span>Page {validPage} of {totalPages}</span>
        </div>
        <ScrollArea className="h-[600px] pr-4">
          <div className="flex flex-col gap-3">
            {paginatedComments.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>
        </ScrollArea>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={validPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={validPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1 px-2">
              {/* Show page numbers around current page */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (validPage <= 3) {
                  pageNum = i + 1
                } else if (validPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = validPage - 2 + i
                }
                return (
                  <Button
                    key={pageNum}
                    variant={validPage === pageNum ? "default" : "ghost"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={validPage === totalPages}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={validPage === totalPages}
            >
              Last
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact version for sidebar or smaller views
interface CommentsSentimentSummaryProps {
  platformFilter?: ("instagram" | "tiktok" | "facebook")[]
  dateRange?: DateRange
}

export function CommentsSentimentSummary({ platformFilter, dateRange }: CommentsSentimentSummaryProps) {
  // Convert platform filter to comment platform filter
  const commentPlatformFilter: CommentPlatform[] | undefined = platformFilter?.filter(
    (p): p is CommentPlatform => p === "instagram" || p === "tiktok" || p === "facebook"
  )
  const { segmentation } = useSegmentation()
  const { getCommentMetrics } = useDashboardData()

  const raw = getCommentMetrics(commentPlatformFilter, dateRange, segmentation)
  const metrics = {
    positivePercentage: raw.positiveRate,
    neutralPercentage: raw.neutralRate,
    negativePercentage: raw.negativeRate,
    topIssues: Object.entries(raw.flagCounts || {})
      .map(([issue, count]) => ({ issue: issue.replace(/_/g, " "), count }))
      .sort((a, b) => b.count - a.count),
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Comment Sentiment</CardTitle>
        <CardDescription>Instagram, TikTok + Facebook analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Sentiment Bars */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-positive" />
                Positive
              </span>
              <span className="font-medium">{metrics.positivePercentage}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-positive rounded-full transition-all"
                style={{ width: `${metrics.positivePercentage}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Minus className="h-4 w-4 text-amber-500" />
                Neutral
              </span>
              <span className="font-medium">{metrics.neutralPercentage}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${metrics.neutralPercentage}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <ThumbsDown className="h-4 w-4 text-negative" />
                Negative
              </span>
              <span className="font-medium">{metrics.negativePercentage}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-negative rounded-full transition-all"
                style={{ width: `${metrics.negativePercentage}%` }}
              />
            </div>
          </div>

          {/* Top Issues */}
          {metrics.topIssues.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Top Issues Mentioned</p>
              <div className="flex flex-wrap gap-2">
                {metrics.topIssues.slice(0, 3).map(({ issue, count }) => (
                  <Badge key={issue} variant="destructive" className="text-xs">
                    {issue} ({count})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
