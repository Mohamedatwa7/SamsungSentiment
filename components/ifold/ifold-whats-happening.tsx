"use client"

import { useMemo, type ReactNode } from "react"
import { Flame, Frown, Newspaper, Scale, Smile } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCompactNum, IFOLD_TOPIC_LABELS } from "@/lib/ifold-data"
import { byLean, byTopic, type Reaction } from "@/lib/ifold-reactions"
import type { DrilldownState } from "@/components/ifold/drilldown"

interface TopicStat {
  key: string
  label: string
  count: number
  positive: number
  negative: number
  posPct: number
  negPct: number
}

const MIN_MENTIONS = 5

// Plain-language digest of the conversation: the hottest topic, what's most
// praised, what's most criticized, the comparison verdict and the press
// tone — each line clickable to read the reactions behind it.
export function IFoldWhatsHappening({
  reactions,
  onDrill,
}: {
  reactions: Reaction[]
  onDrill: (state: DrilldownState) => void
}) {
  const takeaways = useMemo(() => {
    const stats = new Map<string, TopicStat>()
    for (const r of reactions) {
      for (const t of r.topics) {
        const s = stats.get(t) || {
          key: t,
          label: IFOLD_TOPIC_LABELS[t] || t.replace(/_/g, " "),
          count: 0,
          positive: 0,
          negative: 0,
          posPct: 0,
          negPct: 0,
        }
        s.count++
        if (r.sentiment === "positive") s.positive++
        if (r.sentiment === "negative") s.negative++
        stats.set(t, s)
      }
    }
    const topics = [...stats.values()].map((s) => ({
      ...s,
      posPct: s.count > 0 ? Math.round((s.positive / s.count) * 100) : 0,
      negPct: s.count > 0 ? Math.round((s.negative / s.count) * 100) : 0,
    }))

    const eligible = topics.filter((t) => t.count >= MIN_MENTIONS)
    const hottest = [...topics].sort((a, b) => b.count - a.count)[0]
    const mostPraised = [...eligible].sort((a, b) => b.posPct - a.posPct || b.count - a.count)[0]
    const mostCriticized = [...eligible].sort((a, b) => b.negPct - a.negPct || b.count - a.count)[0]

    const samsungLeans = byLean(reactions, "samsung")
    const appleLeans = byLean(reactions, "apple")
    const leanTotal = samsungLeans.length + appleLeans.length

    const news = reactions.filter((r) => r.platform === "news")
    const newsPositive = news.filter((r) => r.sentiment === "positive").length
    const newsNegative = news.filter((r) => r.sentiment === "negative").length

    const out: {
      icon: typeof Flame
      iconCls: string
      text: ReactNode
      drill: DrilldownState
    }[] = []

    if (hottest) {
      out.push({
        icon: Flame,
        iconCls: "text-accent",
        text: (
          <>
            The <b>iPhone Fold</b> conversation is dominated by <b>{hottest.label}</b> —{" "}
            {formatCompactNum(hottest.count)} mentions,{" "}
            {hottest.negPct >= hottest.posPct
              ? `${hottest.negPct}% of them critical`
              : `${hottest.posPct}% of them positive`}
            .
          </>
        ),
        drill: {
          title: `iPhone Fold · ${hottest.label} — all mentions`,
          items: byTopic(reactions, hottest.key),
        },
      })
    }
    if (mostPraised && mostPraised.posPct > 0) {
      out.push({
        icon: Smile,
        iconCls: "text-negative", // praise for Apple = threat to us
        text: (
          <>
            What people praise most about the <b>iPhone Fold</b>: <b>{mostPraised.label}</b> (
            {mostPraised.posPct}% positive of {formatCompactNum(mostPraised.count)} mentions).
          </>
        ),
        drill: {
          title: `iPhone Fold · ${mostPraised.label} — positive reactions`,
          items: byTopic(reactions, mostPraised.key, "positive"),
        },
      })
    }
    if (mostCriticized && mostCriticized.negPct > 0) {
      out.push({
        icon: Frown,
        iconCls: "text-positive", // criticism of Apple = our opening
        text: (
          <>
            What they criticize most about the <b>iPhone Fold</b>: <b>{mostCriticized.label}</b> (
            {mostCriticized.negPct}% negative of {formatCompactNum(mostCriticized.count)} mentions) —
            an opening for the <b>Galaxy Fold8</b>.
          </>
        ),
        drill: {
          title: `iPhone Fold · ${mostCriticized.label} — critical reactions`,
          items: byTopic(reactions, mostCriticized.key, "negative"),
        },
      })
    }
    if (leanTotal >= MIN_MENTIONS) {
      const pct = Math.round((samsungLeans.length / leanTotal) * 100)
      out.push({
        icon: Scale,
        iconCls: pct >= 50 ? "text-positive" : "text-negative",
        text: (
          <>
            When people compare the <b>iPhone Fold</b> with the <b>Galaxy Fold8</b> directly,{" "}
            <b>{pct}% side with Samsung</b> ({formatCompactNum(samsungLeans.length)} vs{" "}
            {formatCompactNum(appleLeans.length)}).
          </>
        ),
        drill: { title: "iPhone Fold vs Galaxy Fold8 — comparisons favoring Samsung", items: samsungLeans },
      })
    }
    if (news.length >= MIN_MENTIONS) {
      const tone =
        newsPositive > newsNegative ? "leaning positive" : newsNegative > newsPositive ? "leaning critical" : "neutral"
      out.push({
        icon: Newspaper,
        iconCls: "text-muted-foreground",
        text: (
          <>
            Press coverage of the <b>iPhone Fold launch</b> is <b>{tone}</b>:{" "}
            {formatCompactNum(news.length)} scored headlines ({formatCompactNum(newsPositive)} positive
            / {formatCompactNum(newsNegative)} critical).
          </>
        ),
        drill: { title: "iPhone Fold launch — scored press headlines", items: news },
      })
    }
    return out
  }, [reactions])

  if (takeaways.length === 0) return null

  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="section-label mb-3">What&apos;s Happening — At a Glance</p>
      <div className="space-y-1">
        {takeaways.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onDrill(t.drill)}
            className="group flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
          >
            <t.icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.iconCls)} />
            <p className="flex-1 text-sm leading-snug text-muted-foreground [&>b]:font-semibold [&>b]:text-foreground">
              {t.text}
            </p>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/80">
              View ↗
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
