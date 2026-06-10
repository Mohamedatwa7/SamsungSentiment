"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { getProcessedDashboardData, type Platform } from "@/lib/social-data"
import { type CommentPlatform } from "@/lib/comments-data"
import { useDashboardData } from "@/contexts/dashboard-data-context"
import { type DateRange } from "@/components/dashboard/date-filter"
import { useSegmentation } from "@/components/dashboard/segmentation-filter"

const phoneModelsChartConfig: ChartConfig = {
  positive: {
    label: "Positive",
    color: "oklch(0.65 0.18 150)",
  },
  neutral: {
    label: "Neutral",
    color: "oklch(0.6 0.02 250)",
  },
  negative: {
    label: "Negative",
    color: "oklch(0.6 0.2 30)",
  },
}

const distributionChartConfig: ChartConfig = {
  positive: {
    label: "Positive",
    color: "oklch(0.65 0.18 150)",
  },
  neutral: {
    label: "Neutral",
    color: "oklch(0.6 0.02 250)",
  },
  negative: {
    label: "Negative",
    color: "oklch(0.6 0.2 30)",
  },
}

interface SentimentChartProps {
  platformFilter?: Platform[]
  dateRange?: DateRange
}

export function SentimentTrendChart({ platformFilter, dateRange }: SentimentChartProps) {
  // Convert platform filter to comment platforms
  const commentPlatformFilter = platformFilter?.filter(
    (p): p is CommentPlatform => p === "instagram" || p === "tiktok"
  )
  const { segmentation } = useSegmentation()
  const { getCommentMetrics } = useDashboardData()

  const commentMetrics = useMemo(() => getCommentMetrics(commentPlatformFilter, dateRange, segmentation), [getCommentMetrics, commentPlatformFilter, dateRange, segmentation])

  return (
    <Card className="h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Sentiment Analysis</CardTitle>
        <CardDescription>Based on {commentMetrics.total.toLocaleString()} analyzed comments</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Visual Sentiment Bar */}
        <div className="mb-6">
          <div className="flex h-4 w-full overflow-hidden rounded-full">
            <div 
              className="bg-positive transition-all" 
              style={{ width: `${commentMetrics.positivePercentage}%` }}
              title={`Positive: ${commentMetrics.positivePercentage}%`}
            />
            <div 
              className="bg-muted-foreground/30 transition-all" 
              style={{ width: `${commentMetrics.neutralPercentage}%` }}
              title={`Neutral: ${commentMetrics.neutralPercentage}%`}
            />
            <div 
              className="bg-negative transition-all" 
              style={{ width: `${commentMetrics.negativePercentage}%` }}
              title={`Negative: ${commentMetrics.negativePercentage}%`}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-positive font-medium">{commentMetrics.positivePercentage}% Positive</span>
            <span className="text-muted-foreground">{commentMetrics.neutralPercentage}% Neutral</span>
            <span className="text-negative font-medium">{commentMetrics.negativePercentage}% Negative</span>
          </div>
        </div>
        
        {/* Top Issues & Praise in two columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
          {commentMetrics.topIssues.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3 text-negative">Top Issues</p>
              <div className="flex flex-wrap gap-2">
                {commentMetrics.topIssues.slice(0, 4).map((issue) => (
                  <span key={issue.issue} className="rounded-full bg-negative/10 text-negative px-3 py-1 text-xs font-medium">
                    {issue.issue} ({issue.count})
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {commentMetrics.topPraise.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3 text-positive">Top Praise</p>
              <div className="flex flex-wrap gap-2">
                {commentMetrics.topPraise.slice(0, 4).map((praise) => (
                  <span key={praise.praise} className="rounded-full bg-positive/10 text-positive px-3 py-1 text-xs font-medium">
                    {praise.praise} ({praise.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function PhoneModelsSentimentChart({ platformFilter }: SentimentChartProps) {
  // Convert platform filter to comment platforms
  const commentPlatformFilter = platformFilter?.filter(
    (p): p is CommentPlatform => p === "instagram" || p === "tiktok"
  )
  const { getFilteredComments } = useDashboardData()
  
  const commentsByProduct = useMemo(() => {
    const allComments = getFilteredComments(commentPlatformFilter)
    const byProduct: Record<string, { total: number; positive: number; negative: number; neutral: number }> = {}
    for (const c of allComments) {
      const product = c.productModel || "General"
      if (!byProduct[product]) byProduct[product] = { total: 0, positive: 0, negative: 0, neutral: 0 }
      byProduct[product].total++
      byProduct[product][c.sentiment]++
    }
    return byProduct
  }, [getFilteredComments, commentPlatformFilter])
  
  const phoneModelsSentimentData = useMemo(() => 
    Object.entries(commentsByProduct)
      .filter(([product]) => product !== "General")
      .slice(0, 6)
      .map(([product, data]) => ({
        model: product,
        positive: data.positive,
        negative: data.negative,
        neutral: data.neutral,
      })),
    [commentsByProduct]
  )
  
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Sentiment by Product</CardTitle>
        <CardDescription>Based on comment analysis</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={phoneModelsChartConfig} className="h-[300px] w-full">
          <BarChart data={phoneModelsSentimentData} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs text-muted-foreground"
            />
            <YAxis
              type="category"
              dataKey="model"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs text-muted-foreground"
              width={120}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="positive" fill="oklch(0.65 0.18 150)" radius={[0, 4, 4, 0]} stackId="a" maxBarSize={48} />
            <Bar dataKey="neutral" fill="oklch(0.6 0.02 250)" radius={0} stackId="a" maxBarSize={48} />
            <Bar dataKey="negative" fill="oklch(0.6 0.2 30)" radius={[0, 4, 4, 0]} stackId="a" maxBarSize={48} />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function SentimentDistributionChart({ platformFilter }: SentimentChartProps) {
  // Convert platform filter to comment platforms
  const commentPlatformFilter = platformFilter?.filter(
    (p): p is CommentPlatform => p === "instagram" || p === "tiktok"
  )
  const { getCommentMetrics } = useDashboardData()
  
  const commentMetrics = useMemo(() => getCommentMetrics(commentPlatformFilter), [getCommentMetrics, commentPlatformFilter])
  
  const distributionData = useMemo(() => [
    { name: "Positive", value: commentMetrics.positiveRate, fill: "oklch(0.65 0.18 150)" },
    { name: "Neutral", value: commentMetrics.neutralRate, fill: "oklch(0.6 0.02 250)" },
    { name: "Negative", value: commentMetrics.negativeRate, fill: "oklch(0.6 0.2 30)" },
  ], [commentMetrics])
  
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Overall Sentiment</CardTitle>
        <CardDescription>Based on {commentMetrics.total} comments</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={distributionChartConfig} className="mx-auto h-[300px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={distributionData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              cornerRadius={4}
              dataKey="value"
              nameKey="name"
              stroke="none"
            >
              {distributionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}



const platformChartConfig: ChartConfig = {
  likes: {
    label: "Likes",
    color: "oklch(0.65 0.18 150)",
  },
  comments: {
    label: "Comments",
    color: "oklch(0.6 0.15 250)",
  },
  shares: {
    label: "Shares",
    color: "oklch(0.55 0.18 280)",
  },
}

export function PlatformEngagementChart({ platformFilter, dateRange }: SentimentChartProps) {
  const dashboardData = useMemo(() => getProcessedDashboardData(platformFilter, dateRange), [platformFilter, dateRange])
  
  const platformData = useMemo(() => 
    dashboardData.platformMetrics.map(p => {
      const totalEngagement = p.totalLikes + p.totalComments + p.totalShares
      return {
        platform: p.platform === "twitter" ? "X" : p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
        engagement: totalEngagement,
        posts: p.totalPosts,
        engPerPost: p.totalPosts > 0 ? Math.round(totalEngagement / p.totalPosts) : 0,
      }
    }).sort((a, b) => b.engagement - a.engagement),
    [dashboardData]
  )
  
  const maxEngagement = Math.max(...platformData.map(p => p.engagement))
  const totalEngagement = platformData.reduce((sum, p) => sum + p.engagement, 0)
  
  return (
    <Card className="h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Platform Breakdown</CardTitle>
        <CardDescription>{totalEngagement.toLocaleString()} total engagements</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {platformData.map((platform, index) => {
            const colors = ["bg-primary", "bg-positive", "bg-amber-500", "bg-purple-500"]
            const percentage = totalEngagement > 0 ? Math.round((platform.engagement / totalEngagement) * 100) : 0
            return (
              <div key={platform.platform} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{platform.platform}</span>
                  <span className="text-muted-foreground">{percentage}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div 
                    className={`h-full rounded-full ${colors[index % colors.length]} transition-all`}
                    style={{ width: `${(platform.engagement / maxEngagement) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{platform.engagement.toLocaleString()} engagements</span>
                  <span>{platform.engPerPost.toLocaleString()} per post</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}


