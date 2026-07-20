"use client"

import { useMemo, useState } from "react"
import { Heart, MessageSquare } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCompact, type UnpackedPayload, type UnpackedSentiment } from "@/lib/unpacked-data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { SentimentBadge } from "@/components/unpacked/sentiment-badge"

const PAGE = 50

type Filter = "all" | UnpackedSentiment

// Every scraped campaign comment across all influencer videos, each with its
// AI sentiment — the same treatment comments get on the Social Reviews
// dashboard.
export function UnpackedCommentsFeed({ data }: { data: UnpackedPayload }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [visible, setVisible] = useState(PAGE)

  const allComments = useMemo(
    () =>
      data.videos
        .flatMap((v) =>
          v.comments.map((c) => ({
            ...c,
            videoId: v.id,
            influencer: v.influencer.displayName,
            platform: v.platform,
          })),
        )
        .sort((a, b) => b.likes - a.likes),
    [data],
  )

  const filtered = useMemo(
    () => (filter === "all" ? allComments : allComments.filter((c) => c.sentiment === filter)),
    [allComments, filter],
  )

  const counts = useMemo(
    () => ({
      all: allComments.length,
      positive: allComments.filter((c) => c.sentiment === "positive").length,
      neutral: allComments.filter((c) => c.sentiment === "neutral").length,
      negative: allComments.filter((c) => c.sentiment === "negative").length,
    }),
    [allComments],
  )

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "positive", label: "Positive" },
    { key: "neutral", label: "Neutral" },
    { key: "negative", label: "Negative" },
  ]

  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Campaign Comments
            </CardTitle>
            <CardDescription>
              {formatCompact(counts.all)} comments across {data.totals.videos} videos, AI-scored for sentiment
            </CardDescription>
          </div>
          <div className="flex gap-1.5">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFilter(f.key)
                  setVisible(PAGE)
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label} ({formatCompact(counts[f.key])})
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No comments yet.</p>
        )}
        {filtered.slice(0, visible).map((c) => (
          <div key={`${c.videoId}-${c.id}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-medium">@{c.username}</span>
                  {" · on "}
                  {c.influencer}
                  {"'s "}
                  {c.platform === "instagram" ? "Instagram" : "TikTok"} video
                </p>
                <p className="mt-1 text-sm leading-relaxed">{c.text}</p>
              </div>
              <SentimentBadge sentiment={c.sentiment} />
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" /> {formatCompact(c.likes)}
              </span>
              {c.publishedAt && <span>{new Date(c.publishedAt).toLocaleDateString()}</span>}
            </div>
          </div>
        ))}
        {filtered.length > visible && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Show more ({filtered.length - visible} remaining)
          </button>
        )}
      </CardContent>
    </Card>
  )
}
