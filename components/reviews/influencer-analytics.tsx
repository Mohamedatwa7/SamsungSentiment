"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ThumbsUp, 
  ThumbsDown, 
  Minus, 
  MessageSquare, 
  TrendingUp,
  Activity,
  ChevronRight,
  Heart,
  AlertTriangle,
  CheckCircle2,
  Info,
  Users,
  Languages,
  Loader2
} from "lucide-react"
import {
  INFLUENCERS,
  getInfluencerMetrics,
  getInfluencerInsights,
  getInfluencerComparison,
  getCombinedInsights,
  type InfluencerId,
  type InfluencerInsight,
} from "@/lib/influencer-data"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts"
import { cn } from "@/lib/utils"

// Influencer KPIs
export function InfluencerKPIs() {
  const comparison = useMemo(() => getInfluencerComparison(), [])
  const allComments = useMemo(() => {
    let total = 0
    let positive = 0
    let negative = 0
    comparison.forEach(c => {
      total += c.totalComments
      positive += Math.round(c.totalComments * c.positivePercent / 100)
      negative += Math.round(c.totalComments * c.negativePercent / 100)
    })
    return { total, positive, negative }
  }, [comparison])
  
  const avgEngagement = useMemo(() => {
    const total = comparison.reduce((sum, c) => sum + c.engagementRate, 0)
    return (total / comparison.length).toFixed(1)
  }, [comparison])
  
  const avgHealth = useMemo(() => {
    const total = comparison.reduce((sum, c) => sum + c.brandHealthScore, 0)
    return Math.round(total / comparison.length)
  }, [comparison])
  
  // Highest share of positive comments (comparison[] itself is sorted by
  // comment-health score, which is not the same ranking).
  const topPositive = useMemo(
    () => [...comparison].sort((a, b) => b.positivePercent - a.positivePercent)[0],
    [comparison],
  )
  
  const kpis = [
    {
      title: "Total Comments",
      value: allComments.total.toLocaleString(),
      icon: MessageSquare,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Avg Engagement Rate",
      value: `${avgEngagement}%`,
      icon: Activity,
      color: "text-violet-500",
      bgColor: "bg-violet-100 dark:bg-violet-900/30"
    },
    {
      title: "Avg Comment Health",
      value: avgHealth,
      icon: TrendingUp,
      color: avgHealth >= 70 ? "text-positive" : avgHealth >= 50 ? "text-amber-500" : "text-negative",
      bgColor: avgHealth >= 70 ? "bg-positive/10" : avgHealth >= 50 ? "bg-amber-500/10" : "bg-negative/10"
    },
    {
      title: "Most Positive Comments",
      value: topPositive?.name || "-",
      subValue: topPositive ? `${topPositive.positivePercent}% positive` : "",
      icon: CheckCircle2,
      color: "text-positive",
      bgColor: "bg-positive/10"
    },
    {
      title: "Influencers Tracked",
      value: comparison.length,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-100 dark:bg-blue-900/30"
    },
    {
      title: "Positive Comments",
      value: allComments.positive.toLocaleString(),
      subValue: `${Math.round((allComments.positive / allComments.total) * 100)}%`,
      icon: ThumbsUp,
      color: "text-positive",
      bgColor: "bg-positive/10"
    }
  ]
  
  return (
    <div className="rule-t stat-rail grid grid-cols-1 gap-y-8 pt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi, idx) => (
        <div key={idx} className="flex min-w-0 flex-col gap-1.5 px-5 first:pl-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="section-label flex items-center gap-1.5 truncate">
            <kpi.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            {kpi.title}
          </p>
          <p className="kpi-value text-3xl truncate">{kpi.value}</p>
          {kpi.subValue && <p className="text-xs text-muted-foreground">{kpi.subValue}</p>}
        </div>
      ))}
    </div>
  )
}

