"use client"

import { Suspense } from "react"
import {
  MarketplaceKPIs,
  StarRatingDistribution,
  MarketplaceComparison,
  ProductPerformanceTable,
  CompetitorAnalysis,
  FeatureSentimentGrid,
  PriceValueCard,
} from "@/components/marketplace/marketplace-metrics"
import { MarketplaceReviewsFeed } from "@/components/marketplace/marketplace-reviews-feed"
import { MarketplaceFilter, useMarketplaceFilter } from "@/components/marketplace/marketplace-filter"
import { DateFilter, useDateFilter } from "@/components/dashboard/date-filter"

import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Loading skeletons
function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-sm" />
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return <Skeleton className="h-[350px] rounded-sm" />
}

function FeedSkeleton() {
  return <Skeleton className="h-[500px] rounded-sm" />
}

export default function MarketplacePage() {
  const { selectedMarketplaces, setSelectedMarketplaces } = useMarketplaceFilter()
  const { dateRange, setDays, setCustomRange, clearDateRange } = useDateFilter(30)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div>
          <p className="section-label">Amazon &amp; Noon · Marketplace</p>
          <h1 className="display-title text-3xl md:text-4xl">Marketplace Reviews</h1>
          <p className="text-muted-foreground">
            Sentiment analysis from Amazon and Noon marketplace reviews
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateFilter dateRange={dateRange} onDateChange={setDays} onCustomRangeChange={setCustomRange} onClear={clearDateRange} />
          <MarketplaceFilter 
            selectedMarketplaces={selectedMarketplaces} 
            onMarketplacesChange={setSelectedMarketplaces} 
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-none lg:flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Reviews Feed</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Section 1: Executive KPIs - Business Objective: Quick health check of marketplace performance */}
          <Suspense fallback={<KPISkeleton />}>
            <MarketplaceKPIs marketplaceFilter={selectedMarketplaces} dateRange={dateRange} />
          </Suspense>

          {/* Section 2: Marketplace Comparison & Star Rating Distribution */}
          {/* Business Objective: Identify which marketplace performs better and understand rating patterns */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense fallback={<ChartSkeleton />}>
              <MarketplaceComparison dateRange={dateRange} />
            </Suspense>
            <Suspense fallback={<ChartSkeleton />}>
              <StarRatingDistribution marketplaceFilter={selectedMarketplaces} dateRange={dateRange} />
            </Suspense>
          </div>

          {/* Section 3: Product Performance - Business Objective: Identify best/worst performing products */}
          <Suspense fallback={<ChartSkeleton />}>
            <ProductPerformanceTable marketplaceFilter={selectedMarketplaces} dateRange={dateRange} />
          </Suspense>

          {/* Section 4: Feature Sentiment & Competitor Analysis */}
          {/* Business Objective: Understand product strengths/weaknesses and competitive positioning */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense fallback={<ChartSkeleton />}>
              <FeatureSentimentGrid marketplaceFilter={selectedMarketplaces} dateRange={dateRange} />
            </Suspense>
            <Suspense fallback={<ChartSkeleton />}>
              <CompetitorAnalysis marketplaceFilter={selectedMarketplaces} dateRange={dateRange} />
            </Suspense>
          </div>

          {/* Section 5: Price Value Perception - Business Objective: Understand value perception to inform pricing */}
          <Suspense fallback={<ChartSkeleton />}>
            <PriceValueCard marketplaceFilter={selectedMarketplaces} dateRange={dateRange} />
          </Suspense>
        </TabsContent>
        
        {/* Reviews Feed Tab */}
        <TabsContent value="reviews" className="mt-6">
          <Suspense fallback={<FeedSkeleton />}>
            <MarketplaceReviewsFeed marketplaceFilter={selectedMarketplaces} dateRange={dateRange} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
