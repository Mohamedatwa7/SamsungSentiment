"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Star, CheckCircle2, ThumbsUp, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { type DateRange } from "@/components/dashboard/date-filter"
import { getTopReviews, type Marketplace, type MarketplaceReview } from "@/lib/marketplace-data"

interface MarketplaceReviewsFeedProps {
  marketplaceFilter?: Marketplace[]
  dateRange?: DateRange
}

function ReviewCard({ review }: { review: MarketplaceReview }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const sentimentColor = {
    positive: "text-emerald-600",
    negative: "text-rose-600",
    neutral: "text-muted-foreground",
  }
  
  const sentimentBg = {
    positive: "bg-emerald-50 border-emerald-200",
    negative: "bg-rose-50 border-rose-200",
    neutral: "bg-muted border-muted",
  }

  return (
    <div className={cn("rounded-lg border p-4", sentimentBg[review.sentiment])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="capitalize text-xs">
              {review.marketplace}
            </Badge>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    "h-3 w-3",
                    star <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted"
                  )}
                />
              ))}
            </div>
            {review.verifiedPurchase && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Verified
              </span>
            )}
          </div>
          <h4 className="mt-2 font-medium">{review.title}</h4>
          <p className={cn(
            "mt-1 text-sm text-muted-foreground",
            !isExpanded && "line-clamp-2"
          )}>
            {review.text}
          </p>
          {review.text.length > 100 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-1 h-auto p-0 text-xs text-primary"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>Show less <ChevronUp className="h-3 w-3 ml-1" /></>
              ) : (
                <>Show more <ChevronDown className="h-3 w-3 ml-1" /></>
              )}
            </Button>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span>{review.productLine}</span>
            <span>{new Date(review.date).toLocaleDateString()}</span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {review.helpfulVotes} helpful
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MarketplaceReviewsFeed({ marketplaceFilter, dateRange }: MarketplaceReviewsFeedProps) {
  const [filter, setFilter] = useState<"all" | "amazon" | "noon">("all")
  
  const reviews = useMemo(() => {
    const effectiveFilter = filter === "all" ? marketplaceFilter : [filter as Marketplace]
    return getTopReviews(20, effectiveFilter, dateRange)
  }, [marketplaceFilter, dateRange, filter])

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Top Reviews</CardTitle>
            <CardDescription>Most helpful customer reviews</CardDescription>
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="amazon" className="text-xs">Amazon</TabsTrigger>
              <TabsTrigger value="noon" className="text-xs">Noon</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {reviews.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No reviews found for the selected filters.</p>
          ) : (
            reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
