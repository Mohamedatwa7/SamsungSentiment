"use client"

import { useMemo } from "react"
import { Sparkles, Target } from "lucide-react"

import {
  ifoldOpinions,
  formatCompactNum,
  IFOLD_PLAYBOOK,
  IFOLD_TOPIC_LABELS,
  type IFoldComment,
  type IFoldPost,
  type IFoldTopicKey,
} from "@/lib/ifold-data"

interface TopicInsight {
  key: string
  label: string
  count: number
  share: number
  quote: string | null
}

// Rank topics by volume of positive (strengths) or negative (opportunities)
// reactions, each with its most-liked representative quote.
function topTopics(
  opinions: ReturnType<typeof ifoldOpinions>,
  sentiment: "positive" | "negative",
  limit = 5,
): TopicInsight[] {
  const byTopic = new Map<string, { count: number; quote: string | null; quoteLikes: number }>()
  let total = 0
  for (const o of opinions) {
    if (o.sentiment !== sentiment) continue
    for (const t of o.topics) {
      total++
      const slot = byTopic.get(t) || { count: 0, quote: null, quoteLikes: -1 }
      slot.count++
      const text = (o.text || "").trim()
      if (text.length >= 12 && o.likes > slot.quoteLikes) {
        slot.quote = text.slice(0, 220)
        slot.quoteLikes = o.likes
      }
      byTopic.set(t, slot)
    }
  }
  return [...byTopic.entries()]
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
  tone,
  showPlaybook,
}: {
  items: TopicInsight[]
  tone: "positive" | "negative"
  showPlaybook?: boolean
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
        <div key={item.key}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">
              {formatCompactNum(item.count)} · {item.share}%
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
            <p className="mt-1.5 line-clamp-2 text-xs italic text-muted-foreground">“{item.quote}”</p>
          )}
          {showPlaybook && IFOLD_PLAYBOOK[item.key as IFoldTopicKey] && (
            <p className="mt-1 text-xs text-positive/90">↳ {IFOLD_PLAYBOOK[item.key as IFoldTopicKey]}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// The strategic core of the section: what Apple is winning praise for
// (threat), and where the reaction is negative (our opening) — with a
// suggested Samsung Gulf angle per weakness.
export function IFoldInsights({ posts, comments }: { posts: IFoldPost[]; comments: IFoldComment[] }) {
  const opinions = useMemo(() => ifoldOpinions(posts, comments), [posts, comments])
  const strengths = useMemo(() => topTopics(opinions, "positive"), [opinions])
  const opportunities = useMemo(() => topTopics(opinions, "negative"), [opinions])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-panel rounded-2xl p-5">
        <p className="section-label flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-negative/80" />
          What People Love — Apple&apos;s Strengths
        </p>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          Topics driving positive iPhone Fold reactions — the threats to answer
        </p>
        <InsightList items={strengths} tone="positive" />
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <p className="section-label flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-positive/80" />
          Where Fold8 Can Capitalize — Apple&apos;s Weaknesses
        </p>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          Topics driving criticism of the iPhone Fold, with a suggested Samsung Gulf angle
        </p>
        <InsightList items={opportunities} tone="negative" showPlaybook />
      </div>
    </div>
  )
}
