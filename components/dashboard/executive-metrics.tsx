"use client"

import { useMemo, useState, useCallback } from "react"
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  Users,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ChevronRight,
  Instagram,
  Music2,
  Facebook,
  Heart,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  RadialBarChart,
  RadialBar,
  Legend,
} from "recharts"
import { cn } from "@/lib/utils"
import { getProcessedDashboardData, type Platform } from "@/lib/social-data"
import { type CommentPlatform, type Comment } from "@/lib/comments-data"
import { useDashboardData } from "@/contexts/dashboard-data-context"
import { calculateBrandHealthScore } from "@/lib/brand-health"
import { type DateRange, isWithinDateRange } from "@/components/dashboard/date-filter"
import { useSegmentation } from "@/components/dashboard/segmentation-filter"

interface ExecutiveMetricsProps {
  platformFilter?: Platform[]
  dateRange?: DateRange
}

// Helper to get comment platform filter
function getCommentFilter(platformFilter?: Platform[]): CommentPlatform[] | undefined {
  return platformFilter?.filter(
    (p): p is CommentPlatform => p === "instagram" || p === "tiktok" || p === "facebook"
  )
}

// Executive KPI Card
interface ExecKPIProps {
  title: string
  value: string | number
  subtitle: string
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  icon: React.ReactNode
  status?: "success" | "warning" | "danger"
}

function ExecKPI({ title, value, subtitle, trend, trendValue, icon, status }: ExecKPIProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend && trendValue && (
                <span className={cn(
                  "flex items-center text-xs font-medium",
                  trend === "up" && "text-positive",
                  trend === "down" && "text-negative",
                  trend === "neutral" && "text-muted-foreground"
                )}>
                  {trend === "up" && <TrendingUp className="h-3 w-3 mr-0.5" />}
                  {trend === "down" && <TrendingDown className="h-3 w-3 mr-0.5" />}
                  {trendValue}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            status === "success" && "bg-positive/10 text-positive",
            status === "warning" && "bg-amber-500/10 text-amber-500",
            status === "danger" && "bg-negative/10 text-negative",
            !status && "bg-primary/10 text-primary"
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Helper to get date range for last week
function getLastWeekRange(): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now)
  to.setDate(to.getDate() - 7) // End of last week
  const from = new Date(to)
  from.setDate(from.getDate() - 7) // Start of last week (14 days ago)
  return { from, to }
}

// Executive KPIs Row
export function ExecutiveKPIs({ platformFilter, dateRange }: ExecutiveMetricsProps) {
  const commentPlatformFilter = getCommentFilter(platformFilter)
  const { segmentation } = useSegmentation()
  const { getFilteredComments, getCommentMetrics } = useDashboardData()
  
  const comments = useMemo(() => getFilteredComments(commentPlatformFilter, dateRange, segmentation), [getFilteredComments, commentPlatformFilter, dateRange, segmentation])
  const commentMetrics = useMemo(() => getCommentMetrics(commentPlatformFilter, dateRange, segmentation), [getCommentMetrics, commentPlatformFilter, dateRange, segmentation])
  const dashboardData = useMemo(() => getProcessedDashboardData(platformFilter, dateRange), [platformFilter, dateRange])
  
  // Calculate comments by product from filtered comments
  const commentsByProduct = useMemo(() => {
    const byProduct: Record<string, { total: number; positive: number; negative: number; neutral: number }> = {}
    for (const c of comments) {
      const product = c.productModel || "General"
      if (!byProduct[product]) {
        byProduct[product] = { total: 0, positive: 0, negative: 0, neutral: 0 }
      }
      byProduct[product].total++
      byProduct[product][c.sentiment]++
    }
    return byProduct
  }, [comments])
  
  // Get last week's data for comparison
  const lastWeekRange = useMemo(() => getLastWeekRange(), [])
  const lastWeekComments = useMemo(() => getFilteredComments(commentPlatformFilter, lastWeekRange, segmentation), [getFilteredComments, commentPlatformFilter, lastWeekRange, segmentation])
  const lastWeekMetrics = useMemo(() => getCommentMetrics(commentPlatformFilter, lastWeekRange, segmentation), [getCommentMetrics, commentPlatformFilter, lastWeekRange, segmentation])
  
  const brandHealthScore = useMemo(
    () => calculateBrandHealthScore(comments).score,
    [comments]
  )
  const lastWeekBrandHealth = useMemo(
    () => calculateBrandHealthScore(lastWeekComments).score,
    [lastWeekComments]
  )
  
  // Calculate week-on-week changes
  const brandHealthChange = brandHealthScore - lastWeekBrandHealth
  const sentimentRatioNow = commentMetrics.positiveRate / Math.max(commentMetrics.negativeRate, 1)
  const sentimentRatioLast = lastWeekMetrics.positiveRate / Math.max(lastWeekMetrics.negativeRate, 1)
  const sentimentChange = sentimentRatioNow - sentimentRatioLast
  
  const { topPerformer, underperformer } = useMemo(() => {
    const productPerformance = Object.entries(commentsByProduct)
      .filter(([product]) => product !== "General")
      .map(([product, data]) => {
        const total = data.positive + data.neutral + data.negative
        const positiveRate = total > 0 ? Math.round((data.positive / total) * 100) : 0
        return { product, positiveRate, ...data, total }
      })
      .sort((a, b) => b.positiveRate - a.positiveRate)
    
    return {
      topPerformer: productPerformance[0],
      underperformer: productPerformance[productPerformance.length - 1],
    }
  }, [commentsByProduct])
  
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <ExecKPI
        title="Comment Health Score"
        value={`${brandHealthScore}/100`}
        subtitle="Based on sentiment analysis"
        status={brandHealthScore >= 70 ? "success" : brandHealthScore >= 50 ? "warning" : "danger"}
        icon={<Activity className="h-5 w-5" />}
        trend={brandHealthChange > 0 ? "up" : brandHealthChange < 0 ? "down" : "neutral"}
        trendValue={`${brandHealthChange > 0 ? "+" : ""}${brandHealthChange} pts vs last week`}
      />
      <ExecKPI
        title="Comments Analyzed"
        value={commentMetrics.total.toLocaleString()}
        subtitle="From selected platforms"
        icon={<BarChart3 className="h-5 w-5" />}
      />
      <ExecKPI
        title="Sentiment Ratio"
        value={`${sentimentRatioNow.toFixed(1)}:1`}
        subtitle="Positive to negative"
        status={commentMetrics.positiveRate > commentMetrics.negativeRate * 2 ? "success" : "warning"}
        icon={<Target className="h-5 w-5" />}
        trend={sentimentChange > 0.1 ? "up" : sentimentChange < -0.1 ? "down" : "neutral"}
        trendValue={`${sentimentChange > 0 ? "+" : ""}${sentimentChange.toFixed(1)} vs last week`}
      />
      <ExecKPI
        title="Total Reach"
        value={dashboardData.kpiMetrics.totalViews > 0 
          ? `${(dashboardData.kpiMetrics.totalViews / 1000).toFixed(0)}K` 
          : `${((dashboardData.kpiMetrics.totalLikes * 10) / 1000).toFixed(0)}K`}
        subtitle="Estimated impressions"
        icon={<Users className="h-5 w-5" />}
      />
    </div>
  )
}