// Individual Influencer Card
function InfluencerCard({ 
  influencerId, 
  onInsightClick 
}: { 
  influencerId: InfluencerId
  onInsightClick: (insight: InfluencerInsight) => void
}) {
  const influencer = INFLUENCERS[influencerId]
  const metrics = useMemo(() => getInfluencerMetrics(influencerId), [influencerId])
  const insights = useMemo(() => getInfluencerInsights(influencerId), [influencerId])

  // Lifestyle accounts where no qualifying S26 video has been found yet get a
  // clear pending state instead of a wall of zero metrics.
  if (metrics.totalComments === 0) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{influencer.name}</CardTitle>
              <CardDescription className="text-sm">{influencer.handle}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="rule-t pt-4 text-sm text-muted-foreground">
            No Galaxy S26 content detected on this account yet. Tracking is active —
            data appears here as soon as a qualifying video is found.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{influencer.name}</CardTitle>
            <CardDescription className="text-sm">{influencer.handle}</CardDescription>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 py-1">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">{influencer.engagementRate}% ER</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="rule-t stat-rail grid grid-cols-3 pt-3">
          <div className="px-4 first:pl-0 text-center">
            <div className="flex items-center justify-center gap-1 text-positive">
              <ThumbsUp className="h-3.5 w-3.5" />
              <span className="kpi-value text-xl">{metrics.positivePercent}%</span>
            </div>
            <p className="section-label text-[10px]">Positive</p>
          </div>
          <div className="px-4 first:pl-0 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Minus className="h-3.5 w-3.5" />
              <span className="kpi-value text-xl">{metrics.neutralPercent}%</span>
            </div>
            <p className="section-label text-[10px]">Neutral</p>
          </div>
          <div className="px-4 first:pl-0 text-center">
            <div className="flex items-center justify-center gap-1 text-negative">
              <ThumbsDown className="h-3.5 w-3.5" />
              <span className="kpi-value text-xl">{metrics.negativePercent}%</span>
            </div>
            <p className="section-label text-[10px]">Negative</p>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{metrics.totalComments.toLocaleString()}</span>
            <span className="text-muted-foreground">comments</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{metrics.brandHealthScore}</span>
            <span className="text-muted-foreground">comment health</span>
          </div>
        </div>
        
        {/* Insights */}
        <div className="space-y-2">
          <p className="section-label">Insights</p>
          <div>
            {insights.slice(0, 3).map((insight, idx) => (
              <button
                key={idx}
                onClick={() => onInsightClick(insight)}
                className="flex w-full items-center justify-between border-b border-border/70 py-2 text-left text-xs transition-colors last:border-0 hover:bg-muted/40"
              >
                <div className="flex items-center gap-2">
                  {insight.type === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-positive" />}
                  {insight.type === "warning" && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                  {insight.type === "danger" && <AlertTriangle className="h-3.5 w-3.5 text-negative" />}
                  {insight.type === "info" && <Info className="h-3.5 w-3.5 text-primary" />}
                  <span className="font-medium">{insight.title}</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Comparison Chart
function ComparisonChart() {
  const comparison = useMemo(() => getInfluencerComparison(), [])
  
  const chartData = comparison.map(c => ({
    name: c.name,
    positive: c.positivePercent,
    negative: c.negativePercent,
  }))
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sentiment Comparison</CardTitle>
        <CardDescription>Positive vs negative sentiment by influencer</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={0} barCategoryGap="15%">
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--popover-foreground)",
                  fontSize: "12px",
                  padding: "8px 12px",
                  boxShadow: "none"
                }}
                formatter={(value: number, name: string) => [`${value}%`, name.charAt(0).toUpperCase() + name.slice(1)]}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: "12px", color: "var(--muted-foreground)" }} />
              <Bar dataKey="positive" name="Positive" fill="var(--positive)" radius={[2, 2, 0, 0]} maxBarSize={36} />
              <Bar dataKey="negative" name="Negative" fill="var(--negative)" radius={[2, 2, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Comment Health Comparison
function CommentHealthComparison() {
  const comparison = useMemo(() => getInfluencerComparison(), [])
  
  const chartData = comparison.map(c => ({
    name: c.name,
    health: c.brandHealthScore,
  }))
  
  const getHealthColor = (score: number) => {
    if (score >= 70) return "var(--positive)"
    if (score >= 50) return "var(--neutral)"
    return "var(--negative)"
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comment Health Score</CardTitle>
        <CardDescription>Overall comment sentiment health by influencer</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" barCategoryGap="20%">
              <CartesianGrid horizontal={true} vertical={false} stroke="var(--border)" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}`} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={100} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--popover-foreground)",
                  fontSize: "12px",
                  padding: "8px 12px",
                  boxShadow: "none"
                }}
                formatter={(value: number) => [`${value}/100`, "Comment Health"]}
              />
              <Bar dataKey="health" radius={[0, 2, 2, 0]} maxBarSize={36}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getHealthColor(entry.health)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Combined Insights Section
function CombinedInsightsSection({ onInsightClick }: { onInsightClick: (insight: InfluencerInsight) => void }) {
  const insights = useMemo(() => getCombinedInsights(), [])
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Key Insights</CardTitle>
        <CardDescription>Actionable insights across all influencer partnerships</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {insights.map((insight, idx) => (
            <button
              key={idx}
              onClick={() => onInsightClick(insight)}
              className="flex flex-col items-start gap-2 border-b border-border/70 py-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                {insight.type === "success" && <CheckCircle2 className="h-4 w-4 text-positive" />}
                {insight.type === "warning" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                {insight.type === "danger" && <AlertTriangle className="h-4 w-4 text-negative" />}
                {insight.type === "info" && <Info className="h-4 w-4 text-primary" />}
                <span className="font-semibold text-sm">{insight.title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{insight.message}</p>
              {insight.comments.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-primary">
                  <span>View {insight.comments.length} comments</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Translatable Comment Component
function TranslatableComment({ comment, idx }: { comment: InfluencerComment; idx: number }) {
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(true)
  
  const handleTranslate = async () => {
    if (translatedText) {
      // Toggle between original and translated
      setShowOriginal(!showOriginal)
      return
    }
    
    setIsTranslating(true)
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: comment.text, targetLang: "en" })
      })
      
      if (response.ok) {
        const data = await response.json()
        setTranslatedText(data.translatedText)
        setShowOriginal(false)
      }
    } catch (error) {
      console.error("Translation failed:", error)
    } finally {
      setIsTranslating(false)
    }
  }
  
  // Detect if text might be Arabic (contains Arabic characters)
  const isLikelyArabic = /[\u0600-\u06FF]/.test(comment.text)
  
  return (
    <div
      className={`border-b border-b-border/70 border-l-2 py-3 pl-3 transition-colors hover:bg-muted/40 ${
        comment.sentiment === "positive" ? "border-l-positive/60" :
        comment.sentiment === "negative" ? "border-l-negative/60" :
        "border-l-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm" dir="auto">
            {showOriginal ? comment.text : translatedText}
          </p>
          {translatedText && !showOriginal && (
            <p className="text-xs text-muted-foreground mt-1 italic" dir="auto">
              Original: {comment.text.slice(0, 100)}{comment.text.length > 100 ? "..." : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isLikelyArabic && (
            <button
              onClick={handleTranslate}
              disabled={isTranslating}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              title={translatedText ? (showOriginal ? "Show translation" : "Show original") : "Translate to English"}
            >
              {isTranslating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Languages className="h-3.5 w-3.5" />
              )}
              <span>{translatedText ? (showOriginal ? "EN" : "AR") : "EN"}</span>
            </button>
          )}
          {comment.sentiment === "positive" && <ThumbsUp className="h-3.5 w-3.5 text-positive" />}
          {comment.sentiment === "negative" && <ThumbsDown className="h-3.5 w-3.5 text-negative" />}
          {comment.sentiment === "neutral" && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span>@{comment.ownerUsername}</span>
        {comment.likes > 0 && (
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" /> {comment.likes}
          </span>
        )}
      </div>
    </div>
  )
}

// Comment Dialog
function CommentDialog({ 
  insight, 
  open, 
  onClose 
}: { 
  insight: InfluencerInsight | null
  open: boolean
  onClose: () => void 
}) {
  if (!insight) return null
  
  const influencer = insight.influencerId ? INFLUENCERS[insight.influencerId] : null
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {insight.type === "success" && <CheckCircle2 className="h-5 w-5 text-positive" />}
            {insight.type === "warning" && <AlertTriangle className="h-5 w-5 text-amber-500" />}
            {insight.type === "danger" && <AlertTriangle className="h-5 w-5 text-negative" />}
            {insight.type === "info" && <Info className="h-5 w-5 text-primary" />}
            {insight.title}
          </DialogTitle>
          <DialogDescription>
            {influencer && <span className="font-medium">{influencer.name}</span>}
            {influencer && " - "}
            {insight.message}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto nice-scroll space-y-3 pr-2 mt-4">
          {insight.comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">No comments found for this insight</p>
            </div>
          ) : null}
          {insight.comments.slice(0, 200).map((comment, idx) => (
            <TranslatableComment key={comment.id || idx} comment={comment} idx={idx} />
          ))}
          {insight.comments.length > 200 && (
            <p className="text-center text-xs text-muted-foreground py-2">
              Showing 200 of {insight.comments.length} comments
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Main Component
export function InfluencerAnalytics() {
  const [selectedInsight, setSelectedInsight] = useState<InfluencerInsight | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [category, setCategory] = useState<"tech" | "lifestyle">("tech")
  
  const handleInsightClick = (insight: InfluencerInsight) => {
    setSelectedInsight(insight)
    setDialogOpen(true)
  }
  
  const influencerIds = Object.keys(INFLUENCERS) as InfluencerId[]
  const techIds = influencerIds.filter((id) => INFLUENCERS[id].category === "tech")
  const lifestyleIds = influencerIds.filter((id) => INFLUENCERS[id].category === "lifestyle")

  return (
    <div className="space-y-6">
      <Tabs defaultValue="individual" className="w-full">
        <TabsList>
          <TabsTrigger value="individual">Individual Influencers</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="mt-6 space-y-5">
          {/* Tech / Lifestyle segmented switch */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
              <button
                onClick={() => setCategory("tech")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                  category === "tech"
                    ? "bg-primary/20 text-foreground shadow-[0_0_14px_var(--glow-primary)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Tech Influencers
              </button>
              <button
                onClick={() => setCategory("lifestyle")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                  category === "lifestyle"
                    ? "bg-primary/20 text-foreground shadow-[0_0_14px_var(--glow-primary)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Lifestyle Influencers
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              {category === "tech"
                ? "Dedicated tech review accounts — all Samsung coverage tracked"
                : "General lifestyle accounts — only their Galaxy S26 content is tracked"}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(category === "tech" ? techIds : lifestyleIds).map(id => (
              <InfluencerCard
                key={id}
                influencerId={id}
                onInsightClick={handleInsightClick}
              />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="comparison" className="mt-6 space-y-6">
          {/* Combined Insights */}
          <CombinedInsightsSection onInsightClick={handleInsightClick} />
          
          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ComparisonChart />
            <CommentHealthComparison />
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Comment Dialog */}
      <CommentDialog 
        insight={selectedInsight}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  )
}
