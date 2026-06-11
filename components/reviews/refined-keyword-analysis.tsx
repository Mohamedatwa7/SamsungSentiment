"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  extractRefinedKeywords, 
  type CanonicalKeyword,
  type KeywordType,
  type RefinedKeywordResult
} from "@/lib/refined-keyword-extraction"
import type { AnalyzedReview } from "@/lib/reviews-data"
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
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingUp,
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

interface RefinedKeywordAnalysisProps {
  reviews: AnalyzedReview[]
}

// Type labels and colors
const typeConfig: Record<KeywordType, { label: string; color: string; icon: React.ElementType; description: string }> = {
  feature: {
    label: "Feature",
    color: "bg-transparent text-primary border-primary/30",
    icon: Lightbulb,
    description: "Product features and capabilities"
  },
  pain_point: {
    label: "Pain Point",
    color: "bg-transparent text-negative border-negative/30",
    icon: AlertTriangle,
    description: "Issues and negative experiences"
  },
  comparison: {
    label: "Comparison",
    color: "bg-transparent text-foreground/80 border-border",
    icon: Scale,
    description: "Competitor and model comparisons"
  },
  purchase_intent: {
    label: "Purchase Intent",
    color: "bg-transparent text-positive border-positive/30",
    icon: ShoppingCart,
    description: "Buying decisions and value assessment"
  },
  use_case: {
    label: "Use Case",
    color: "bg-transparent text-muted-foreground border-border",
    icon: Target,
    description: "How customers use the product"
  },
  perception: {
    label: "Perception",
    color: "bg-transparent text-muted-foreground border-border",
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
  audio: Volume2,
  price: DollarSign,
  durability: Shield,
  ai: Sparkles,
  connectivity: Wifi,
  storage: HardDrive,
  general: MessageSquare,
  comparison: Scale,
  s_pen: PenTool,
}

// Individual keyword card component
function KeywordCard({ keyword, index }: { keyword: CanonicalKeyword; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const config = typeConfig[keyword.type]
  const TypeIcon = config.icon
  const AspectIcon = aspectIcons[keyword.aspectCategory] || MessageSquare
  
  const sentimentColor = keyword.sentiment === "positive"
    ? "text-positive"
    : keyword.sentiment === "negative"
    ? "text-negative"
    : "text-muted-foreground"

  const sentimentRail = keyword.sentiment === "positive"
    ? "border-l-positive/60"
    : keyword.sentiment === "negative"
    ? "border-l-negative/60"
    : "border-l-border"

  return (
    <div className={cn(
      "border-b border-b-border/70 border-l-2 py-4 pl-4 transition-colors",
      sentimentRail,
      "hover:bg-muted/40"
    )}>
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AspectIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3 className="font-semibold text-base capitalize">{keyword.canonical}</h3>
          </div>
          <div className="text-right">
            <div className="kpi-value text-2xl">{keyword.totalMentions}</div>
            <div className="text-xs text-muted-foreground">reviews</div>
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
          <div className={cn("text-sm font-semibold tabular-nums",
            keyword.positivePercentage >= 60 ? "text-positive" :
            keyword.positivePercentage >= 40 ? "text-amber-600 dark:text-amber-400" : "text-negative"
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
      
      {/* Expanded Content */}
      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-4">
          {/* Variants */}
          {keyword.variants.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Grouped Variants</p>
              <div className="flex flex-wrap gap-1.5">
                {keyword.variants.slice(0, 8).map((variant, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 border border-border/70 bg-transparent text-muted-foreground"
                  >
                    {variant}
                  </span>
                ))}
                {keyword.variants.length > 8 && (
                  <span className="text-xs px-2 py-1 text-muted-foreground">
                    +{keyword.variants.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Sample Contexts */}
          {keyword.sampleContexts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Sample Review Excerpts</p>
              <div className="space-y-2">
                {keyword.sampleContexts.map((context, i) => (
                  <p key={i} className="text-xs text-muted-foreground border-l-2 border-border pl-3 py-1 italic">
                    &quot;{context}&quot;
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

export function RefinedKeywordAnalysis({ reviews }: RefinedKeywordAnalysisProps) {
  const [selectedType, setSelectedType] = useState<KeywordType | "all">("all")
  
  const result = useMemo(() => extractRefinedKeywords(reviews), [reviews])
  
  const filteredKeywords = useMemo(() => {
    if (selectedType === "all") return result.acceptedKeywords
    return result.acceptedKeywords.filter(k => k.type === selectedType)
  }, [result.acceptedKeywords, selectedType])
  
  // Group keywords by type for summary
  const keywordsByType = useMemo(() => {
    const grouped: Record<KeywordType, CanonicalKeyword[]> = {
      feature: [],
      pain_point: [],
      comparison: [],
      purchase_intent: [],
      use_case: [],
      perception: []
    }
    
    for (const kw of result.acceptedKeywords) {
      grouped[kw.type].push(kw)
    }
    
    return grouped
  }, [result.acceptedKeywords])
  
  return (
    <div className="space-y-6">
      {/* Type Summary Cards */}
      <div className="rule-t stat-rail grid grid-cols-2 gap-y-8 pt-6 md:grid-cols-3 lg:grid-cols-6">
        {(Object.entries(typeConfig) as [KeywordType, typeof typeConfig[KeywordType]][]).map(([type, config]) => {
          const Icon = config.icon
          const count = keywordsByType[type].length
          const isSelected = selectedType === type

          return (
            <button
              key={type}
              onClick={() => setSelectedType(isSelected ? "all" : type)}
              className={cn(
                "px-5 first:pl-0 pb-1 text-left transition-colors border-b-2",
                isSelected
                  ? "border-b-primary"
                  : "border-b-transparent hover:bg-muted/40",
              )}
            >
              <div className="section-label flex items-center gap-1.5 mb-1">
                <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span>{config.label}</span>
              </div>
              <div className="kpi-value text-3xl">{count}</div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{config.description}</p>
            </button>
          )
        })}
      </div>
      
      {/* Filter indicator */}
      {selectedType !== "all" && (
        <div className="flex items-center justify-between border-b border-border/70 pb-2">
          <span className="text-sm">
            Showing <strong>{filteredKeywords.length}</strong> {typeConfig[selectedType].label.toLowerCase()} keywords
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedType("all")}>
            Clear Filter
          </Button>
        </div>
      )}
      
      {/* Keywords Grid */}
      <div className="rule-t grid gap-x-10 md:grid-cols-2">
        {filteredKeywords.map((keyword, idx) => (
          <KeywordCard key={keyword.canonical} keyword={keyword} index={idx} />
        ))}
        
        {filteredKeywords.length === 0 && (
          <div className="col-span-2 flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-6 w-6 text-muted-foreground/70" />
            </div>
            No keywords found for this filter
          </div>
        )}
      </div>
      
      {/* Rejected Phrases Section */}
      {result.rejectedPhrases.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Rejected Phrases (Sample)
            </CardTitle>
            <CardDescription>
              Phrases filtered out as noise, conversational filler, or non-actionable
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.rejectedPhrases.slice(0, 15).map((rejected, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 border border-border/70 bg-transparent text-muted-foreground"
                  title={rejected.reason}
                >
                  {rejected.phrase}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
