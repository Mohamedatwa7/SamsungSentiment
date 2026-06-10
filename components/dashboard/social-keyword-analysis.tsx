"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  extractSocialKeywords, 
  type SocialCanonicalKeyword,
  type KeywordType,
  type SocialKeywordResult
} from "@/lib/social-keyword-extraction"
import { type Comment } from "@/lib/comments-data"
import { useDashboardData } from "@/contexts/dashboard-data-context"
import { 
  Camera, 
  Monitor, 
  Battery, 
  Zap, 
  Palette, 
  Code, 
  DollarSign,
  Sparkles,
  HardDrive,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Scale,
  ShoppingCart,
  Target,
  Heart,
  Lightbulb,
  MessageSquare,
  PenTool,
  Info
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Platform } from "@/components/dashboard/platform-filter"
import { type DateRange } from "@/components/dashboard/date-filter"
  
interface SocialKeywordAnalysisProps {
  platformFilter?: Platform[]
  dateRange?: DateRange
}

// Type labels and colors
const typeConfig: Record<KeywordType, { label: string; color: string; icon: React.ElementType; description: string }> = {
  feature: { 
    label: "Feature", 
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    icon: Lightbulb,
    description: "Product features and capabilities"
  },
  pain_point: { 
    label: "Pain Point", 
    color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    icon: AlertTriangle,
    description: "Issues and negative experiences"
  },
  comparison: { 
    label: "Comparison", 
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800",
    icon: Scale,
    description: "Competitor and model comparisons"
  },
  purchase_intent: { 
    label: "Purchase Intent", 
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    icon: ShoppingCart,
    description: "Buying decisions and value assessment"
  },
  use_case: { 
    label: "Use Case", 
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    icon: Target,
    description: "How customers use the product"
  },
  perception: { 
    label: "Perception", 
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
    icon: Heart,
    description: "Brand and product sentiment"
  },
}

// Aspect icons
const aspectIcons: Record<string, React.ElementType> = {
  camera: Camera,
  display: Monitor,
  battery: Battery,
  performance: Zap,
  design: Palette,
  software: Code,
  price: DollarSign,
  ai: Sparkles,
  storage: HardDrive,
  general: MessageSquare,
  comparison: Scale,
  s_pen: PenTool,
}

// Individual keyword card component
function KeywordCard({ keyword }: { keyword: SocialCanonicalKeyword }) {
  const [expanded, setExpanded] = useState(false)
  const config = typeConfig[keyword.type]
  const TypeIcon = config.icon
  const AspectIcon = aspectIcons[keyword.aspectCategory] || MessageSquare
  
  const sentimentColor = keyword.sentiment === "positive" 
    ? "text-emerald-600 dark:text-emerald-400"
    : keyword.sentiment === "negative"
    ? "text-rose-600 dark:text-rose-400"
    : "text-muted-foreground"
  
  const sentimentBg = keyword.sentiment === "positive" 
    ? "bg-emerald-50 dark:bg-emerald-950/30"
    : keyword.sentiment === "negative"
    ? "bg-rose-50 dark:bg-rose-950/30"
    : "bg-muted/30"
  
  return (
    <div className={cn(
      "border rounded-lg p-4 transition-all",
      sentimentBg,
      "hover:shadow-md"
    )}>
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background border shrink-0">
              <AspectIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-base capitalize">{keyword.canonical}</h3>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold">{keyword.totalMentions}</div>
            <div className="text-xs text-muted-foreground">comments</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-xs border", config.color)}>
              <TypeIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            <span className={cn("text-xs font-medium", sentimentColor)}>
              {keyword.sentiment.charAt(0).toUpperCase() + keyword.sentiment.slice(1)}
            </span>
          </div>
          <div className={cn("text-sm font-semibold", 
            keyword.positivePercentage >= 60 ? "text-emerald-600" : 
            keyword.positivePercentage >= 40 ? "text-amber-600" : "text-rose-600"
          )}>
            {keyword.positivePercentage}% positive
          </div>
        </div>
      </div>
      
      {/* Relevance Reason */}
      <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>{keyword.relevanceReason}</p>
      </div>
      
      {/* Expand/Collapse */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-3 h-8"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <>
            <ChevronUp className="h-4 w-4 mr-1" />
            Show Less
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4 mr-1" />
            Show Variants & Context
          </>
        )}
      </Button>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-4">
          {/* Variants */}
          {keyword.variants.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Keyword Variants:</p>
              <div className="flex flex-wrap gap-1.5">
                {keyword.variants.slice(0, 8).map((variant, i) => (
                  <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs">
                    {variant}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Sample Contexts */}
          {keyword.sampleContexts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Sample Comments:</p>
              <div className="space-y-2">
                {keyword.sampleContexts.map((context, i) => (
                  <p key={i} className="text-xs text-muted-foreground italic bg-muted/50 rounded p-2">
                    &ldquo;{context}&rdquo;
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function SocialKeywordAnalysis({ platformFilter, dateRange }: SocialKeywordAnalysisProps) {
  const [selectedType, setSelectedType] = useState<KeywordType | "all">("all")
  const { getFilteredComments } = useDashboardData()
  
  // Convert platform filter to comment platforms
  const commentPlatformFilter = platformFilter?.filter(
    (p): p is "instagram" | "tiktok" => p === "instagram" || p === "tiktok"
  )
  
  const allComments = useMemo(() => {
    return getFilteredComments(commentPlatformFilter, dateRange)
  }, [getFilteredComments, commentPlatformFilter, dateRange])
  
  const result = useMemo(() => 
    extractSocialKeywords(allComments, commentPlatformFilter),
    [allComments, commentPlatformFilter]
  )
  
  const filteredKeywords = useMemo(() => {
    if (selectedType === "all") return result.acceptedKeywords
    return result.acceptedKeywords.filter(k => k.type === selectedType)
  }, [result.acceptedKeywords, selectedType])
  
  const types = Object.entries(typeConfig) as [KeywordType, typeof typeConfig[KeywordType]][]
  
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Keyword Analysis</CardTitle>
        <CardDescription>
          Product keywords extracted from social media comments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Type Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            onClick={() => setSelectedType("all")}
            className={cn(
              "p-3 rounded-lg border text-center transition-all",
              selectedType === "all" 
                ? "border-primary bg-primary/5 ring-1 ring-primary" 
                : "hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <div className="text-xl font-bold">{result.summary.totalAccepted}</div>
            <div className="text-xs text-muted-foreground">All Keywords</div>
          </button>
          
          {types.map(([type, config]) => {
            const count = result.summary.byType[type]
            const Icon = config.icon
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={cn(
                  "p-3 rounded-lg border text-center transition-all",
                  selectedType === type 
                    ? "border-primary bg-primary/5 ring-1 ring-primary" 
                    : "hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <div className="flex items-center justify-center gap-1">
                  <Icon className="h-4 w-4" />
                  <span className="text-xl font-bold">{count}</span>
                </div>
                <div className="text-xs text-muted-foreground">{config.label}</div>
              </button>
            )
          })}
        </div>
        
        {/* Keyword Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredKeywords.slice(0, 12).map((keyword, index) => (
            <KeywordCard key={keyword.canonical} keyword={keyword} />
          ))}
        </div>
        
        {filteredKeywords.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No keywords found for the selected filter.
          </div>
        )}
        
        {filteredKeywords.length > 12 && (
          <div className="text-center text-sm text-muted-foreground">
            Showing 12 of {filteredKeywords.length} keywords
          </div>
        )}
      </CardContent>
    </Card>
  )
}
