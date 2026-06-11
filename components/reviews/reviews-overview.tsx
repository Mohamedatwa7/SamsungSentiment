"use client"

import { CountUp } from "@/components/ui/count-up"
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
      numeric: metrics.total,
      format: (v: number) => Math.round(v).toLocaleString(),
      icon: MessageSquare,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Brand Health Score",
      value: metrics.brandHealthScore,
      numeric: metrics.brandHealthScore,
      format: (v: number) => `${Math.round(v)}`,
      icon: TrendingUp,
      color: metrics.brandHealthScore >= 70 ? "text-positive" : metrics.brandHealthScore >= 50 ? "text-amber-500" : "text-negative",
      bgColor: metrics.brandHealthScore >= 70 ? "bg-positive/10" : metrics.brandHealthScore >= 50 ? "bg-amber-500/10" : "bg-negative/10"
    },
    {
      title: "Average Rating",
      value: metrics.averageRating.toFixed(1),
      numeric: metrics.averageRating,
      format: (v: number) => v.toFixed(1),
      icon: Star,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      suffix: "/ 5"
    },
    {
      title: "Positive",
      value: `${metrics.positivePercent.toFixed(1)}%`,
      numeric: metrics.positivePercent,
      format: (v: number) => `${v.toFixed(1)}%`,
      subValue: metrics.positive.toLocaleString(),
      icon: ThumbsUp,
      color: "text-positive",
      bgColor: "bg-positive/10"
    },
    {
      title: "Neutral",
      value: `${metrics.neutralPercent.toFixed(1)}%`,
      numeric: metrics.neutralPercent,
      format: (v: number) => `${v.toFixed(1)}%`,
      subValue: metrics.neutral.toLocaleString(),
      icon: Minus,
      color: "text-muted-foreground",
      bgColor: "bg-muted"
    },
    {
      title: "Negative",
      value: `${metrics.negativePercent.toFixed(1)}%`,
      numeric: metrics.negativePercent,
      format: (v: number) => `${v.toFixed(1)}%`,
      subValue: metrics.negative.toLocaleString(),
      icon: ThumbsDown,
      color: "text-negative",
      bgColor: "bg-negative/10"
    },
    {
      title: "Privacy Display",
      value: featureMetrics.privacyDisplay.mentions.toLocaleString(),
      numeric: featureMetrics.privacyDisplay.mentions,
      format: (v: number) => Math.round(v).toLocaleString(),
      subValue: `${featureMetrics.privacyDisplay.positiveRate}% positive`,
      icon: Eye,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
      positiveRate: featureMetrics.privacyDisplay.positiveRate
    },
    {
      title: "Nightography",
      value: featureMetrics.nightography.mentions.toLocaleString(),
      numeric: featureMetrics.nightography.mentions,
      format: (v: number) => Math.round(v).toLocaleString(),
      subValue: `${featureMetrics.nightography.positiveRate}% positive`,
      icon: Moon,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
      positiveRate: featureMetrics.nightography.positiveRate
    },
    {
      title: "Horizontal Lock",
      value: featureMetrics.horizontalLock.mentions.toLocaleString(),
      numeric: featureMetrics.horizontalLock.mentions,
      format: (v: number) => Math.round(v).toLocaleString(),
      subValue: `${featureMetrics.horizontalLock.positiveRate}% positive`,
      icon: RotateCcw,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      positiveRate: featureMetrics.horizontalLock.positiveRate
    }
  ]
  
  return (
    <div className="accent-top rule-t stat-rail grid grid-cols-1 gap-y-8 pt-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((card) => (
        <div key={card.title} className="flex min-w-0 flex-col gap-1.5 px-5 first:pl-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <span className="section-label flex items-center gap-1.5 truncate">
            <card.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            {card.title}
          </span>
          <div className="flex items-baseline gap-1">
            <CountUp value={card.numeric} format={card.format} className="kpi-value text-4xl" />
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
              <div className="h-1.5 w-full overflow-hidden bg-muted">
                <div
                  className="h-full bg-positive transition-all"
                  style={{ width: `${card.positiveRate}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
