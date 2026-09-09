"use client"

import { useMemo } from "react"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { IFoldComment, IFoldPost } from "@/lib/ifold-data"

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "oklch(0.65 0.2 330)",
  tiktok: "oklch(0.78 0.13 210)",
  twitter: "oklch(0.62 0.19 258)",
  youtube: "oklch(0.64 0.19 22)",
  news: "oklch(0.6 0.015 260)",
}

// Gulf-time (UTC+4) calendar day for bucketing.
function gulfDay(iso: string | null): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (isNaN(t)) return null
  return new Date(t + 4 * 3600000).toISOString().slice(0, 10)
}

interface DayRow {
  day: string
  label: string
  instagram: number
  tiktok: number
  twitter: number
  youtube: number
  news: number
  comments: number
  positivePct: number | null
}

// Daily conversation volume by channel, with the positive-sentiment share
// overlaid — the launch-night spike and the tone shift after it.
export function IFoldTrend({
  posts,
  comments,
  launchAt,
}: {
  posts: IFoldPost[]
  comments: IFoldComment[]
  launchAt: string
}) {
  const data = useMemo<DayRow[]>(() => {
    const days = new Map<string, DayRow>()
    const ensure = (day: string): DayRow => {
      let row = days.get(day)
      if (!row) {
        row = {
          day,
          label: new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          instagram: 0,
          tiktok: 0,
          twitter: 0,
          youtube: 0,
          news: 0,
          comments: 0,
          positivePct: null,
        }
        days.set(day, row)
      }
      return row
    }

    const sentimentByDay = new Map<string, { pos: number; total: number }>()
    const addSentiment = (day: string | null, sentiment: string) => {
      if (!day) return
      const slot = sentimentByDay.get(day) || { pos: 0, total: 0 }
      slot.total++
      if (sentiment === "positive") slot.pos++
      sentimentByDay.set(day, slot)
    }

    for (const p of posts) {
      const day = gulfDay(p.publishedAt)
      if (!day) continue
      const row = ensure(day)
      row[p.platform]++
      if (p.analysis) addSentiment(day, p.analysis.sentiment)
    }
    for (const c of comments) {
      const day = gulfDay(c.publishedAt)
      if (!day) continue
      ensure(day).comments++
      if (c.analyzed) addSentiment(day, c.sentiment)
    }

    for (const [day, slot] of sentimentByDay) {
      if (slot.total >= 3) ensure(day).positivePct = Math.round((slot.pos / slot.total) * 100)
    }

    return [...days.values()].sort((a, b) => a.day.localeCompare(b.day))
  }, [posts, comments])

  const launchDay = gulfDay(launchAt)
  const launchLabel = data.find((d) => d.day === launchDay)?.label

  if (data.length === 0) return null

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="section-label">Daily Buzz</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Posts &amp; articles per day by channel · line = % positive on the iPhone Fold
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {Object.entries(PLATFORM_COLORS).map(([key, color]) => (
            <span key={key} className="flex items-center gap-1.5 capitalize">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              {key === "twitter" ? "X" : key}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            yAxisId="pct"
            orientation="right"
            domain={[0, 100]}
            hide
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [value, name === "positivePct" ? "% positive" : name === "twitter" ? "X" : name]}
          />
          {launchLabel && (
            <ReferenceLine
              x={launchLabel}
              stroke="var(--accent)"
              strokeDasharray="4 4"
              label={{ value: "Apple event", fill: "var(--accent)", fontSize: 10, position: "top" }}
            />
          )}
          {(["news", "twitter", "youtube", "tiktok", "instagram"] as const).map((key) => (
            <Bar key={key} dataKey={key} stackId="volume" fill={PLATFORM_COLORS[key]} radius={key === "instagram" ? [3, 3, 0, 0] : undefined} />
          ))}
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="positivePct"
            stroke="var(--positive)"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "var(--positive)" }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