// Main KPIs — Top-level metrics shown at the very top of the dashboard
export function MainKPIs({ platformFilter, dateRange }: ExecutiveMetricsProps) {
  const commentPlatformFilter = getCommentFilter(platformFilter)
  const { segmentation } = useSegmentation()
  const { getFilteredComments, getCommentMetrics, getFilteredPosts } = useDashboardData()
  
  const comments = useMemo(() => getFilteredComments(commentPlatformFilter, dateRange, segmentation), [getFilteredComments, commentPlatformFilter, dateRange, segmentation])
  const commentMetrics = useMemo(() => getCommentMetrics(commentPlatformFilter, dateRange, segmentation), [getCommentMetrics, commentPlatformFilter, dateRange, segmentation])
  const totalPosts = useMemo(() => getFilteredPosts(commentPlatformFilter, dateRange).length, [getFilteredPosts, commentPlatformFilter, dateRange])
  
  // Calculate Comment Health Index
  const commentHealthScore = useMemo(() => calculateBrandHealthScore(comments).score, [comments])
  
  // Calculate platform split
  const instagramCount = comments.filter(c => c.platform === "instagram").length
  const tiktokCount = comments.filter(c => c.platform === "tiktok").length
  const facebookCount = comments.filter(c => c.platform === "facebook").length
  const total = commentMetrics.total
  
  const instagramPct = total > 0 ? Math.round((instagramCount / total) * 100) : 0
  const tiktokPct = total > 0 ? Math.round((tiktokCount / total) * 100) : 0
  const facebookPct = total > 0 ? Math.round((facebookCount / total) * 100) : 0
  
  // Positive to Negative ratio
  const posToNegRatio = commentMetrics.negative > 0 
    ? (commentMetrics.positive / commentMetrics.negative).toFixed(1)
    : "∞"

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* Comment Health Index */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Health Index</p>
              <p className={cn(
                "text-3xl font-bold",
                commentHealthScore >= 70 ? "text-positive" : commentHealthScore >= 50 ? "text-amber-500" : "text-negative"
              )}>{commentHealthScore}/100</p>
              <p className="text-xs text-muted-foreground">overall comment sentiment</p>
            </div>
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              commentHealthScore >= 70 ? "bg-positive/10" : commentHealthScore >= 50 ? "bg-amber-500/10" : "bg-negative/10"
            )}>
              <Activity className={cn(
                "h-5 w-5",
                commentHealthScore >= 70 ? "text-positive" : commentHealthScore >= 50 ? "text-amber-500" : "text-negative"
              )} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Posts */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Posts</p>
              <p className="text-3xl font-bold">{totalPosts.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">across all platforms</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <PieChartIcon className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Number of Comments */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Comments</p>
              <p className="text-3xl font-bold">{total.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">analyzed from all platforms</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Split */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Platform Split</p>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="bg-[#E4405F]" style={{ width: `${instagramPct}%` }} title={`Instagram: ${instagramPct}%`} />
              <div className="bg-[#00f2ea]" style={{ width: `${tiktokPct}%` }} title={`TikTok: ${tiktokPct}%`} />
              <div className="bg-[#1877F2]" style={{ width: `${facebookPct}%` }} title={`Facebook: ${facebookPct}%`} />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[#E4405F]" />
                IG {instagramPct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[#00f2ea]" />
                TT {tiktokPct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[#1877F2]" />
                FB {facebookPct}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Positive to Negative Ratio */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pos:Neg Ratio</p>
              <p className="text-3xl font-bold">{posToNegRatio}:1</p>
              <p className="text-xs text-muted-foreground">
                {commentMetrics.positive.toLocaleString()} pos / {commentMetrics.negative.toLocaleString()} neg
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Target className="h-5 w-5 text-amber-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Comment Health Gauge — uses weighted linear regression model
export function BrandHealthGauge({ platformFilter, dateRange }: ExecutiveMetricsProps) {
  const commentPlatformFilter = getCommentFilter(platformFilter)
  const { segmentation } = useSegmentation()
  const { getFilteredComments } = useDashboardData()
  const comments = useMemo(
    () => getFilteredComments(commentPlatformFilter, dateRange, segmentation),
    [getFilteredComments, commentPlatformFilter, dateRange, segmentation]
  )

  const brandHealth = useMemo(() => calculateBrandHealthScore(comments), [comments])
  const brandHealthScore = brandHealth.score

  const gaugeData = [
    {
      name: "Score",
      value: brandHealthScore,
      fill:
        brandHealthScore >= 70
          ? "oklch(0.65 0.18 150)"
          : brandHealthScore >= 50
          ? "oklch(0.7 0.15 85)"
          : "oklch(0.6 0.2 30)",
    },
  ]

  // Top 5 contributing products (by share of weighted score)
  const topContributors = brandHealth.topContributors.slice(0, 5)

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Comment Health Index</CardTitle>
        <CardDescription>
          Weighted by department strategy (MX 70% / VD 20% / HA 10%) and statistical confidence
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col items-center">
          <div className="relative h-[180px] w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="100%"
                barSize={20}
                data={gaugeData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar
                  background={{ fill: "oklch(0.9 0 0)" }}
                  dataKey="value"
                  cornerRadius={10}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold">{brandHealthScore}</span>
              <span className="text-xs text-muted-foreground">out of 100</span>
            </div>
          </div>

          <p className="mt-1 text-xs font-medium text-muted-foreground tabular-nums">
            {"± "}{brandHealth.margin} margin of error
          </p>

          <div className="mt-4 grid w-full grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-negative/10 p-2">
              <p className="font-semibold text-negative">0-49</p>
              <p className="text-muted-foreground">At Risk</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-2">
              <p className="font-semibold text-amber-600">50-69</p>
              <p className="text-muted-foreground">Moderate</p>
            </div>
            <div className="rounded-lg bg-positive/10 p-2">
              <p className="font-semibold text-positive">70-100</p>
              <p className="text-muted-foreground">Healthy</p>
            </div>
          </div>

          {/* Top contributors — shows which products are driving the score */}
          {topContributors.length > 0 && (
            <div className="mt-5 w-full">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">Top Score Drivers</p>
                <p className="text-[10px] text-muted-foreground">{brandHealth.productCount} products</p>
              </div>
              <div className="space-y-2">
                {topContributors.map((c) => {
                  const sentimentColor =
                    c.sentimentScore >= 70
                      ? "text-positive"
                      : c.sentimentScore >= 50
                      ? "text-amber-600"
                      : "text-negative"
                  return (
                    <div key={c.product} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate font-medium">{c.product}</span>
                        <span className={cn("font-semibold tabular-nums", sentimentColor)}>
                          {Math.round(c.sentimentScore)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, c.contributionShare)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-[10px] tabular-nums text-muted-foreground">
                          {c.contributionShare.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                {"Score = Σ(βᵢ · cᵢ · Sᵢ) / Σ(βᵢ · cᵢ), where βᵢ is strategic weight (MX 70% / VD 20% / HA 10%, split by volume), cᵢ is statistical confidence, Sᵢ is sentiment score."}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Critical Alerts Card
export function CriticalAlerts({ platformFilter, dateRange }: ExecutiveMetricsProps) {
  const commentPlatformFilter = getCommentFilter(platformFilter)
  const { segmentation } = useSegmentation()
  const { getFilteredComments, getCommentMetrics } = useDashboardData()
  
  const comments = useMemo(() => getFilteredComments(commentPlatformFilter, dateRange, segmentation), [getFilteredComments, commentPlatformFilter, dateRange, segmentation])
  const commentMetrics = useMemo(() => getCommentMetrics(commentPlatformFilter, dateRange, segmentation), [getCommentMetrics, commentPlatformFilter, dateRange, segmentation])

  // Metrics for the equal-length window immediately before the selected range,
  // so insights can report momentum ("negative up 6pts vs the prior period").
  const prevMetrics = useMemo(() => {
    if (!dateRange) return null
    const len = dateRange.to.getTime() - dateRange.from.getTime()
    if (len <= 0) return null
    const prevRange = {
      from: new Date(dateRange.from.getTime() - len),
      to: new Date(dateRange.from.getTime() - 1),
      label: "previous period",
    }
    const m = getCommentMetrics(commentPlatformFilter, prevRange, segmentation)
    // Require a meaningful sample before trusting the comparison.
    return m.total >= 50 ? m : null
  }, [getCommentMetrics, commentPlatformFilter, dateRange, segmentation])

  // Calculate commentsByProduct from comments
  const commentsByProduct = useMemo(() => {
    const byProduct: Record<string, { total: number; positive: number; negative: number; neutral: number }> = {}
    for (const c of comments) {
      const product = c.productModel || "General"
      if (!byProduct[product]) byProduct[product] = { total: 0, positive: 0, negative: 0, neutral: 0 }
      byProduct[product].total++
      byProduct[product][c.sentiment]++
    }
    return byProduct
  }, [comments])
  
  const brandHealthScore = useMemo(() => calculateBrandHealthScore(comments).score, [comments])

  // Derive recurring themes from the LLM-generated flags.
  // Issues come from negative comments, praise from positive comments.
  const { topIssues, topPraise } = useMemo(() => {
    const issueCounts: Record<string, number> = {}
    const praiseCounts: Record<string, number> = {}

    // Generic/structural flags that aren't actionable themes on their own.
    const GENERIC_FLAGS = new Set([
      "praise", "hype", "question", "spam", "off_topic", "positive", "negative", "neutral", "general",
    ])

    const humanize = (flag: string) =>
      flag
        .replace(/_/g, " ")
        .replace(/\bcomparison\b/i, "vs")
        .replace(/\b\w/g, (m) => m.toUpperCase())

    for (const c of comments) {
      const flags = c.sentimentFlags || []
      for (const raw of flags) {
        const flag = raw.toLowerCase().trim()
        if (!flag || GENERIC_FLAGS.has(flag)) continue
        if (c.sentiment === "negative") {
          issueCounts[flag] = (issueCounts[flag] || 0) + 1
        } else if (c.sentiment === "positive") {
          praiseCounts[flag] = (praiseCounts[flag] || 0) + 1
        }
      }
    }

    const toSorted = (counts: Record<string, number>) =>
      Object.entries(counts)
        .map(([flag, count]) => ({ flag, label: humanize(flag), count }))
        .sort((a, b) => b.count - a.count)

    return {
      topIssues: toSorted(issueCounts).map((i) => ({ issue: i.label, flag: i.flag, count: i.count })),
      topPraise: toSorted(praiseCounts).map((p) => ({ praise: p.label, flag: p.flag, count: p.count })),
    }
  }, [comments])
  
  // State for dialog
  const [selectedAlert, setSelectedAlert] = useState<{ title: string; message: string; comments: Comment[] } | null>(null)
  
  // Function to get related comments for an alert - returns max 200 unique, relevant comments
  const getRelatedComments = useCallback((alertType: string, alertData?: string): Comment[] => {
    let filtered: Comment[] = []
    
    switch (alertType) {
      case "negative_sentiment":
        filtered = comments.filter(c => c.sentiment === "negative")
        break
      case "positive_sentiment":
        filtered = comments.filter(c => c.sentiment === "positive")
        break
      case "neutral_opportunity":
        filtered = comments.filter(c => c.sentiment === "neutral")
        break
      case "issue":
        // Issues are complaints - show NEGATIVE comments carrying this flag/theme
        if (alertData) {
          const flagLower = alertData.toLowerCase()
          filtered = comments.filter(c =>
            c.sentiment === "negative" && (c.sentimentFlags || []).some(f => f.toLowerCase() === flagLower)
          )
        }
        break
      case "praise":
        // Praise - show POSITIVE comments carrying this flag/theme
        if (alertData) {
          const flagLower = alertData.toLowerCase()
          filtered = comments.filter(c =>
            c.sentiment === "positive" && (c.sentimentFlags || []).some(f => f.toLowerCase() === flagLower)
          )
        }
        break
      case "product_underperforming":
        if (alertData) {
          const productLower = alertData.toLowerCase()
          // Show negative and neutral comments for underperforming products
          filtered = comments.filter(c => {
            const matchesProduct = c.productModel?.toLowerCase().includes(productLower) || 
                    c.productCategory?.toLowerCase().includes(productLower)
            return matchesProduct && (c.sentiment === "negative" || c.sentiment === "neutral")
          })
        }
        break
      case "product_leading":
        if (alertData) {
          const productLower = alertData.toLowerCase()
          filtered = comments.filter(c => {
            const matchesProduct = c.productModel?.toLowerCase().includes(productLower) || 
                    c.productCategory?.toLowerCase().includes(productLower)
            return matchesProduct && c.sentiment === "positive"
          })
        }
        break
      case "most_discussed":
        if (alertData) {
          const productLower = alertData.toLowerCase()
          filtered = comments.filter(c => 
            c.productModel?.toLowerCase().includes(productLower) || 
            c.productCategory?.toLowerCase().includes(productLower)
          )
        }
        break
      case "volume_insight":
        // Show a mix of all sentiments for volume insight
        const positive = comments.filter(c => c.sentiment === "positive").slice(0, 70)
        const negative = comments.filter(c => c.sentiment === "negative").slice(0, 70)
        const neutral = comments.filter(c => c.sentiment === "neutral").slice(0, 60)
        filtered = [...positive, ...negative, ...neutral]
        break
      case "health_score":
        // Representative sample for the health score: the most visible comments
        // (highest engagement) across all sentiments.
        filtered = [...comments].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 200)
        break
      default:
        filtered = []
    }
    
    // Remove duplicates by comment text (normalized)
    const seen = new Set<string>()
    const unique = filtered.filter(c => {
      const normalized = c.text.toLowerCase().trim()
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
    
    // Sort by relevance: matching sentiment first, then by ENGAGEMENT (these are
    // the comments stakeholders' audiences actually saw), then by recency.
    const byImpact = (a: Comment, b: Comment) =>
      (b.likes || 0) - (a.likes || 0) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

    if (alertType === "negative_sentiment" || alertType === "issue" || alertType === "product_underperforming") {
      unique.sort((a, b) => {
        if (a.sentiment === "negative" && b.sentiment !== "negative") return -1
        if (b.sentiment === "negative" && a.sentiment !== "negative") return 1
        return byImpact(a, b)
      })
    } else if (alertType === "positive_sentiment" || alertType === "praise" || alertType === "product_leading") {
      unique.sort((a, b) => {
        if (a.sentiment === "positive" && b.sentiment !== "positive") return -1
        if (b.sentiment === "positive" && a.sentiment !== "positive") return 1
        return byImpact(a, b)
      })
    } else {
      unique.sort(byImpact)
    }
    
    // Return max 200 comments
    return unique.slice(0, 200)
  }, [comments])
  
  const alerts = useMemo(() => {
    const alertList: { type: string; title: string; message: string; icon: React.ReactNode; alertType: string; alertData?: string }[] = []

    const totalComments = commentMetrics.total

    // Not enough data to surface reliable insights.
    if (totalComments < 20) {
      return alertList
    }

    // Significance is driven by SHARE OF TOTAL VOLUME, not raw counts, so a
    // handful of negative comments about a niche product never becomes an alert.
    // A topic must represent a logical percentage of the whole conversation.
    const PRODUCT_SIGNIFICANT_SHARE = 0.05 // product must be >=5% of all comments
    const ISSUE_SIGNIFICANT_SHARE = 0.03 // an issue must be >=3% of all comments
    const PRAISE_SIGNIFICANT_SHARE = 0.03
    // Absolute floors guard against tiny datasets where percentages are noisy.
    const MIN_ABS_PRODUCT = 25
    const MIN_ABS_THEME = 12

    const issueShareFloor = Math.max(MIN_ABS_THEME, Math.ceil(totalComments * ISSUE_SIGNIFICANT_SHARE))
    const praiseShareFloor = Math.max(MIN_ABS_THEME, Math.ceil(totalComments * PRAISE_SIGNIFICANT_SHARE))
    const productFloor = Math.max(MIN_ABS_PRODUCT, Math.ceil(totalComments * PRODUCT_SIGNIFICANT_SHARE))

    const productPerformance = Object.entries(commentsByProduct)
      .filter(([product]) => product !== "General")
      .map(([product, data]) => {
        const total = data.positive + data.neutral + data.negative
        const positiveRate = total > 0 ? Math.round((data.positive / total) * 100) : 0
        const negativeRate = total > 0 ? Math.round((data.negative / total) * 100) : 0
        const neutralRate = total > 0 ? Math.round((data.neutral / total) * 100) : 0
        const shareOfTotal = totalComments > 0 ? Math.round((total / totalComments) * 100) : 0
        return { product, positiveRate, negativeRate, neutralRate, shareOfTotal, ...data, total }
      })
      // Only products that make up a logical share of the conversation qualify.
      .filter(p => p.total >= productFloor)
      .sort((a, b) => b.positiveRate - a.positiveRate)

    const topPerformer = productPerformance[0]
    const underperformer = productPerformance[productPerformance.length - 1]

    // 1. Comment Health Score - always show (actionable framing)
    alertList.push({
      type: brandHealthScore >= 70 ? "success" : brandHealthScore >= 50 ? "warning" : "danger",
      title: `Comment Health: ${brandHealthScore}/100`,
      message: brandHealthScore >= 70
        ? "Sentiment is healthy - keep current content cadence and double down on what's resonating"
        : brandHealthScore >= 50
          ? "Mixed sentiment - prioritize the top negative themes below to lift the score"
          : "Sentiment is at risk - escalate the leading complaints below to the relevant teams now",
      icon: <Activity className="h-4 w-4" />,
      alertType: "health_score"
    })

    // 2. Momentum vs the previous equal-length period - the single most useful
    // stakeholder signal: is sentiment getting better or worse right now?
    if (prevMetrics) {
      const negDelta = commentMetrics.negativeRate - prevMetrics.negativeRate
      const posDelta = commentMetrics.positiveRate - prevMetrics.positiveRate
      if (negDelta >= 5) {
        alertList.push({
          type: negDelta >= 10 ? "danger" : "warning",
          title: `Negative Sentiment Rising (+${negDelta}pts)`,
          message: `Negative share moved from ${prevMetrics.negativeRate}% to ${commentMetrics.negativeRate}% vs the previous period - review the examples to identify what changed and respond before it compounds`,
          icon: <TrendingDown className="h-4 w-4" />,
          alertType: "negative_sentiment"
        })
      } else if (posDelta >= 5) {
        alertList.push({
          type: "success",
          title: `Positive Sentiment Climbing (+${posDelta}pts)`,
          message: `Positive share moved from ${prevMetrics.positiveRate}% to ${commentMetrics.positiveRate}% vs the previous period - identify the content driving this and repeat it`,
          icon: <TrendingUp className="h-4 w-4" />,
          alertType: "positive_sentiment"
        })
      }
    }

    // 3. Negative sentiment is the most actionable overall signal - only flag when elevated.
    if (commentMetrics.negativeRate >= 25) {
      alertList.push({
        type: commentMetrics.negativeRate >= 40 ? "danger" : "warning",
        title: `${commentMetrics.negativeRate}% Negative Sentiment`,
        message: `Negativity is above a healthy range - review the leading complaints and prepare a response for the most affected products`,
        icon: <AlertTriangle className="h-4 w-4" />,
        alertType: "negative_sentiment"
      })
    }

    // 3. Top Issue/Complaint - must be a logical share of ALL comments, not just a few.
    if (topIssues.length > 0) {
      const topIssue = topIssues[0]
      if (topIssue.count >= issueShareFloor) {
        const share = Math.round((topIssue.count / totalComments) * 100)
        alertList.push({
          type: "danger",
          title: `Top Complaint: "${topIssue.issue}"`,
          message: `Raised in ${topIssue.count.toLocaleString()} comments (${share}% of all feedback) - brief the product and support teams and publish a response`,
          icon: <AlertTriangle className="h-4 w-4" />,
          alertType: "issue",
          alertData: topIssue.flag
        })
      }
    }

    // 4. Second Top Issue (only if it also clears the share floor)
    if (topIssues.length > 1) {
      const secondIssue = topIssues[1]
      if (secondIssue.count >= issueShareFloor) {
        const share = Math.round((secondIssue.count / totalComments) * 100)
        alertList.push({
          type: "warning",
          title: `Emerging Complaint: "${secondIssue.issue}"`,
          message: `Mentioned in ${secondIssue.count.toLocaleString()} comments (${share}%) - monitor and address before it escalates`,
          icon: <BarChart3 className="h-4 w-4" />,
          alertType: "issue",
          alertData: secondIssue.flag
        })
      }
    }

    // 5. Product Needing Attention - significant product with elevated negativity.
    if (underperformer && underperformer !== topPerformer && underperformer.negativeRate >= 25) {
      alertList.push({
        type: "warning",
        title: `${underperformer.product} Needs Attention`,
        message: `${underperformer.negativeRate}% of its ${underperformer.total.toLocaleString()} comments (${underperformer.shareOfTotal}% of total) are negative - investigate the recurring complaints and coordinate messaging`,
        icon: <AlertTriangle className="h-4 w-4" />,
        alertType: "product_underperforming",
        alertData: underperformer.product
      })
    }

    // 6. Top Performing Product - a clear marketing opportunity.
    if (topPerformer && topPerformer.positiveRate >= 55) {
      alertList.push({
        type: "success",
        title: `${topPerformer.product} Is Resonating`,
        message: `${topPerformer.positiveRate}% positive across ${topPerformer.total.toLocaleString()} comments - amplify this product in upcoming campaigns and creator partnerships`,
        icon: <TrendingUp className="h-4 w-4" />,
        alertType: "product_leading",
        alertData: topPerformer.product
      })
    }

    // 7. Top Praise theme - must clear the share floor to be a real signal.
    if (topPraise.length > 0) {
      const praise = topPraise[0]
      if (praise.count >= praiseShareFloor) {
        const share = Math.round((praise.count / totalComments) * 100)
        alertList.push({
          type: "success",
          title: `Customers Love: "${praise.praise}"`,
          message: `Highlighted in ${praise.count.toLocaleString()} comments (${share}%) - feature this strength in product messaging and ads`,
          icon: <CheckCircle2 className="h-4 w-4" />,
          alertType: "praise",
          alertData: praise.flag
        })
      }
    }

    // 8. High Neutral Sentiment - a conversion opportunity when it dominates.
    if (commentMetrics.neutralRate >= 45) {
      alertList.push({
        type: "info",
        title: `${commentMetrics.neutralRate}% Neutral - Conversion Opportunity`,
        message: `Most comments are neutral - sharpen calls-to-action and respond to questions to move undecided audiences toward positive intent`,
        icon: <Target className="h-4 w-4" />,
        alertType: "neutral_opportunity"
      })
    }

    return alertList
  }, [commentMetrics, prevMetrics, commentsByProduct, brandHealthScore, topIssues, topPraise])

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Alerts & Insights
        </CardTitle>
        <CardDescription>Key items requiring attention</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No critical alerts at this time</p>
          ) : (
            alerts.map((alert, idx) => {
              const hasDetails = true
              return (
                <button
                  key={idx}
                  onClick={() => {
                    const relatedComments = getRelatedComments(alert.alertType, alert.alertData)
                    setSelectedAlert({ title: alert.title, message: alert.message, comments: relatedComments })
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-all",
                    alert.type === "danger" && "bg-negative/10",
                    alert.type === "warning" && "bg-amber-500/10",
                    alert.type === "success" && "bg-positive/10",
                    alert.type === "info" && "bg-primary/10",
                    hasDetails && "cursor-pointer hover:ring-2 hover:ring-primary/20"
                  )}
                >
                  <div className={cn(
                    "mt-0.5",
                    alert.type === "danger" && "text-negative",
                    alert.type === "warning" && "text-amber-600",
                    alert.type === "success" && "text-positive",
                    alert.type === "info" && "text-primary"
                  )}>
                    {alert.icon}
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      "text-sm font-medium",
                      alert.type === "danger" && "text-negative",
                      alert.type === "warning" && "text-amber-600",
                      alert.type === "success" && "text-positive",
                      alert.type === "info" && "text-primary"
                    )}>
                      {alert.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                  </div>
                  {hasDetails && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </CardContent>
      
      {/* Dialog for showing related comments */}
      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedAlert?.title}</DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block">{selectedAlert?.message}</span>
              <span className="block text-xs">
                {selectedAlert?.comments.length.toLocaleString()} example comments, highest-engagement first
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {selectedAlert?.comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">No comments found for this insight</p>
              </div>
            ) : null}
            {selectedAlert?.comments.slice(0, 200).map((comment, idx) => (
              <div key={idx} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full",
                    comment.platform === "instagram" && "bg-[#E4405F]/10",
                    comment.platform === "tiktok" && "bg-[#00f2ea]/10",
                    comment.platform === "facebook" && "bg-[#1877F2]/10"
                  )}>
                    {comment.platform === "instagram" ? (
                      <Instagram className="h-3 w-3 text-[#E4405F]" />
                    ) : comment.platform === "tiktok" ? (
                      <Music2 className="h-3 w-3 text-[#00f2ea]" />
                    ) : (
                      <Facebook className="h-3 w-3 text-[#1877F2]" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{comment.username}</span>
                  <div className={cn(
                    "ml-auto flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-medium",
                    comment.sentiment === "positive" && "bg-positive/10 text-positive",
                    comment.sentiment === "negative" && "bg-negative/10 text-negative",
                    comment.sentiment === "neutral" && "bg-muted text-muted-foreground"
                  )}>
                    {comment.sentiment === "positive" ? (
                      <ThumbsUp className="h-3 w-3" />
                    ) : comment.sentiment === "negative" ? (
                      <ThumbsDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {comment.sentiment}
                  </div>
                </div>
                <p className="text-sm">{comment.text}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  {comment.createdAt && (
                    <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                  )}
                  {(comment.likes || 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {comment.likes.toLocaleString()}
                    </span>
                  )}
                  {comment.product && comment.product !== "General" && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                      {comment.product}
                    </Badge>
                  )}
                  {comment.postUrl && (
                    <a
                      href={comment.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View post
                    </a>
                  )}
                </div>
              </div>
            ))}
            {selectedAlert && selectedAlert.comments.length > 200 && (
              <p className="text-center text-xs text-muted-foreground py-2">
                Showing 200 of {selectedAlert.comments.length} comments
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// Topic keywords for extraction
const TOPIC_KEYWORDS: Record<string, string[]> = {
  "Camera": ["camera", "photo", "photography", "nightography", "zoom", "lens", "portrait", "selfie", "video recording", "picture"],
  "Battery": ["battery", "charging", "charge", "power", "battery life", "fast charging", "wireless charging"],
  "Display": ["display", "screen", "amoled", "oled", "brightness", "refresh rate", "resolution", "hdr"],
  "Performance": ["fast", "speed", "performance", "lag", "smooth", "processor", "snapdragon", "ram", "gaming"],
  "Design": ["design", "look", "beautiful", "premium", "build", "color", "slim", "lightweight", "glass", "titanium"],
  "Price": ["price", "expensive", "cheap", "value", "worth", "cost", "affordable", "overpriced"],
  "Software": ["software", "update", "one ui", "android", "bug", "feature", "ai", "galaxy ai"],
  "Audio": ["sound", "audio", "speaker", "music", "bass", "dolby", "buds"],
  "Durability": ["durable", "sturdy", "drop", "scratch", "water", "ip68", "gorilla glass"],
  "Connectivity": ["5g", "wifi", "bluetooth", "signal", "network", "connectivity"],
}

function extractTopics(comments: { text: string; sentiment: string }[]): { topic: string; positive: number; negative: number; neutral: number; total: number; score: number }[] {
  const topicStats: Record<string, { positive: number; negative: number; neutral: number }> = {}
  
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    topicStats[topic] = { positive: 0, negative: 0, neutral: 0 }
  }
  
  for (const comment of comments) {
    const textLower = comment.text.toLowerCase()
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some(kw => textLower.includes(kw))) {
        if (comment.sentiment === "positive") topicStats[topic].positive++
        else if (comment.sentiment === "negative") topicStats[topic].negative++
        else topicStats[topic].neutral++
      }
    }
  }
  
  return Object.entries(topicStats)
    .map(([topic, stats]) => {
      const total = stats.positive + stats.negative + stats.neutral
      const score = total > 0 ? Math.round(((stats.positive - stats.negative) / total) * 100) : 0
      return { topic, ...stats, total, score }
    })
    .filter(t => t.total > 0)
    .sort((a, b) => b.total - a.total)
}

// Product Performance with Topic Analysis
export function ProductPerformanceChart({ platformFilter }: ExecutiveMetricsProps) {
  const commentPlatformFilter = getCommentFilter(platformFilter)
  const { segmentation } = useSegmentation()
  const { getFilteredComments } = useDashboardData()
  
  // Product order: latest products first, grouped by product line
  const PRODUCT_ORDER = [
    // S26 Line (2026 - latest)
    "S26 Ultra", "S26+", "S26",
    // Z Fold/Flip 7 (2026)
    "Z Fold 7", "Z Flip 7",
    // Galaxy Buds 4 (2026)
    "Galaxy Buds 4 Pro", "Galaxy Buds 4",
    // S25 Line (2025)
    "S25 Ultra", "S25+", "S25",
    // Z Fold/Flip 6 (2025)
    "Z Fold 6", "Z Flip 6",
    // Galaxy Watch
    "Galaxy Watch 7", "Galaxy Watch Ultra", "Galaxy Watch 6",
    // Tablets
    "Galaxy Tab S10", "Galaxy Tab S9",
    // Home Appliances
    "Bespoke AI", "Bespoke Refrigerator", "Bespoke Washer",
    // TVs
    "Neo QLED", "OLED TV", "Frame TV",
  ]
  
  // Get all products for selection - calculate from filtered comments
  const commentsByProduct = useMemo(() => {
    const allComments = getFilteredComments(commentPlatformFilter, undefined, segmentation)
    const byProduct: Record<string, { total: number; positive: number; negative: number; neutral: number }> = {}
    for (const c of allComments) {
      const product = c.productModel || "General"
      if (!byProduct[product]) byProduct[product] = { total: 0, positive: 0, negative: 0, neutral: 0 }
      byProduct[product].total++
      byProduct[product][c.sentiment]++
    }
    return byProduct
  }, [getFilteredComments, commentPlatformFilter, segmentation])
  const availableProducts = useMemo(() => {
    const products = Object.entries(commentsByProduct)
      .filter(([product]) => product !== "General" && product !== "Unknown")
      .map(([product, data]) => ({ product, total: data.positive + data.negative + data.neutral }))
      .filter(p => p.total >= 10)
    
    // Sort by predefined order, then alphabetically for unlisted products
    return products.sort((a, b) => {
      const indexA = PRODUCT_ORDER.findIndex(p => a.product.includes(p) || p.includes(a.product))
      const indexB = PRODUCT_ORDER.findIndex(p => b.product.includes(p) || p.includes(b.product))
      
      // Both in order list - sort by order
      if (indexA !== -1 && indexB !== -1) return indexA - indexB
      // Only A in order list - A comes first
      if (indexA !== -1) return -1
      // Only B in order list - B comes first
      if (indexB !== -1) return 1
      // Neither in list - sort alphabetically
      return a.product.localeCompare(b.product)
    })
  }, [commentsByProduct])
  
  // Local state for product selection and date range
  const [selectedProduct, setSelectedProduct] = useState<string>("all")
  const [localDateRange, setLocalDateRange] = useState<"7" | "30" | "90" | "all">("all")
  
  // Calculate date range based on selection
  const effectiveDateRange = useMemo(() => {
    if (localDateRange === "all") return undefined
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - parseInt(localDateRange))
    return { from, to: now }
  }, [localDateRange])
  
  // Get comments for selected product - comments have a .product field directly
  const productComments = useMemo(() => {
    const allComments = getFilteredComments(commentPlatformFilter, effectiveDateRange, segmentation)
    if (selectedProduct === "all") return allComments
    return allComments.filter(c => c.product === selectedProduct || c.productModel === selectedProduct)
  }, [getFilteredComments, selectedProduct, commentPlatformFilter, effectiveDateRange, segmentation])
  
  // Calculate sentiment breakdown
  const sentimentBreakdown = useMemo(() => {
    const positive = productComments.filter(c => c.sentiment === "positive").length
    const negative = productComments.filter(c => c.sentiment === "negative").length
    const neutral = productComments.filter(c => c.sentiment === "neutral").length
    const total = productComments.length
    return {
      positive,
      negative,
      neutral,
      total,
      positiveRate: total > 0 ? Math.round((positive / total) * 100) : 0,
      negativeRate: total > 0 ? Math.round((negative / total) * 100) : 0,
      neutralRate: total > 0 ? Math.round((neutral / total) * 100) : 0,
    }
  }, [productComments])
  
  // Extract topics
  const topics = useMemo(() => 
    extractTopics(productComments.map(c => ({ text: c.text, sentiment: c.sentiment }))),
    [productComments]
  )
  
  const topPraised = topics.filter(t => t.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)
  const leastPraised = topics.filter(t => t.score <= 0).sort((a, b) => a.score - b.score).slice(0, 3)

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Product Performance</CardTitle>
            <CardDescription>Sentiment analysis and topic breakdown</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {availableProducts.map(p => (
                  <SelectItem key={p.product} value={p.product}>
                    {p.product} ({p.total})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={localDateRange} onValueChange={(v) => setLocalDateRange(v as typeof localDateRange)}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Sentiment Overview */}
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-positive/10 p-3">
            <p className="text-2xl font-bold text-positive">{sentimentBreakdown.positiveRate}%</p>
            <p className="text-xs text-muted-foreground">Positive ({sentimentBreakdown.positive})</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-2xl font-bold text-muted-foreground">{sentimentBreakdown.neutralRate}%</p>
            <p className="text-xs text-muted-foreground">Neutral ({sentimentBreakdown.neutral})</p>
          </div>
          <div className="rounded-lg bg-negative/10 p-3">
            <p className="text-2xl font-bold text-negative">{sentimentBreakdown.negativeRate}%</p>
            <p className="text-xs text-muted-foreground">Negative ({sentimentBreakdown.negative})</p>
          </div>
        </div>
        
        {/* Sentiment Progress Bar */}
        <div className="mb-6 flex h-3 overflow-hidden rounded-full">
          <div className="bg-positive" style={{ width: `${sentimentBreakdown.positiveRate}%` }} />
          <div className="bg-muted-foreground/30" style={{ width: `${sentimentBreakdown.neutralRate}%` }} />
          <div className="bg-negative" style={{ width: `${sentimentBreakdown.negativeRate}%` }} />
        </div>
        
        {/* Topics Analysis */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Top Praised Topics */}
          <div>
            <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-positive">
              <ThumbsUp className="h-4 w-4" />
              Top Praised Topics
            </h4>
            <div className="space-y-2">
              {topPraised.length > 0 ? topPraised.map(topic => (
                <div key={topic.topic} className="flex items-center justify-between rounded-md bg-positive/5 px-3 py-2">
                  <span className="text-sm font-medium">{topic.topic}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{topic.total} mentions</span>
                    <Badge variant="outline" className="border-positive text-positive text-xs">
                      +{topic.score}%
                    </Badge>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground">No praised topics found</p>
              )}
            </div>
          </div>
          
          {/* Least Praised Topics */}
          <div>
            <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-negative">
              <ThumbsDown className="h-4 w-4" />
              Least Praised Topics
            </h4>
            <div className="space-y-2">
              {leastPraised.length > 0 ? leastPraised.map(topic => (
                <div key={topic.topic} className="flex items-center justify-between rounded-md bg-negative/5 px-3 py-2">
                  <span className="text-sm font-medium">{topic.topic}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{topic.total} mentions</span>
                    <Badge variant="outline" className="border-negative text-negative text-xs">
                      {topic.score}%
                    </Badge>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground">No negative topics found</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Total comments footer */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Based on {sentimentBreakdown.total.toLocaleString()} comments for {selectedProduct === "all" ? "all products" : selectedProduct}
        </p>
      </CardContent>
    </Card>
  )
}

// Platform ROI Comparison
export function PlatformROI({ platformFilter, dateRange }: ExecutiveMetricsProps) {
  const dashboardData = useMemo(() => getProcessedDashboardData(platformFilter, dateRange), [platformFilter, dateRange])
  
  const platformMetrics = useMemo(() => dashboardData.platformMetrics.map(p => {
    const engagement = p.totalLikes + p.total + p.totalShares
    const engagementPerPost = p.totalPosts > 0 ? Math.round(engagement / p.totalPosts) : 0
    return {
      platform: p.platform === "twitter" ? "X" : p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      posts: p.totalPosts,
      engagement: engagementPerPost,
      total: engagement
    }
  }).sort((a, b) => b.engagement - a.engagement), [dashboardData])

  const maxEngagement = Math.max(...platformMetrics.map(p => p.engagement))

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Platform Efficiency</CardTitle>
        <CardDescription>Engagement per post by platform</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {platformMetrics.map((platform) => (
            <div key={platform.platform} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{platform.platform}</span>
                <span className="text-muted-foreground">{platform.engagement} eng/post</span>
              </div>
              <Progress 
                value={(platform.engagement / maxEngagement) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {platform.posts} posts | {platform.total.toLocaleString()} total engagements
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Quick Summary Stats
export function QuickSummary({ platformFilter }: ExecutiveMetricsProps) {
  const dashboardData = useMemo(() => getProcessedDashboardData(platformFilter), [platformFilter])
  const commentPlatformFilter = getCommentFilter(platformFilter)
  const { segmentation } = useSegmentation()
  const { getCommentMetrics } = useDashboardData()
  const commentMetrics = useMemo(() => getCommentMetrics(commentPlatformFilter, undefined, segmentation), [getCommentMetrics, commentPlatformFilter, segmentation])
  
  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Performance Summary</CardTitle>
        <CardDescription>Key metrics at a glance</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-background/80 p-3 text-center">
            <p className="text-2xl font-bold">{dashboardData.kpiMetrics.totalPosts}</p>
            <p className="text-xs text-muted-foreground">Total Posts</p>
          </div>
          <div className="rounded-lg bg-background/80 p-3 text-center">
            <p className="text-2xl font-bold">{commentMetrics.total.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Comments Analyzed</p>
          </div>
          <div className="rounded-lg bg-background/80 p-3 text-center">
            <p className="text-2xl font-bold text-positive">{commentMetrics.positiveRate}%</p>
            <p className="text-xs text-muted-foreground">Positive Sentiment</p>
          </div>
          <div className="rounded-lg bg-background/80 p-3 text-center">
            <p className="text-2xl font-bold text-negative">{commentMetrics.negativeRate}%</p>
            <p className="text-xs text-muted-foreground">Negative Sentiment</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
