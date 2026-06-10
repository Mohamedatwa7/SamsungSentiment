"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  extractProductKeywords, 
  type ExtractedKeyword,
  type AspectCategory,
  type IntentCategory,
  type KeywordExtractionResult
} from "@/lib/keyword-extraction"
import type { AnalyzedReview } from "@/lib/reviews-data"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts"
import { 
  Camera, 
  Monitor, 
  Battery, 
  Zap, 
  Palette, 
  Code, 
  Volume2, 
  DollarSign,
  Shield,
  Sparkles,
  Wifi,
  HardDrive,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  TrendingUp,
  Search,
  Filter
} from "lucide-react"
import { cn } from "@/lib/utils"

interface KeywordAnalysisProps {
  reviews: AnalyzedReview[]
}

const aspectIcons: Record<AspectCategory, React.ElementType> = {
  camera: Camera,
  display: Monitor,
  battery: Battery,
  performance: Zap,
  design: Palette,
  software: Code,
  audio: Volume2,
  price: DollarSign,
  durability: Shield,
  ai_features: Sparkles,
  connectivity: Wifi,
  storage: HardDrive,
  general: MessageSquare,
}

const aspectLabels: Record<AspectCategory, string> = {
  camera: "Camera",
  display: "Display",
  battery: "Battery",
  performance: "Performance",
  design: "Design",
  software: "Software",
  audio: "Audio",
  price: "Price",
  durability: "Durability",
  ai_features: "AI Features",
  connectivity: "Connectivity",
  storage: "Storage",
  general: "General",
}

const intentLabels: Record<IntentCategory, string> = {
  praise: "Praise",
  complaint: "Complaint",
  comparison: "Comparison",
  feature_request: "Feature Request",
  purchase_intent: "Purchase Intent",
  recommendation: "Recommendation",
  question: "Question",
  experience: "Experience",
}

