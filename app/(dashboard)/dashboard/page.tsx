"use client"

import { Suspense, useState } from "react"

import {
  MainKPIs,
  BrandHealthGauge,
  CriticalAlerts,
  ProductPerformanceChart,
} from "@/components/dashboard/executive-metrics"
import { BrandHealthTrend } from "@/components/dashboard/brand-health-trend"
import { SocialFeed } from "@/components/dashboard/social-feed"
import { CommentsFeed } from "@/components/dashboard/comments-feed"
import { TopComments } from "@/components/dashboard/top-comments"
import { LastWeekPosts } from "@/components/dashboard/last-week-posts"
import { FeatureKPIs } from "@/components/dashboard/feature-kpis"
import { InfluencerAnalytics, InfluencerKPIs } from "@/components/reviews/influencer-analytics"
import { PlatformFilter, usePlatformFilter } from "@/components/dashboard/platform-filter"
import { DateFilter, useDateFilter } from "@/components/dashboard/date-filter"
import { DashboardExportButton } from "@/components/dashboard/export-button"
import { SegmentationFilter, SegmentationProvider, useSegmentation } from "@/components/dashboard/segmentation-filter"
import { DashboardDataProvider } from "@/contexts/dashboard-data-context"

import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function ChartSkeleton() {
  return <Skeleton className="h-[300px] w-full rounded-lg" />
}

function FeedSkeleton() {
  return <Skeleton className="h-[600px] w-full rounded-lg" />
}

function DashboardContent() {
  const [activeTab, setActiveTab] = useState("overview")
  const { selectedPlatforms, setSelectedPlatforms } = usePlatformFilter()
  // Default to last 60 days
  const { dateRange, setDays, setCustomRange, clearDateRange } = useDateFilter(60)
  const { segmentation, setSegmentation } = useSegmentation()

  // Convert null to undefined for components that expect DateRange | undefined.
  const dateRangeProp = dateRange ?? undefined

  // Filter platform list to only the platforms that have comment data (Instagram, TikTok, Facebook).
  const commentPlatformFilter: ("instagram" | "tiktok" | "facebook")[] = (
    selectedPlatforms && selectedPlatforms.length > 0
      ? selectedPlatforms
      : ["instagram", "tiktok", "facebook"]
  ).filter((p): p is "instagram" | "tiktok" | "facebook" => p === "instagram" || p === "tiktok" || p === "facebook")

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <p className="section-label">Samsung Gulf · Social Intelligence</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Social Reviews Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Instagram, TikTok &amp; Facebook comments segmented by department, product and feature
        </p>
      </div>

      {/* Sticky filter bar — condenses against the top nav on scroll */}
      {activeTab === "overview" && (
        <div className="sticky top-16 z-20 -mx-4 border-y border-border/40 bg-background/85 px-4 py-3 backdrop-blur-xl md:-mx-6 md:px-6">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <SegmentationFilter value={segmentation} onChange={setSegmentation} />
            <DateFilter
              dateRange={dateRange}
              onDateChange={setDays}
              onCustomRangeChange={setCustomRange}
              onClear={clearDateRange}
            />
            <PlatformFilter
              selectedPlatforms={selectedPlatforms}
              onPlatformsChange={setSelectedPlatforms}
            />
            <div className="ml-auto">
              <DashboardExportButton platformFilter={selectedPlatforms} />
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-none lg:flex">
          <TabsTrigger value="overview">Samsung Socials</TabsTrigger>
          <TabsTrigger value="influencers">Influencers</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Main KPIs — Total Positive Rate, Number of Comments, Platform Split, Pos:Neg Ratio */}
          <Suspense fallback={<ChartSkeleton />}>
            <MainKPIs platformFilter={selectedPlatforms} dateRange={dateRangeProp} />
          </Suspense>

          {/* Section 1: Comment Health & Alerts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense fallback={<ChartSkeleton />}>
              <BrandHealthGauge platformFilter={selectedPlatforms} dateRange={dateRangeProp} />
            </Suspense>
            <Suspense fallback={<ChartSkeleton />}>
              <CriticalAlerts platformFilter={selectedPlatforms} dateRange={dateRangeProp} />
            </Suspense>
          </div>

          {/* Section 2: Comment Health Week-on-Week Trend */}
          <Suspense fallback={<ChartSkeleton />}>
            <BrandHealthTrend platformFilter={commentPlatformFilter} dateRange={dateRangeProp} />
          </Suspense>

          {/* Section 3: S26 Keywords — Feature KPIs (Nightography, Privacy Display, Horizontal Lock, Galaxy AI) */}
          <Suspense fallback={<ChartSkeleton />}>
            <FeatureKPIs
              platformFilter={commentPlatformFilter}
              dateRange={dateRangeProp}
              segmentation={segmentation}
            />
          </Suspense>

          {/* Section 3: Performance Analysis */}
          <Suspense fallback={<ChartSkeleton />}>
            <ProductPerformanceChart platformFilter={selectedPlatforms} dateRange={dateRangeProp} />
          </Suspense>

          {/* Section 4: Last Week Activity */}
          <Suspense fallback={<ChartSkeleton />}>
            <LastWeekPosts platformFilter={commentPlatformFilter} dateRange={dateRangeProp} />
          </Suspense>

          {/* Section 5: Top Comments */}
          <Suspense fallback={<FeedSkeleton />}>
            <TopComments platformFilter={commentPlatformFilter} dateRange={dateRangeProp} />
          </Suspense>

          {/* Section 6: Comments Analysis */}
          <Suspense fallback={<FeedSkeleton />}>
            <CommentsFeed platformFilter={commentPlatformFilter} dateRange={dateRangeProp} />
          </Suspense>

          {/* Section 7: Social Feed */}
          <Suspense fallback={<FeedSkeleton />}>
            <SocialFeed platformFilter={selectedPlatforms} dateRange={dateRangeProp} />
          </Suspense>
        </TabsContent>

        {/* Influencers Tab */}
        <TabsContent value="influencers" className="mt-6 space-y-6">
          {/* Influencer KPIs */}
          <Suspense fallback={<ChartSkeleton />}>
            <InfluencerKPIs />
          </Suspense>
          
          <Suspense fallback={<FeedSkeleton />}>
            <InfluencerAnalytics />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <DashboardDataProvider>
      <SegmentationProvider>
        <DashboardContent />
      </SegmentationProvider>
    </DashboardDataProvider>
  )
}
