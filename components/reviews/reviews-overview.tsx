"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ThumbsUp, ThumbsDown, Minus, Star, MessageSquare, TrendingUp, Eye, Moon, RotateCcw } from "lucide-react"
import type { SentimentMetrics, S26FeatureMetrics } from "@/lib/reviews-data"

interface ReviewsOverviewProps {
  metrics: SentimentMetrics
  featureMetrics: S26FeatureMetrics
}

export function ReviewsOverview({ metrics, featureMetrics }: ReviewsOverviewProps) {
  const cards = [
    {
      title: "Total Reviews",
      value: metrics.total.toLocaleString(),
      icon: MessageSquare,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Brand Health Score",
      value: metrics.brandHealthScore,
      icon: TrendingUp,
      color: metrics.brandHealthScore >= 70 ? "text-positive" : metrics.brandHealthScore >= 50 ? "text-warning" : "text-negative",
      bgColor: metrics.brandHealthScore >= 70 ? "bg-positive/10" : metrics.brandHealthScore >= 50 ? "bg-warning/10" : "bg-negative/10"
    },
    {
      title: "Average Rating",
      value: metrics.averageRating.toFixed(1),
      icon: Star,
      color: "text-warning",
      bgColor: "bg-warning/10",
      suffix: "/ 5"
    },
    {
      title: "Positive",
      value: `${metrics.positivePercent.toFixed(1)}%`,
      subValue: metrics.positive.toLocaleString(),
      icon: ThumbsUp,
      color: "text-positive",
      bgColor: "bg-positive/10"
    },
    {
      title: "Neutral",
      value: `${metrics.neutralPercent.toFixed(1)}%`,
      subValue: metrics.neutral.toLocaleString(),
      icon: Minus,
      color: "text-neutral-foreground",
      bgColor: "bg-muted"
    },
    {
      title: "Negative",
      value: `${metrics.negativePercent.toFixed(1)}%`,
      subValue: metrics.negative.toLocaleString(),
      icon: ThumbsDown,
      color: "text-negative",
      bgColor: "bg-negative/10"
    },
    {
      title: "Privacy Display",
      value: featureMetrics.privacyDisplay.mentions.toLocaleString(),
      subValue: `${featureMetrics.privacyDisplay.positiveRate}% positive`,
      icon: Eye,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
      positiveRate: featureMetrics.privacyDisplay.positiveRate
    },
    {
      title: "Nightography",
      value: featureMetrics.nightography.mentions.toLocaleString(),
      subValue: `${featureMetrics.nightography.positiveRate}% positive`,
      icon: Moon,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
      positiveRate: featureMetrics.nightography.positiveRate
    },
    {
      title: "Horizontal Lock",
      value: featureMetrics.horizontalLock.mentions.toLocaleString(),
      subValue: `${featureMetrics.horizontalLock.positiveRate}% positive`,
      icon: RotateCcw,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      positiveRate: featureMetrics.horizontalLock.positiveRate
    }
  ]
  
  return (
    <div className="flex flex-wrap gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden min-w-[180px] flex-1 basis-[calc(50%-0.5rem)] sm:basis-[calc(33.333%-0.75rem)] md:basis-[calc(25%-0.75rem)] lg:basis-[calc(20%-0.8rem)] xl:basis-[calc(16.666%-0.85rem)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
                  {card.title}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{card.value}</span>
                  {card.suffix && (
                    <span className="text-sm text-muted-foreground">{card.suffix}</span>
                  )}
                </div>
                {card.subValue && !card.positiveRate && (
                  <span className="text-xs text-muted-foreground">
                    {card.subValue} reviews
                  </span>
                )}
                {card.positiveRate !== undefined && (
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{card.subValue}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div 
                        className="h-full rounded-full bg-positive transition-all"
                        style={{ width: `${card.positiveRate}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
