"use client"

import { useMemo } from "react"
import { Moon, ShieldCheck, RotateCcw, ArrowUpRight, ArrowDownRight, Minus, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getFeatureMetrics, type CommentPlatform, type FeatureKey, type Segmentation } from "@/lib/comments-data"
import { type DateRange } from "@/components/dashboard/date-filter"

interface FeatureKPIsProps {
  platformFilter?: CommentPlatform[]
  dateRange?: DateRange
  segmentation?: Segmentation
}

interface FeatureCardConfig {
  feature: FeatureKey
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  description: string
}

const FEATURES: FeatureCardConfig[] = [
  {
    feature: "nightography",
    icon: Moon,
    iconBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    description: "Low-light camera capability",
  },
  {
    feature: "privacy_display",
    icon: ShieldCheck,
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    description: "On-screen privacy protection",
  },
  {
    feature: "horizontal_lock",
    icon: RotateCcw,
    iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
    description: "Display orientation control",
  },
  {
    feature: "galaxy_ai",
    icon: Sparkles,
    iconBg: "bg-purple-500/10 dark:bg-purple-500/20",
    iconColor: "text-purple-600 dark:text-purple-400",
    description: "AI-powered features",
  },
]

// Helper to get last week's date range
function getLastWeekRange(): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now)
  to.setDate(to.getDate() - 7)
  const from = new Date(to)
  from.setDate(from.getDate() - 7)
  return { from, to }
}

export function FeatureKPIs({ platformFilter, dateRange, segmentation }: FeatureKPIsProps) {
  const lastWeekRange = useMemo(() => getLastWeekRange(), [])
  
  const metrics = useMemo(
    () =>
      FEATURES.map((cfg) => {
        const m = getFeatureMetrics(cfg.feature, platformFilter, dateRange, segmentation)
        const mLastWeek = getFeatureMetrics(cfg.feature, platformFilter, lastWeekRange, segmentation)
        
        // Calculate week-over-week change in positive percentage
        const posChangeVsLW = m.positivePercentage - mLastWeek.positivePercentage
        
        return { cfg, m, mLastWeek, posChangeVsLW }
      }),
    [platformFilter, dateRange, segmentation, lastWeekRange],
  )

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div>
        <h2 className="display-title text-xl">Feature Sentiment</h2>
        <p className="text-sm text-muted-foreground">How customers talk about flagship features across all comments</p>
      </div>
      <div className="stat-rail divide-none grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(({ cfg, m, posChangeVsLW }) => {
        const Icon = cfg.icon
        const sentimentScore = m.totalComments > 0
          ? Math.round((m.positiveCount - m.negativeCount) / m.totalComments * 100)
          : 0
        const trendIcon =
          sentimentScore > 5 ? <ArrowUpRight className="h-4 w-4" /> :
          sentimentScore < -5 ? <ArrowDownRight className="h-4 w-4" /> :
          <Minus className="h-4 w-4" />

        const scoreColor =
          sentimentScore > 30 ? "text-positive" :
          sentimentScore > 0 ? "text-emerald-600 dark:text-emerald-500" :
          sentimentScore < -10 ? "text-negative" :
          "text-amber-600 dark:text-amber-500"

        return (
          <Card key={cfg.feature} className="gap-4">
            <CardHeader>
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <h3 className="display-title text-base">{m.label}</h3>
                    <p className="text-xs text-muted-foreground">{cfg.description}</p>
                  </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Big stat: % positive */}
              <div className="flex items-end justify-between">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn("kpi-value text-4xl", scoreColor)}>
                      {m.totalComments > 0 ? `${m.positivePercentage}%` : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">positive</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.totalComments.toLocaleString()} comments analysed
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <div className={cn("flex items-center gap-1 text-xs font-medium", scoreColor)}>
                    {trendIcon}
                    <span className={cn(
                      posChangeVsLW > 0 ? "text-positive" : posChangeVsLW < 0 ? "text-negative" : "text-muted-foreground"
                    )}>
                      {posChangeVsLW > 0 ? "+" : ""}{posChangeVsLW}% vs LW
                    </span>
                  </div>
                </div>
              </div>

              {/* Sentiment bar */}
              {m.totalComments > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex h-1.5 overflow-hidden bg-muted">
                    <div
                      className="bg-positive transition-all"
                      style={{ width: `${m.positivePercentage}%` }}
                      aria-label={`${m.positivePercentage}% positive`}
                    />
                    <div
                      className="bg-muted-foreground/30 transition-all"
                      style={{ width: `${100 - m.positivePercentage - m.negativePercentage}%` }}
                      aria-label={`neutral`}
                    />
                    <div
                      className="bg-negative transition-all"
                      style={{ width: `${m.negativePercentage}%` }}
                      aria-label={`${m.negativePercentage}% negative`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-positive" />
                      {m.positiveCount.toLocaleString()} pos
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                      {m.neutralCount.toLocaleString()} neutral
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-negative" />
                      {m.negativeCount.toLocaleString()} neg
                    </span>
                  </div>
                </div>
              ) : (
                <p className="rule-t pt-3 text-center text-xs text-muted-foreground">
                  No posts mention this feature in the current filter
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
      </div>
    </div>
  )
}
