"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { formatCompactNum, type IFoldSentiment } from "@/lib/ifold-data"
import { byLean, bySentiment, type Reaction } from "@/lib/ifold-reactions"
import type { DrilldownState } from "@/components/ifold/drilldown"

const SENTIMENT_COLORS: Record<IFoldSentiment, string> = {
  positive: "var(--positive)",
  neutral: "var(--neutral)",
  negative: "var(--negative)",
}

interface Slice {
  name: string
  value: number
  color: string
  drill: DrilldownState
}

function SentimentDonut({
  title,
  subtitle,
  slices,
  centerValue,
  centerLabel,
  onDrill,
}: {
  title: string
  subtitle: string
  slices: Slice[]
  centerValue: string
  centerLabel: string
  onDrill: (state: DrilldownState) => void
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  return (
    <div className="glass-panel flex flex-col rounded-2xl p-5">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      <div className="relative mt-2 h-[210px]">
        {total === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-muted-foreground">No data yet</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={2}
                  strokeWidth={0}
                  onClick={(entry: any) => entry?.drill && onDrill(entry.drill)}
                >
                  {slices.map((s) => (
                    <Cell key={s.name} fill={s.color} className="cursor-pointer outline-none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    `${formatCompactNum(value)} (${Math.round((value / total) * 100)}%) — click to view`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="kpi-value text-2xl">{centerValue}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{centerLabel}</p>
            </div>
          </>
        )}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {slices.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => onDrill(s.drill)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name} ({formatCompactNum(s.value)})
          </button>
        ))}
      </div>
    </div>
  )
}

// The centerpiece: three donuts — how the iPhone Fold launch is landing, how
// our own Fold8 campaign landed, and who wins when people compare the two.
// Every slice and legend entry opens the reactions behind it.
export function IFoldPies({
  apple,
  samsung,
  onDrill,
}: {
  apple: Reaction[]
  samsung: Reaction[]
  onDrill: (state: DrilldownState) => void
}) {
  const sentimentSlices = (items: Reaction[], brandLabel: string): Slice[] =>
    (["positive", "neutral", "negative"] as IFoldSentiment[]).map((s) => {
      const subset = bySentiment(items, s)
      return {
        name: s[0].toUpperCase() + s.slice(1),
        value: subset.length,
        color: SENTIMENT_COLORS[s],
        drill: { title: `${s[0].toUpperCase() + s.slice(1)} — ${brandLabel}`, items: subset },
      }
    })

  const applePositivePct =
    apple.length > 0 ? Math.round((bySentiment(apple, "positive").length / apple.length) * 100) : 0
  const samsungPositivePct =
    samsung.length > 0 ? Math.round((bySentiment(samsung, "positive").length / samsung.length) * 100) : 0

  const samsungLeans = byLean(apple, "samsung")
  const appleLeans = byLean(apple, "apple")
  const leanTotal = samsungLeans.length + appleLeans.length
  const leanSlices: Slice[] = [
    {
      name: "Favor Samsung",
      value: samsungLeans.length,
      color: "var(--positive)",
      drill: { title: "Comparisons favoring Samsung", items: samsungLeans },
    },
    {
      name: "Favor Apple",
      value: appleLeans.length,
      color: "var(--negative)",
      drill: { title: "Comparisons favoring Apple", items: appleLeans },
    },
  ]

  return (
    <div>
      <p className="section-label accent-top mb-4 pt-3">Head to Head — Galaxy Fold8 vs iPhone Fold</p>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <SentimentDonut
          title="iPhone Fold — launch reactions"
          subtitle={`${formatCompactNum(apple.length)} scored reactions to Apple's foldable`}
          slices={sentimentSlices(apple, "iPhone Fold")}
          centerValue={`${applePositivePct}%`}
          centerLabel="positive"
          onDrill={onDrill}
        />
        <SentimentDonut
          title="Galaxy Fold8 — FF8 campaign"
          subtitle={`${formatCompactNum(samsung.length)} comments on our influencer campaign`}
          slices={sentimentSlices(samsung, "Galaxy Fold8")}
          centerValue={`${samsungPositivePct}%`}
          centerLabel="positive"
          onDrill={onDrill}
        />
        <SentimentDonut
          title="Direct comparisons"
          subtitle="When people pit the two folds against each other"
          slices={leanSlices}
          centerValue={leanTotal > 0 ? `${Math.round((samsungLeans.length / leanTotal) * 100)}%` : "—"}
          centerLabel="pick Samsung"
          onDrill={onDrill}
        />
      </div>
    </div>
  )
}
