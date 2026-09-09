"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatCompactNum, type IFoldSentiment } from "@/lib/ifold-data"
import type { Reaction } from "@/lib/ifold-reactions"
import type { DrilldownState } from "@/components/ifold/drilldown"

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
  positive: number
  neutral: number
  negative: number
}

const SENTIMENT_COLORS: Record<IFoldSentiment, string> = {
  positive: "var(--positive)",
  neutral: "var(--neutral)",
  negative: "var(--negative)",
}

// One simple chart: how many reactions landed each day and how they leaned.
// Click any day to read that day's reactions.
export function IFoldTrend({
  reactions,
  launchAt,
  onDrill,
}: {
  reactions: Reaction[]
  launchAt: string
  onDrill: (state: DrilldownState) => void
}) {
  const data = useMemo<DayRow[]>(() => {
    const days = new Map<string, DayRow>()
    for (const r of reactions) {
      const day = gulfDay(r.publishedAt)
      if (!day) continue
      let row = days.get(day)
      if (!row) {
        row = {
          day,
          label: new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          positive: 0,
          neutral: 0,
          negative: 0,
        }
        days.set(day, row)
      }
      row[r.sentiment]++
    }
    return [...days.values()].sort((a, b) => a.day.localeCompare(b.day))
  }, [reactions])

  const launchDay = gulfDay(launchAt)
  const launchLabel = data.find((d) => d.day === launchDay)?.label

  const drillDay = (row: DayRow | undefined) => {
    if (!row) return
    onDrill({
      title: `Reactions on ${row.label}`,
      subtitle: `${formatCompactNum(row.positive)} positive · ${formatCompactNum(row.neutral)} neutral · ${formatCompactNum(row.negative)} negative`,
      items: reactions.filter((r) => gulfDay(r.publishedAt) === row.day),
    })
  }

  if (data.length === 0) return null

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="section-label">iPhone Fold — Reactions Per Day</p>
          <p className="mt-1 text-xs text-muted-foreground">
            How many people reacted to Apple&apos;s foldable each day and how it leaned — click a day to
            read them
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {(Object.keys(SENTIMENT_COLORS) as IFoldSentiment[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5 capitalize">
              <span className="h-2 w-2 rounded-full" style={{ background: SENTIMENT_COLORS[s] }} />
              {s}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: -18 }}
          onClick={(state: any) => {
            const label = state?.activeLabel
            if (label) drillDay(data.find((d) => d.label === label))
          }}
          className="cursor-pointer"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          {launchLabel && (
            <ReferenceLine
              x={launchLabel}
              stroke="var(--accent)"
              strokeDasharray="4 4"
              label={{ value: "Apple event", fill: "var(--accent)", fontSize: 10, position: "top" }}
            />
          )}
          <Bar dataKey="positive" stackId="s" fill={SENTIMENT_COLORS.positive} />
          <Bar dataKey="neutral" stackId="s" fill={SENTIMENT_COLORS.neutral} />
          <Bar dataKey="negative" stackId="s" fill={SENTIMENT_COLORS.negative} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
