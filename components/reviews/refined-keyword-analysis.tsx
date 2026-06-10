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
                    className="text-xs px-2 py-1 rounded bg-background border"
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
                  <p key={i} className="text-xs text-muted-foreground bg-background p-2 rounded border italic">
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(Object.entries(typeConfig) as [KeywordType, typeof typeConfig[KeywordType]][]).map(([type, config]) => {
          const Icon = config.icon
          const count = keywordsByType[type].length
          const isSelected = selectedType === type
          
          return (
            <button
              key={type}
              onClick={() => setSelectedType(isSelected ? "all" : type)}
              className={cn(
                "p-3 rounded-lg border text-left transition-all",
                isSelected 
                  ? "ring-2 ring-primary bg-primary/5" 
                  : "hover:bg-muted/50",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{config.label}</span>
              </div>
              <div className="text-2xl font-bold">{count}</div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{config.description}</p>
            </button>
          )
        })}
      </div>
      
      {/* Filter indicator */}
      {selectedType !== "all" && (
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2 rounded-lg">
          <span className="text-sm">
            Showing <strong>{filteredKeywords.length}</strong> {typeConfig[selectedType].label.toLowerCase()} keywords
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedType("all")}>
            Clear Filter
          </Button>
        </div>
      )}
      
      {/* Keywords Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredKeywords.map((keyword, idx) => (
          <KeywordCard key={keyword.canonical} keyword={keyword} index={idx} />
        ))}
        
        {filteredKeywords.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            No keywords found for this filter
          </div>
        )}
      </div>
      
      {/* Rejected Phrases Section */}
      {result.rejectedPhrases.length > 0 && (
        <Card className="border-dashed">
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
                  className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground"
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
