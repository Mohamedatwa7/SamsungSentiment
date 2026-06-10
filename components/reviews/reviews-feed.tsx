"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThumbsUp, ThumbsDown, Minus, Star, Search, X, Calendar, User, Smartphone } from "lucide-react"
import type { AnalyzedReview, Sentiment } from "@/lib/reviews-data"

interface ReviewsFeedProps {
  reviews: AnalyzedReview[]
}

function SentimentIcon({ sentiment }: { sentiment: Sentiment }) {
  if (sentiment === "positive") return <ThumbsUp className="h-4 w-4 text-positive" />
  if (sentiment === "negative") return <ThumbsDown className="h-4 w-4 text-negative" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

function StarRating({ rating }: { rating: string }) {
  const stars = parseInt(rating)
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star 
          key={i} 
          className={`h-3 w-3 ${i <= stars ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  )
}

function ReviewCard({ review }: { review: AnalyzedReview }) {
  const initials = review["Reviewer Display Name"]
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  
  const formattedDate = review.parsedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-sm">{review["Reviewer Display Name"]}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formattedDate}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StarRating rating={review["Overall Rating"]} />
              <Badge variant={review.sentiment === "positive" ? "default" : review.sentiment === "negative" ? "destructive" : "secondary"}>
                <SentimentIcon sentiment={review.sentiment} />
              </Badge>
            </div>
          </div>
          
          {/* Product Badge */}
          <div className="flex items-center gap-2">
            <Smartphone className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-xs">{review.productLine}</Badge>
          </div>
          
          {/* Title & Content */}
          {review["Review Title"] && (
            <h4 className="font-semibold">{review["Review Title"]}</h4>
          )}
          {review["Review Text"] && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
              {review["Review Text"]}
            </p>
          )}
          
          {/* Themes */}
          {review.themes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {review.themes.map(theme => (
                <Badge key={theme} variant="secondary" className="text-xs">
                  {theme}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function ReviewsFeed({ reviews }: ReviewsFeedProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSearch, setActiveSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"all" | Sentiment>("all")
  const [displayCount, setDisplayCount] = useState(20)
  
  const handleSearch = () => {
    setActiveSearch(searchQuery.trim().toLowerCase())
    setDisplayCount(20)
  }
  
  const clearSearch = () => {
    setSearchQuery("")
    setActiveSearch("")
  }
  
  // Filter reviews
  const filteredReviews = useMemo(() => {
    let result = reviews
    
    // Filter by sentiment
    if (activeTab !== "all") {
      result = result.filter(r => r.sentiment === activeTab)
    }
    
    // Filter by search
    if (activeSearch) {
      result = result.filter(r => 
        r["Review Text"].toLowerCase().includes(activeSearch) ||
        r["Review Title"].toLowerCase().includes(activeSearch) ||
        r["Reviewer Display Name"].toLowerCase().includes(activeSearch) ||
        r.productLine.toLowerCase().includes(activeSearch) ||
        r.themes.some(t => t.toLowerCase().includes(activeSearch))
      )
    }
    
    return result
  }, [reviews, activeTab, activeSearch])
  
  const displayedReviews = filteredReviews.slice(0, displayCount)
  const hasMore = displayCount < filteredReviews.length
  
  // Get counts for tabs
  const counts = useMemo(() => ({
    all: reviews.length,
    positive: reviews.filter(r => r.sentiment === "positive").length,
    neutral: reviews.filter(r => r.sentiment === "neutral").length,
    negative: reviews.filter(r => r.sentiment === "negative").length
  }), [reviews])
  
  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search reviews by keyword, product, reviewer, or theme..."
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
                {filteredReviews.length} {filteredReviews.length === 1 ? "result" : "results"} found
              </span>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Sentiment Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setDisplayCount(20); }}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            All
            <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="positive" className="gap-1.5">
            <ThumbsUp className="h-3 w-3" />
            Positive
            <Badge variant="secondary" className="ml-1">{counts.positive}</Badge>
          </TabsTrigger>
          <TabsTrigger value="neutral" className="gap-1.5">
            <Minus className="h-3 w-3" />
            Neutral
            <Badge variant="secondary" className="ml-1">{counts.neutral}</Badge>
          </TabsTrigger>
          <TabsTrigger value="negative" className="gap-1.5">
            <ThumbsDown className="h-3 w-3" />
            Negative
            <Badge variant="secondary" className="ml-1">{counts.negative}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Reviews Grid */}
      {displayedReviews.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayedReviews.map((review) => (
              <ReviewCard key={review["Review ID"]} review={review} />
            ))}
          </div>
          
          {hasMore && (
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                onClick={() => setDisplayCount(prev => prev + 20)}
              >
                Load More ({filteredReviews.length - displayCount} remaining)
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">No reviews found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters to find reviews.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
