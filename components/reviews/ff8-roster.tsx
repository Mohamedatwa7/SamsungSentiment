"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Activity, ExternalLink, Eye, Heart, MessageSquare, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCompact, formatRate, type UnpackedComment, type UnpackedVideo } from "@/lib/unpacked-data"
import type { RosterInfluencer } from "@/lib/roster"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { SentimentBadge, SentimentBar } from "@/components/unpacked/sentiment-badge"

interface RosterVideo extends UnpackedVideo {
  rosterId: string
  rosterName: string
  category: string
}

interface RosterPayload {
  videos: RosterVideo[]
  roster: RosterInfluencer[]
  meta: { generatedAt: string; analyzedComments: number }
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type CategoryFilter = "all" | "Team Galaxy" | "Content Creator"

export function FF8Roster() {
  const { data, isLoading } = useSWR<RosterPayload>("/api/roster", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const [category, setCategory] = useState<CategoryFilter>("all")
  const [dialog, setDialog] = useState<{ title: string; comments: UnpackedComment[] } | null>(null)

  const grouped = useMemo(() => {
    if (!data?.roster) return []
    const roster = category === "all" ? data.roster : data.roster.filter((r) => r.category === category)
    return roster.map((r) => {
      const videos = (data.videos || []).filter((v) => v.rosterId === r.id)
      const views = videos.reduce((s, v) => s + v.views, 0)
      const likes = videos.reduce((s, v) => s + v.likes, 0)
      const comments = videos.reduce((s, v) => s + v.commentsCount, 0)
      const engagements = videos.reduce((s, v) => s + v.engagementCount, 0)
      const sentiment = videos.reduce(
        (acc, v) => ({
          positive: acc.positive + v.sentiment.positive,
          neutral: acc.neutral + v.sentiment.neutral,
          negative: acc.negative + v.sentiment.negative,
        }),
        { positive: 0, neutral: 0, negative: 0 },
      )
      return {
        influencer: r,
        videos,
        views,
        likes,
        comments,
        engagementRate: views > 0 ? Math.round((engagements / views) * 10000) / 100 : null,
        sentiment,
        scraped: videos.reduce((s, v) => s + v.comments.length, 0),
      }
    })
  }, [data, category])

  const totals = useMemo(() => {
    const active = grouped.filter((g) => g.videos.length > 0)
    const views = grouped.reduce((s, g) => s + g.views, 0)
    const comments = grouped.reduce((s, g) => s + g.comments, 0)
    const scraped = grouped.reduce((s, g) => s + g.scraped, 0)
    const positive = grouped.reduce((s, g) => s + g.sentiment.positive, 0)
    const totalSent = grouped.reduce((s, g) => s + g.sentiment.positive + g.sentiment.neutral + g.sentiment.negative, 0)
    const videoCount = grouped.reduce((s, g) => s + g.videos.length, 0)
    return {
      tracked: grouped.length,
      active: active.length,
      videos: videoCount,
      views,
      comments,
      scraped,
      positivePercent: totalSent > 0 ? Math.round((positive / totalSent) * 100) : 0,
    }
  }, [grouped])

  if (isLoading) return <Skeleton className="h-[400px] w-full rounded-lg" />
  if (!data?.roster) return null

  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              FF8 Campaign Roster
            </CardTitle>
            <CardDescription>
              27 campaign influencers — only their FF8 launch videos from the last days are tracked
            </CardDescription>
          </div>
          <div className="flex gap-1.5">
            {(["all", "Team Galaxy", "Content Creator"] as CategoryFilter[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  category === c
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
                )}
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Roster KPIs */}
        <div className="stat-rail divide-none grid grid-cols-2 gap-y-4 lg:grid-cols-6">
          {[
            { label: "Influencers", value: `${totals.tracked}` },
            { label: "With FF8 Video", value: `${totals.active}` },
            { label: "FF8 Videos", value: `${totals.videos}` },
            { label: "Total Views", value: formatCompact(totals.views) },
            { label: "Comments", value: formatCompact(totals.comments) },
            { label: "Positive", value: `${totals.positivePercent}%` },
          ].map((k) => (
            <div key={k.label} className="px-4 py-1 first:pl-0">
              <p className="section-label">{k.label}</p>
              <p className="kpi-value mt-1 text-2xl">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Influencer cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {grouped.map((g) => (
            <div
              key={g.influencer.id}
              className={cn(
                "rounded-xl border border-white/[0.08] bg-white/[0.02] p-4",
                g.videos.length === 0 && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{g.influencer.name}</p>
                  <a
                    href={g.influencer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    @{g.influencer.handle} · {g.influencer.platform === "instagram" ? "Instagram" : "TikTok"}
                  </a>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    g.influencer.category === "Team Galaxy"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-white/[0.1] bg-white/[0.04] text-muted-foreground",
                  )}
                >
                  {g.influencer.category}
                </span>
              </div>

              {g.videos.length === 0 ? (
                <p className="mt-3 text-xs italic text-muted-foreground">
                  No FF8 video captured yet — next sync will pick it up once posted.
                </p>
              ) : (
                <>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {formatCompact(g.views)}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {formatCompact(g.likes)}</span>
                    <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {formatRate(g.engagementRate)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setDialog({
                          title: `${g.influencer.name} — FF8 Comments`,
                          comments: g.videos.flatMap((v) => v.comments).sort((a, b) => b.likes - a.likes),
                        })
                      }
                      className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 transition-colors hover:text-foreground"
                    >
                      <MessageSquare className="h-3 w-3" /> {formatCompact(g.comments)}
                    </button>
                  </div>
                  <div className="mt-2.5 space-y-1">
                    <SentimentBar positive={g.sentiment.positive} neutral={g.sentiment.neutral} negative={g.sentiment.negative} />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span className="text-positive">{g.sentiment.positive} pos</span>
                      <span>{g.sentiment.neutral} neu</span>
                      <span className="text-negative">{g.sentiment.negative} neg</span>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {g.videos.map((v) => (
                      <a
                        key={v.id}
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span className="truncate">
                          {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : ""} ·{" "}
                          {(v.caption || "(no caption)").slice(0, 40)}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{dialog?.title}</DialogTitle>
            <DialogDescription>{dialog?.comments.length} scraped comments, AI-scored</DialogDescription>
          </DialogHeader>
          <div className="-mr-2 max-h-[60vh] space-y-2 overflow-y-auto pr-2">
            {dialog?.comments.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Comments arrive on the next scheduled sync after the video is captured.
              </p>
            )}
            {dialog?.comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-muted-foreground">@{c.username}</p>
                    <p className="mt-1 text-sm leading-relaxed">{c.text}</p>
                  </div>
                  <SentimentBadge sentiment={c.sentiment} />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