const intentColors: Record<IntentCategory, string> = {
  praise: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  complaint: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  comparison: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  feature_request: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  purchase_intent: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  recommendation: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  question: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  experience: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

export function KeywordAnalysis({ reviews }: KeywordAnalysisProps) {
  const [selectedAspect, setSelectedAspect] = useState<AspectCategory | "all">("all")
  const [selectedIntent, setSelectedIntent] = useState<IntentCategory | "all">("all")
  
  const result = useMemo(() => extractProductKeywords(reviews), [reviews])
  
  const filteredKeywords = useMemo(() => {
    let keywords = result.keywords
    
    if (selectedAspect !== "all") {
      keywords = keywords.filter(k => k.aspect === selectedAspect)
    }
    if (selectedIntent !== "all") {
      keywords = keywords.filter(k => k.intent === selectedIntent)
    }
    
    return keywords
  }, [result.keywords, selectedAspect, selectedIntent])
  
  // Prepare aspect chart data
  const aspectChartData = useMemo(() => {
    return Object.entries(result.aspectSummary)
      .filter(([aspect]) => aspect !== "general")
      .map(([aspect, data]) => ({
        name: aspectLabels[aspect as AspectCategory],
        count: data.count,
        sentiment: data.avgSentiment,
        fill: data.avgSentiment > 0.1 ? "#10b981" : data.avgSentiment < -0.1 ? "#ef4444" : "#6b7280"
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [result.aspectSummary])
  
  // Prepare intent chart data
  const intentChartData = useMemo(() => {
    return Object.entries(result.intentSummary)
      .map(([intent, count]) => ({
        name: intentLabels[intent as IntentCategory],
        count,
        intent: intent as IntentCategory
      }))
      .sort((a, b) => b.count - a.count)
  }, [result.intentSummary])
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Product-Intent Keyword Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Extracted {result.keywords.length} meaningful phrases from {reviews.length} reviews
          </p>
        </div>
      </div>
      
      {/* Summary Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aspect Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Keyword Distribution by Aspect</CardTitle>
            <CardDescription>Which product aspects are mentioned most</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aspectChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [value, "Mentions"]}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {aspectChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Intent Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Keyword Distribution by Intent</CardTitle>
            <CardDescription>What customers are trying to express</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={intentChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => [value, "Mentions"]}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Filter Keywords</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Aspect Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">By Aspect</label>
              <div className="flex flex-wrap gap-1.5">
                <Badge 
                  variant={selectedAspect === "all" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedAspect("all")}
                >
                  All
                </Badge>
                {(Object.keys(aspectLabels) as AspectCategory[])
                  .filter(a => a !== "general")
                  .map(aspect => {
                    const Icon = aspectIcons[aspect]
                    return (
                      <Badge 
                        key={aspect}
                        variant={selectedAspect === aspect ? "default" : "outline"}
                        className="cursor-pointer gap-1"
                        onClick={() => setSelectedAspect(aspect)}
                      >
                        <Icon className="h-3 w-3" />
                        {aspectLabels[aspect]}
                      </Badge>
                    )
                  })}
              </div>
            </div>
            
            {/* Intent Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">By Intent</label>
              <div className="flex flex-wrap gap-1.5">
                <Badge 
                  variant={selectedIntent === "all" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedIntent("all")}
                >
                  All
                </Badge>
                {(Object.keys(intentLabels) as IntentCategory[]).map(intent => (
                  <Badge 
                    key={intent}
                    variant={selectedIntent === intent ? "default" : "outline"}
                    className={cn("cursor-pointer", selectedIntent === intent && intentColors[intent])}
                    onClick={() => setSelectedIntent(intent)}
                  >
                    {intentLabels[intent]}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Keywords Grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Extracted Keywords</CardTitle>
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredKeywords.length} keywords
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {filteredKeywords.slice(0, 60).map((keyword, idx) => (
              <KeywordBadge key={`${keyword.phrase}-${idx}`} keyword={keyword} />
            ))}
            {filteredKeywords.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">No keywords match the current filters</p>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Top Keywords by Category */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Top Praised */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-base">Most Praised</CardTitle>
            </div>
            <CardDescription>Phrases with highest positive sentiment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.keywords
                .filter(k => k.sentiment === "positive")
                .slice(0, 8)
                .map((keyword, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate flex-1">{keyword.phrase}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {aspectLabels[keyword.aspect]}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{keyword.count}x</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Top Complaints */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-rose-600" />
              <CardTitle className="text-base">Top Complaints</CardTitle>
            </div>
            <CardDescription>Phrases with highest negative sentiment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.keywords
                .filter(k => k.sentiment === "negative")
                .slice(0, 8)
                .map((keyword, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate flex-1">{keyword.phrase}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {aspectLabels[keyword.aspect]}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{keyword.count}x</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Feature Requests */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-base">Feature Requests</CardTitle>
            </div>
            <CardDescription>What customers are asking for</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.keywords
                .filter(k => k.intent === "feature_request" || k.intent === "comparison")
                .slice(0, 8)
                .map((keyword, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate flex-1">{keyword.phrase}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {intentLabels[keyword.intent]}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{keyword.count}x</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Individual keyword badge component
function KeywordBadge({ keyword }: { keyword: ExtractedKeyword }) {
  const sentimentColor = keyword.sentiment === "positive" 
    ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
    : keyword.sentiment === "negative"
    ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800"
    : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
  
  const Icon = aspectIcons[keyword.aspect]
  
  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm border",
        sentimentColor
      )}
      title={`${keyword.count} mentions | ${intentLabels[keyword.intent]} | ${aspectLabels[keyword.aspect]}`}
    >
      <Icon className="h-3.5 w-3.5 opacity-70" />
      <span className="font-medium">{keyword.phrase}</span>
      <span className="text-xs opacity-70">({keyword.count})</span>
    </div>
  )
}
