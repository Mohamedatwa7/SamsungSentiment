"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CountUp } from "@/components/ui/count-up"
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  ShoppingBag, 
  CheckCircle2, 
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  DollarSign,
  BarChart3,
  Target,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type DateRange } from "@/components/dashboard/date-filter"
import {
  getMarketplaceKPIs,
  getStarDistribution,
  getMarketplaceComparison,
  getProductPerformance,
  getCompetitorMentions,
  getFeatureSentiment,
  getPriceValuePerception,
  type Marketplace,
} from "@/lib/marketplace-data"

interface MarketplaceMetricsProps {
  marketplaceFilter?: Marketplace[]
  dateRange?: DateRange
}

// Executive KPIs for Marketplace
// Business Objective: At-a-glance health metrics for marketplace presence
export function MarketplaceKPIs({ marketplaceFilter, dateRange }: MarketplaceMetricsProps) {
  const kpis = useMemo(() => getMarketplaceKPIs(marketplaceFilter, dateRange), [marketplaceFilter, dateRange])
  
  const metrics = [
    {
      label: "Total Reviews",
      value: kpis.totalReviews,
      format: (v: number) => Math.round(v).toLocaleString(),
      subValue: `${kpis.weekOverWeekChange >= 0 ? "+" : ""}${kpis.weekOverWeekChange}% WoW`,
      icon: ShoppingBag,
      trend: kpis.weekOverWeekChange >= 0 ? "up" : "down",
    },
    {
      label: "Average Rating",
      value: kpis.averageRating,
      format: (v: number) => v.toFixed(1),
      subValue: "out of 5 stars",
      icon: Star,
      trend: kpis.averageRating >= 4 ? "up" : kpis.averageRating >= 3 ? "neutral" : "down",
    },
    {
      label: "Positive Sentiment",
      value: kpis.positivePercentage,
      format: (v: number) => `${Math.round(v)}%`,
      subValue: `${kpis.negativePercentage}% negative`,
      icon: ThumbsUp,
      trend: kpis.positivePercentage >= 50 ? "up" : "down",
    },
    {
      label: "Verified Purchases",
      value: kpis.verifiedPurchaseRate,
      format: (v: number) => `${Math.round(v)}%`,
      subValue: "authenticity rate",
      icon: CheckCircle2,
      trend: kpis.verifiedPurchaseRate >= 80 ? "up" : "neutral",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {metrics.map((metric) => (
        <Card key={metric.label} className="accent-top hover-lift">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="section-label">{metric.label}</p>
                <p className="mt-1 text-3xl">
                  <CountUp value={metric.value} format={metric.format} className="kpi-value" />
                </p>
                <div className="mt-1 flex items-center gap-1 text-xs">
                  {metric.trend === "up" && <TrendingUp className="h-3 w-3 text-positive" />}
                  {metric.trend === "down" && <TrendingDown className="h-3 w-3 text-negative" />}
                  <span className={cn(
                    metric.trend === "up" ? "text-positive" :
                    metric.trend === "down" ? "text-negative" : "text-muted-foreground"
                  )}>
                    {metric.subValue}
                  </span>
                </div>
              </div>
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                metric.trend === "up" ? "bg-positive/10 text-positive" :
                metric.trend === "down" ? "bg-negative/10 text-negative" :
                "bg-muted text-muted-foreground"
              )}>
                <metric.icon className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Star Rating Distribution
// Business Objective: Understand customer satisfaction distribution to identify improvement areas
export function StarRatingDistribution({ marketplaceFilter, dateRange }: MarketplaceMetricsProps) {
  const distribution = useMemo(() => getStarDistribution(marketplaceFilter, dateRange), [marketplaceFilter, dateRange])
  
  const getBarColor = (rating: number) => {
    if (rating >= 4) return "bg-positive"
    if (rating === 3) return "bg-amber-500"
    return "bg-negative"
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          Rating Distribution
        </CardTitle>
        <CardDescription>
          Customer satisfaction breakdown by star rating
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {distribution.map((item) => (
          <div key={item.rating} className="flex items-center gap-3">
            <div className="flex w-12 items-center gap-1 text-sm font-medium">
              {item.rating} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", getBarColor(item.rating))}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
            <div className="w-16 text-right text-sm text-muted-foreground">
              {item.count} ({item.percentage}%)
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Marketplace Comparison
// Business Objective: Compare performance across Amazon and Noon to optimize channel strategy
export function MarketplaceComparison({ dateRange }: { dateRange?: DateRange }) {
  const comparison = useMemo(() => getMarketplaceComparison(dateRange), [dateRange])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Marketplace Comparison
        </CardTitle>
        <CardDescription>
          Performance metrics across Amazon and Noon
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {comparison.map((mp) => (
            <div key={mp.marketplace} className="rounded-xl border p-4 transition-colors hover:bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold capitalize text-lg">{mp.marketplace}</span>
                <Badge variant="outline">{mp.totalReviews} reviews</Badge>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Avg Rating</span>
                    <span className="font-medium flex items-center gap-1">
                      {mp.averageRating} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    </span>
                  </div>
                  <Progress value={mp.averageRating * 20} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Positive Rate</span>
                    <span className="font-medium text-positive">{mp.positiveRate}%</span>
                  </div>
                  <Progress value={mp.positiveRate} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Verified Rate</span>
                    <span className="font-medium">{mp.verifiedRate}%</span>
                  </div>
                  <Progress value={mp.verifiedRate} className="h-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Product Performance Table
// Business Objective: Identify top and underperforming products to guide inventory and marketing
export function ProductPerformanceTable({ marketplaceFilter, dateRange }: MarketplaceMetricsProps) {
  const products = useMemo(() => getProductPerformance(marketplaceFilter, dateRange), [marketplaceFilter, dateRange])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Product Performance
        </CardTitle>
        <CardDescription>
          Review metrics by product line with key feature insights
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="py-3 text-center font-medium text-muted-foreground">Reviews</th>
                <th className="py-3 text-center font-medium text-muted-foreground">Rating</th>
                <th className="py-3 text-center font-medium text-muted-foreground">Positive</th>
                <th className="py-3 text-left font-medium text-muted-foreground">Top Strength</th>
                <th className="py-3 text-left font-medium text-muted-foreground">Top Issue</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.productLine} className="border-b last:border-0 odd:bg-muted/30 transition-colors hover:bg-muted/50">
                  <td className="py-3 font-medium">{product.productLine}</td>
                  <td className="py-3 text-center">{product.totalReviews}</td>
                  <td className="py-3 text-center">
                    <span className="flex items-center justify-center gap-1">
                      {product.averageRating} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <span className={cn(
                      "font-medium tabular-nums",
                      product.positiveRate >= 60 ? "text-positive" :
                      product.positiveRate >= 40 ? "text-amber-600 dark:text-amber-400" : "text-negative"
                    )}>
                      {product.positiveRate}%
                    </span>
                  </td>
                  <td className="py-3">
                    <Badge variant="outline" className="bg-positive/10 text-positive border-positive/20">
                      <ThumbsUp className="h-3 w-3 mr-1" />
                      {product.topFeature}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <Badge variant="outline" className="bg-negative/10 text-negative border-negative/20">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {product.topIssue}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// Competitor Mention Analysis
// Business Objective: Understand competitive landscape and positioning in customer minds
export function CompetitorAnalysis({ marketplaceFilter, dateRange }: MarketplaceMetricsProps) {
  const competitors = useMemo(() => getCompetitorMentions(marketplaceFilter, dateRange), [marketplaceFilter, dateRange])
  
  if (competitors.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Competitor Mentions</CardTitle>
        <CardDescription>
          How often competitors are mentioned and in what context
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {competitors.map((comp) => {
            const total = comp.positiveContext + comp.negativeContext
            const neutralContext = comp.mentions - total
            return (
              <div key={comp.competitor} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{comp.competitor}</span>
                  <span className="text-sm text-muted-foreground">{comp.mentions} mentions</span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full">
                  <div
                    className="bg-positive transition-all duration-500"
                    style={{ width: `${(comp.positiveContext / comp.mentions) * 100}%` }}
                    title={`${comp.positiveContext} positive`}
                  />
                  <div
                    className="bg-muted transition-all duration-500"
                    style={{ width: `${(neutralContext / comp.mentions) * 100}%` }}
                    title={`${neutralContext} neutral`}
                  />
                  <div
                    className="bg-negative transition-all duration-500"
                    style={{ width: `${(comp.negativeContext / comp.mentions) * 100}%` }}
                    title={`${comp.negativeContext} negative`}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="text-positive">Samsung preferred: {comp.positiveContext}</span>
                  <span className="text-negative">Competitor preferred: {comp.negativeContext}</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// Feature Sentiment Grid
// Business Objective: Identify which product features drive satisfaction or complaints
export function FeatureSentimentGrid({ marketplaceFilter, dateRange }: MarketplaceMetricsProps) {
  const features = useMemo(() => getFeatureSentiment(marketplaceFilter, dateRange), [marketplaceFilter, dateRange])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Feature Sentiment Analysis</CardTitle>
        <CardDescription>
          Customer sentiment breakdown by product feature
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {features.slice(0, 10).map((feature) => (
            <div
              key={feature.feature}
              className={cn(
                "rounded-xl border p-3 text-center transition-colors",
                feature.positiveRate >= 70 ? "bg-positive/10 border-positive/20" :
                feature.positiveRate >= 50 ? "bg-amber-500/10 border-amber-500/20" :
                "bg-negative/10 border-negative/20"
              )}
            >
              <p className="text-sm font-medium capitalize mb-1">{feature.feature}</p>
              <p className={cn(
                "text-lg font-bold tabular-nums",
                feature.positiveRate >= 70 ? "text-positive" :
                feature.positiveRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-negative"
              )}>
                {feature.positiveRate}%
              </p>
              <p className="text-xs text-muted-foreground">{feature.total} mentions</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Price Value Perception
// Business Objective: Monitor customer perception of price-to-value ratio
export function PriceValueCard({ marketplaceFilter, dateRange }: MarketplaceMetricsProps) {
  const priceMetrics = useMemo(() => getPriceValuePerception(marketplaceFilter, dateRange), [marketplaceFilter, dateRange])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Price-Value Perception
        </CardTitle>
        <CardDescription>
          How customers perceive the value for money
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center p-4 bg-muted/50 rounded-xl">
            <p className="kpi-value text-3xl">{priceMetrics.totalPriceMentions}</p>
            <p className="text-sm text-muted-foreground">
              Reviews mentioning price ({priceMetrics.percentageOfReviews}% of total)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-xl bg-positive/10 border border-positive/20 transition-colors">
              <p className="text-2xl font-bold tabular-nums text-positive">{priceMetrics.positiveValuePerception}%</p>
              <p className="text-xs text-positive">Worth the price</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-negative/10 border border-negative/20 transition-colors">
              <p className="text-2xl font-bold tabular-nums text-negative">{priceMetrics.negativeValuePerception}%</p>
              <p className="text-xs text-negative">Overpriced</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
