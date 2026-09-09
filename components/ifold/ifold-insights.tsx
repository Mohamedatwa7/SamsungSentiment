"use client"

import { useMemo } from "react"
import { Sparkles, Target } from "lucide-react"

import {
  formatCompactNum,
  IFOLD_PLAYBOOK,
  IFOLD_TOPIC_LABELS,
  type IFoldTopicKey,
} from "@/lib/ifold-data"
import { byTopic, type Reaction } from "@/lib/ifold-reactions"
import type { DrilldownState } from "@/components/ifold/drilldown"

interface TopicInsight {
  key: string
  label: string
  count: number
  share: number
  quote: string | null
}

// Rank topics by volume of positive (strengths) or negative (opportunities)
// reactions, each with its most-liked representative quote.
function topTopics(reactions: Reaction[], sentiment: "positive" | "negative", limit = 5): TopicInsight[] {
  const byTopicMap = new Map<string, { count: number; quote: string | null; quoteLikes: number }>()
  let total = 0
  for (const r of reactions) {
    if (r.sentiment !== sentiment) continue
    for (const t of r.topics) {
      total++
      const slot = byTopicMap.get(t) || { count: 0, quote: null, quoteLikes: -1 }
      slot.count++
      const text = (r.text || "").trim()
      if (text.length >= 12 && r.likes > slot.quoteLikes) {
        slot.quote = text.slice(0, 220)
        slot.quoteLikes = r.likes
      }
      byTopicMap.set(t, slot)
    }
  }
  return [...byTopicMap.entries()]
    .map(([key, v]) => ({
      key,
      label: IFOLD_TOPIC_LABELS[key] || key.replace(/_/g, " "),
      count: v.count,
      share: total > 0 ? Math.round((v.count / total) * 100) : 0,
      quote: v.quote,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function InsightList({
  items,
  reactions,
  tone,
  showPlaybook,
  onDrill,
}: {
  items: TopicInsight[]
  reactions: Reaction[]
  tone: "positive" | "negative"
  showPlaybook?: boolean
  onDrill: (state: DrilldownState) => void
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        Not enough analyzed reactions yet — insights populate as the conversation grows.
      </p>
    )
  }
  const max = items[0].count
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() =>
            onDrill({
              title: `${item.label} — ${tone} reactions`,
              items: byTopic(reactions, item.key, tone),
            })
          }
          className="group block w-full rounded-lg text-left transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium group-hover:text-accent">{item.label}</p>
            <p className="text-xs text-muted-foreground">
              {formatCompactNum(item.count)} · {item.share}% · view ↗
            </p>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(6, (item.count / max) * 100)}%`,
                background: tone === "positive" ? "var(--negative)" : "var(--positive)",
              }}
            />
          </div>
          {item.quote && (
            <p className="mt-1.5 line-clamp-2 text-xs italic text-muted-foreground" dir="auto">
              “{item.quote}”
            </p>
          )}
          {showPlaybook && IFOLD_PLAYBOOK[item.key as IFoldTopicKey] && (
            <p className="mt-1 text-xs text-positive/90">↳ {IFOLD_PLAYBOOK[item.key as IFoldTopicKey]}</p>
          )}
        </button>
      ))}
    </div>
  )
}

// The strategic core: what Apple is winning praise for (threat), and where
// the reaction is negative (our opening) — every topic row is clickable and
// opens the actual reactions behind it.
export function IFoldInsights({
  reactions,
  onDrill,
}: {
  reactions: Reaction[]
  onDrill: (state: DrilldownState) => void
}) {
  const strengths = useMemo(() => topTopics(reactions, "positive"), [reactions])
  const opportunities = useMemo(() => topTopics(reactions, "negative"), [reactions])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-panel rounded-2xl p-5">
        <p className="section-label flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-negative/80" />
          What People Love — Apple&apos;s Strengths
        </p>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          Topics driving positive iPhone Fold reactions — click one to read them
        </p>
        <InsightList items={strengths} reactions={reactions} tone="positive" onDrill={onDrill} />
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <p className="section-label flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-positive/80" />
          Where Fold8 Can Capitalize — Apple&apos;s Weaknesses
        </p>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          Topics driving criticism, with a suggested Samsung Gulf angle — click to read
        </p>
        <InsightList items={opportunities} reactions={reactions} tone="negative" showPlaybook onDrill={onDrill} />
      </div>
    </div>
  )
}
