"use client"

import { useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCompact, type UnpackedPayload } from "@/lib/unpacked-data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type KpiKey = "views" | "likes" | "comments" | "engagements" | "engagementRate" | "positivePercent"

const KPI_OPTIONS: { key: KpiKey; label: string; isPercent: boolean }[] = [
  { key: "views", label: "Total Views", isPercent: false },
  { key: "likes", label: "Total Likes", isPercent: false },
  { key: "comments", label: "Total Comments", isPercent: false },
  { key: "engagements", label: "Engagement Count", isPercent: false },
  { key: "engagementRate", label: "Engagement Rate", isPercent: true },
  { key: "positivePercent", label: "Positive Sentiment", isPercent: true },
]

interface TrendPoint {
  day: string
  views: number
  likes: number
  comments: number
  engagements: number
  engagementRate: number | null
  positivePercent: number | null
}

// Day-by-day CUMULATIVE campaign totals, bucketed by publish date. The sync
// overwrites current metric totals (no historical snapshots), so the curve
// shows how the campaign accumulated as videos and comments were posted.
function buildSeries(data: UnpackedPayload): TrendPoint[] {
  const videos = data.videos.filter((v) => v.publishedAt)
  if (videos.length === 0) return []

  const comments = videos.flatMap((v) => v.comments.filter((c) => c.publishedAt))

  const firstDay = new Date(
    Math.min(...videos.map((v) => new Date(v.publishedAt as string).getTime())),
  )
  firstDay.setHours(0, 0, 0, 0)
  const today = new Date()

  // The campaign ended Aug 1 — nothing new publishes after that, so running
  // to today just drags a flat tail. Stop the curve at the campaign end
  // (campaignEndsAt = Jul 31 20:00 UTC = Aug 1 midnight Gulf).
  let lastDay = today
  if (data.meta?.campaignEndsAt) {
    const campaignEnd = new Date(data.meta.campaignEndsAt)
    campaignEnd.setHours(0, 0, 0, 0)
    if (campaignEnd < lastDay) lastDay = campaignEnd
  }

  const points: TrendPoint[] = []
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const dayEnd = new Date(d)
    dayEnd.setHours(23, 59, 59, 999)

    const vids = videos.filter((v) => new Date(v.publishedAt as string) <= dayEnd)
    let views = 0
    let likes = 0
    let commentCount = 0
    let engagements = 0
    for (const v of vids) {
      views += v.views
      likes += v.likes
      commentCount += v.commentsCount
      engagements += v.engagementCount
    }

    let pos = 0
    let total = 0
    for (const c of comments) {
      if (new Date(c.publishedAt as string) > dayEnd) continue
      total++
      if (c.sentiment === "positive") pos++
    }

    points.push({
      day: dayEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      views,
      likes,
      comments: commentCount,
      engagements,
      engagementRate: views > 0 ? Math.round((engagements / views) * 10000) / 100 : null,
      positivePercent: total > 0 ? Math.round((pos / total) * 100) : null,
    })
  }
  return points
}

export function UnpackedKPITrend({ data }: { data: UnpackedPayload }) {
  const [kpi, setKpi] = useState<KpiKey>("views")
  const series = useMemo(() => buildSeries(data), [data])
  const option = KPI_OPTIONS.find((o) => o.key === kpi) ?? KPI_OPTIONS[0]

  if (series.length === 0) return null

  const formatValue = (value: number) =>
    option.isPercent ? `${value}%` : formatCompact(value)

  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              KPI Performance Over Time
            </CardTitle>
            <CardDescription>
              Day-by-day cumulative campaign totals by publish date
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {KPI_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setKpi(o.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  kpi === o.key
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="rgba(255,255,255,0.35)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="rgba(255,255,255,0.35)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={48}
                domain={option.isPercent ? [0, 100] : ["auto", "auto"]}
                tickFormatter={(v: number) => (option.isPercent ? `${v}%` : formatCompact(v))}
              />
              <Tooltip
                formatter={(value: number) => [formatValue(value), option.label]}
                contentStyle={{
                  background: "rgba(10,12,19,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              />
              <Line
                type="monotone"
                dataKey={option.key}
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "var(--primary)" }}
                activeDot={{ r: 4 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
