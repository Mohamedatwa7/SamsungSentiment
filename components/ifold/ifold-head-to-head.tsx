"use client"

import { useMemo } from "react"
import { Swords } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  ifoldOpinions,
  formatCompactNum,
  IFOLD_TOPICS,
  type IFoldComment,
  type IFoldPost,
  type IFoldSamsungBaseline,
} from "@/lib/ifold-data"

function SentimentSplitBar({
  positive,
  neutral,
  negative,
}: {
  positive: number
  neutral: number
  negative: number
}) {
  const total = positive + neutral + negative
  if (total === 0) return <div className="h-2 rounded-full bg-white/[0.06]" />
  return (
    <div className="flex h-2 overflow-hidden rounded-full">
      <div style={{ width: `${(positive / total) * 100}%`, background: "var(--positive)" }} />
      <div style={{ width: `${(neutral / total) * 100}%`, background: "var(--neutral)" }} />
      <div style={{ width: `${(negative / total) * 100}%`, background: "var(--negative)" }} />
    </div>
  )
}

// Net positivity in [-100, 100]; null when the sample is too thin to call.
function net(pos: number, neg: number): number | null {
  const total = pos + neg
  return total >= 5 ? Math.round(((pos - neg) / total) * 100) : null
}

// Apple's live launch reaction vs our own Fold8 campaign corpus — overall
// tone plus a topic-by-topic scorecard.
export function IFoldHeadToHead({
  posts,
  comments,
  baseline,
}: {
  posts: IFoldPost[]
  comments: IFoldComment[]
  baseline: IFoldSamsungBaseline
}) {
  const apple = useMemo(() => {
    const opinions = ifoldOpinions(posts, comments)
    const sentiment = { positive: 0, neutral: 0, negative: 0 }
    const topics: Record<string, { positive: number; negative: number }> = {}
    for (const o of opinions) {
      sentiment[o.sentiment]++
      for (const t of o.topics) {
        const slot = (topics[t] ||= { positive: 0, negative: 0 })
        if (o.sentiment === "positive") slot.positive++
        else if (o.sentiment === "negative") slot.negative++
      }
    }
    return { sentiment, topics, total: opinions.length }
  }, [posts, comments])

  const appleTotal = apple.sentiment.positive + apple.sentiment.neutral + apple.sentiment.negative
  const samsungTotal =
    baseline.sentiment.positive + baseline.sentiment.neutral + baseline.sentiment.negative

  const applePct = appleTotal > 0 ? Math.round((apple.sentiment.positive / appleTotal) * 100) : 0
  const samsungPct =
    samsungTotal > 0 ? Math.round((baseline.sentiment.positive / samsungTotal) * 100) : 0

  const rows = IFOLD_TOPICS.map((topic) => {
    const a = apple.topics[topic.key] || { positive: 0, negative: 0 }
    const s = baseline.topics[topic.key] || { positive: 0, negative: 0 }
    return { topic, apple: a, samsung: s, appleNet: net(a.positive, a.negative), samsungNet: net(s.positive, s.negative) }
  })
    .filter((r) => r.apple.positive + r.apple.negative > 0 || r.samsung.positive + r.samsung.negative > 0)
    .sort((a, b) => b.apple.positive + b.apple.negative - (a.apple.positive + a.apple.negative))

  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="section-label flex items-center gap-1.5">
        <Swords className="h-3.5 w-3.5 text-muted-foreground/70" />
        Head to Head — iPhone Fold vs Galaxy Fold8
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Apple: live launch reactions · Samsung: {formatCompactNum(baseline.analyzed)} analyzed comments from the
        Galaxy Unpacked &amp; FF8 influencer campaign
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">Apple iPhone Fold</p>
            <p className="kpi-value text-2xl">{applePct}%<span className="ml-1 text-xs font-normal text-muted-foreground">positive</span></p>
          </div>
          <div className="mt-2">
            <SentimentSplitBar {...apple.sentiment} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {formatCompactNum(appleTotal)} scored reactions
          </p>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">Galaxy Fold8 / Fold8 Ultra</p>
            <p className="kpi-value text-2xl">{samsungPct}%<span className="ml-1 text-xs font-normal text-muted-foreground">positive</span></p>
          </div>
          <div className="mt-2">
            <SentimentSplitBar {...baseline.sentiment} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {formatCompactNum(samsungTotal)} scored reactions (campaign corpus)
          </p>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Topic</th>
                <th className="pb-2 pr-4 font-medium">iPhone Fold reaction</th>
                <th className="pb-2 pr-4 font-medium">Fold8 reaction</th>
                <th className="pb-2 font-medium">Read</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ topic, apple: a, samsung: s, appleNet, samsungNet }) => {
                const verdict =
                  appleNet == null
                    ? { label: "Thin data", cls: "text-muted-foreground" }
                    : appleNet <= -20
                      ? { label: "Apple weakness — capitalize", cls: "text-positive" }
                      : appleNet >= 20 && (samsungNet == null || appleNet > samsungNet)
                        ? { label: "Apple strength — monitor", cls: "text-negative" }
                        : { label: "Contested", cls: "text-muted-foreground" }
                return (
                  <tr key={topic.key} className="border-b border-white/[0.04]">
                    <td className="py-2.5 pr-4 font-medium">{topic.label}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-positive">{formatCompactNum(a.positive)}▲</span>
                      <span className="mx-1 text-muted-foreground">/</span>
                      <span className="text-negative">{formatCompactNum(a.negative)}▼</span>
                      {appleNet != null && (
                        <span className="ml-2 text-[11px] text-muted-foreground">net {appleNet > 0 ? "+" : ""}{appleNet}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      {s.positive + s.negative > 0 ? (
                        <>
                          <span className="text-positive">{formatCompactNum(s.positive)}▲</span>
                          <span className="mx-1 text-muted-foreground">/</span>
                          <span className="text-negative">{formatCompactNum(s.negative)}▼</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={cn("py-2.5 text-xs font-medium", verdict.cls)}>{verdict.label}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
