"use client"

import { useState } from "react"
import { Activity, ExternalLink, Eye, Heart, MessageSquare, Share2, ThumbsUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCompact, formatRate, videoPositivePercent, type UnpackedVideo } from "@/lib/unpacked-data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { SentimentBadge, SentimentBar } from "@/components/unpacked/sentiment-badge"

function PlatformBadge({ platform }: { platform: "instagram" | "tiktok" | "youtube" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        platform === "instagram"
          ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400"
          : platform === "youtube"
            ? "border-red-500/30 bg-red-500/10 text-red-400"
            : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
      )}
    >
      {platform === "instagram" ? "Instagram" : platform === "youtube" ? "YouTube" : "TikTok"}
    </span>
  )
}

function VideoCard({ video }: { video: UnpackedVideo }) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const scraped = video.comments.length
  const positivePercent = videoPositivePercent(video)

  return (
    <Card className="glass-panel flex flex-col overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{video.influencer.displayName}</CardTitle>
            <CardDescription className="truncate text-xs">@{video.influencer.username}</CardDescription>
          </div>
          <PlatformBadge platform={video.platform} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {/* Playable embed — the video runs directly inside the dashboard */}
        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-black/40">
          {video.embedUrl ? (
            <iframe
              src={video.embedUrl}
              title={`${video.influencer.displayName} — Galaxy Unpacked video`}
              className="absolute inset-0 h-full w-full"
              loading="lazy"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              scrolling="no"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Video unavailable
            </div>
          )}
        </div>

        {/* Engagement rate + comment count + comment sentiment, side by side */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
            <p className="section-label flex items-center gap-1 truncate">
              <Activity className="h-3 w-3 shrink-0" /> Engage
            </p>
            <p className="kpi-value mt-1 text-xl">{formatRate(video.engagementRate)}</p>
          </div>
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/10"
          >
            <p className="section-label flex items-center gap-1 truncate">
              <MessageSquare className="h-3 w-3 shrink-0" /> Comments
            </p>
            <p className="kpi-value mt-1 text-xl">{formatCompact(video.commentsCount)}</p>
          </button>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
            <p className="section-label flex items-center gap-1 truncate">
              <ThumbsUp className="h-3 w-3 shrink-0" /> Positive
            </p>
            <p
              className={cn(
                "kpi-value mt-1 text-xl",
                positivePercent != null && positivePercent >= 60 && "text-positive",
                positivePercent != null && positivePercent < 40 && "text-negative",
              )}
            >
              {positivePercent == null ? "—" : `${positivePercent}%`}
            </p>
          </div>
        </div>

        {/* Views / likes / shares */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> {formatCompact(video.views)}
          </span>
          <span className="flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" /> {formatCompact(video.likes)}
          </span>
          <span className="flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5" /> {formatCompact(video.sharesCount)}
          </span>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Comment sentiment split */}
        <div className="mt-auto space-y-1.5">
          <SentimentBar
            positive={video.sentiment.positive}
            neutral={video.sentiment.neutral}
            negative={video.sentiment.negative}
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="text-positive">{video.sentiment.positive} positive</span>
            <span>{video.sentiment.neutral} neutral</span>
            <span className="text-negative">{video.sentiment.negative} negative</span>
          </div>
        </div>
      </CardContent>

      {/* Per-video comment browser with sentiment on every comment */}
      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Comments — {video.influencer.displayName}
            </DialogTitle>
            <DialogDescription>
              {formatCompact(video.commentsCount)} on {video.platform === "instagram" ? "Instagram" : "TikTok"} ·{" "}
              {scraped} scraped and scored for sentiment
            </DialogDescription>
          </DialogHeader>
          <div className="-mr-2 max-h-[60vh] space-y-2 overflow-y-auto pr-2">
            {scraped === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Comments will appear after the next scheduled sync scrapes this video.
              </p>
            )}
            {video.comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-muted-foreground">@{c.username}</p>
                    <p className="mt-1 text-sm leading-relaxed">{c.text}</p>
                  </div>
                  <SentimentBadge sentiment={c.sentiment} />
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {formatCompact(c.likes)}
                  </span>
                  {c.publishedAt && <span>{new Date(c.publishedAt).toLocaleDateString()}</span>}
                  {!c.analyzed && <span className="italic">keyword estimate — AI scoring pending</span>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export function UnpackedVideoCards({ videos }: { videos: UnpackedVideo[] }) {
  if (videos.length === 0) return null
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  )
}
