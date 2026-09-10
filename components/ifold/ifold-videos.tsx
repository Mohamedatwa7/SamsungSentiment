"use client"

// Most-relevant GCC video coverage of the iPhone Duo — same card layout as
// the Galaxy Unpacked section (click-to-load embed, engagement, per-video
// comment browser). Two lenses: everything about the Duo, and head-to-head
// "Duo vs Fold8" comparison videos specifically.

import { useMemo, useState } from "react"
import {
  Activity,
  ExternalLink,
  Eye,
  Heart,
  Languages,
  Loader2,
  MessageSquare,
  Play,
  Share2,
  ThumbsUp,
  Video,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useCommentTranslations } from "@/hooks/use-comment-translations"
import {
  formatCompactNum,
  type IFoldComment,
  type IFoldPost,
  type IFoldSentiment,
} from "@/lib/ifold-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SentimentBadge, SentimentBar } from "@/components/unpacked/sentiment-badge"

const SHOWN = 8

// Direct brand comparison markers (EN + AR) in the caption/title.
const VS_PATTERN =
  /\bvs\.?\b|versus|fold\s*8|z\s*fold|galaxy|samsung|مقارنة|ضد|سامسونج|جالكسي|فولد\s*[٨8]/i

type VideoPlatform = "instagram" | "tiktok" | "youtube"

function isVideoPlatform(p: IFoldPost["platform"]): p is VideoPlatform {
  return p === "instagram" || p === "tiktok" || p === "youtube"
}

// Embeds are derived from the post URL — no self-hosted thumbnails exist for
// competitor content, so the click-to-load poster falls back to the caption.
function embedUrlFor(post: IFoldPost): string | null {
  if (post.platform === "youtube") {
    const id =
      post.id.replace(/^ifold_yt_/, "") ||
      post.url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{6,})/)?.[1]
    return id ? `https://www.youtube.com/embed/${id}` : null
  }
  if (post.platform === "tiktok") {
    const id = post.url.match(/video\/(\d+)/)?.[1]
    return id ? `https://www.tiktok.com/embed/v2/${id}` : null
  }
  const sc = post.url.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)?.[1]
  return sc ? `https://www.instagram.com/p/${sc}/embed` : null
}

interface RankedVideo {
  post: IFoldPost
  embedUrl: string
  comments: IFoldComment[]
  comparison: boolean
}

// The most-liked scraped comments, shown inline under the video.
const SAMPLE_COUNT = 3

function sampleComments(v: RankedVideo): IFoldComment[] {
  return v.comments.slice().sort((a, b) => b.likes - a.likes).slice(0, SAMPLE_COUNT)
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: "var(--positive)",
  negative: "var(--negative)",
  neutral: "var(--neutral)",
}

function PlatformBadge({ platform }: { platform: VideoPlatform }) {
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

function VideoCard({
  video,
  displayText,
  onCommentsOpened,
}: {
  video: RankedVideo
  displayText: (c: { id: string; text: string }) => string
  onCommentsOpened: (video: RankedVideo) => void
}) {
  const { post, comments } = video
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [playerRequested, setPlayerRequested] = useState(false)
  const [sentimentFilter, setSentimentFilter] = useState<"all" | IFoldSentiment>("all")
  const samples = sampleComments(video)

  const openComments = () => {
    setCommentsOpen(true)
    onCommentsOpened(video)
  }

  const sentimentCounts = useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0 }
    for (const c of comments) counts[c.sentiment]++
    return counts
  }, [comments])

  const dialogComments = useMemo(() => {
    const list = sentimentFilter === "all" ? comments : comments.filter((c) => c.sentiment === sentimentFilter)
    return list.slice().sort((a, b) => b.likes - a.likes)
  }, [comments, sentimentFilter])

  const s = post.commentSentiment
  const scored = s.positive + s.neutral + s.negative
  const positivePercent = scored > 0 ? Math.round((s.positive / scored) * 100) : null
  const engagementRate = post.views > 0 ? (post.likes + post.commentsCount + post.shares) / post.views : null

  return (
    <Card className="glass-panel flex flex-col overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base" dir="auto">
              @{post.author}
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5 text-xs">
              {post.gcc && (
                <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-px text-[10px] text-accent">
                  GCC
                </span>
              )}
              {video.comparison && <span className="truncate">vs Fold8 comparison</span>}
            </CardDescription>
          </div>
          <PlatformBadge platform={post.platform as VideoPlatform} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {/* Playable embed — click-to-load, like the Unpacked section */}
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-xl border border-white/[0.08] bg-black/40",
            post.platform === "youtube" ? "aspect-video" : "aspect-[9/16]",
          )}
        >
          {playerRequested ? (
            <iframe
              src={video.embedUrl}
              title={`@${post.author} — iPhone Duo video`}
              className="absolute inset-0 h-full w-full"
              loading="lazy"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              scrolling="no"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlayerRequested(true)}
              className="group absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-slate-900/60 via-black/60 to-black/80 p-4 text-center"
            >
              <span
                className={cn(
                  "relative z-10 flex h-14 w-14 items-center justify-center rounded-full border backdrop-blur-sm transition-transform group-hover:scale-110",
                  post.platform === "instagram"
                    ? "border-fuchsia-400/40 bg-fuchsia-500/20"
                    : post.platform === "youtube"
                      ? "border-red-400/40 bg-red-500/20"
                      : "border-cyan-400/40 bg-cyan-500/20",
                )}
              >
                <Play
                  className={cn(
                    "ml-0.5 h-6 w-6",
                    post.platform === "instagram"
                      ? "text-fuchsia-300"
                      : post.platform === "youtube"
                        ? "text-red-300"
                        : "text-cyan-300",
                  )}
                  fill="currentColor"
                />
              </span>
              <span className="relative z-10 line-clamp-4 text-xs leading-relaxed text-muted-foreground" dir="auto">
                {post.title || `@${post.author}`}
              </span>
              <span className="relative z-10 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tap to play
              </span>
            </button>
          )}
        </div>

        {/* Engagement rate + comment count + comment sentiment, side by side */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
            <p className="section-label flex items-center gap-1 truncate">
              <Activity className="h-3 w-3 shrink-0" /> Engage
            </p>
            <p className="kpi-value mt-1 text-xl">
              {engagementRate == null ? "—" : `${(engagementRate * 100).toFixed(1)}%`}
            </p>
          </div>
          <button
            type="button"
            onClick={openComments}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/10"
          >
            <p className="section-label flex items-center gap-1 truncate">
              <MessageSquare className="h-3 w-3 shrink-0" /> Comments
            </p>
            <p className="kpi-value mt-1 text-xl">{formatCompactNum(post.commentsCount)}</p>
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
            <Eye className="h-3.5 w-3.5" /> {formatCompactNum(post.views)}
          </span>
          <span className="flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" /> {formatCompactNum(post.likes)}
          </span>
          <span className="flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5" /> {formatCompactNum(post.shares)}
          </span>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Comment sentiment split */}
        <div className="mt-auto space-y-1.5">
          <SentimentBar positive={s.positive} neutral={s.neutral} negative={s.negative} />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="text-positive">{s.positive} positive</span>
            <span>{s.neutral} neutral</span>
            <span className="text-negative">{s.negative} negative</span>
          </div>
        </div>

        {/* Inline top comments — the card reads as a story without opening anything */}
        {samples.length > 0 && (
          <div className="space-y-1.5 border-l border-white/[0.08] pl-3">
            {samples.map((c) => (
              <p key={c.id} className="line-clamp-2 text-xs leading-relaxed text-muted-foreground" dir="auto">
                <span
                  className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full align-middle"
                  style={{ background: SENTIMENT_DOT[c.sentiment] }}
                />
                “{displayText({ id: c.id, text: c.text })}”
                {c.likes > 0 && <span className="ml-1.5 opacity-70">♥ {formatCompactNum(c.likes)}</span>}
              </p>
            ))}
            {comments.length > samples.length && (
              <button
                type="button"
                onClick={openComments}
                className="text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                Read all {formatCompactNum(comments.length)} scraped comments
              </button>
            )}
          </div>
        )}
      </CardContent>

      {/* Per-video comment browser with sentiment on every comment */}
      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle dir="auto">Comments — @{post.author}</DialogTitle>
            <DialogDescription>
              {formatCompactNum(post.commentsCount)} on the platform · {comments.length} scraped and scored
            </DialogDescription>
          </DialogHeader>

          {/* Sentiment filter — counts double as the video's reaction split */}
          {comments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: "all", label: `All (${comments.length})` },
                  { key: "positive", label: `Positive (${sentimentCounts.positive})` },
                  { key: "neutral", label: `Neutral (${sentimentCounts.neutral})` },
                  { key: "negative", label: `Negative (${sentimentCounts.negative})` },
                ] as { key: "all" | IFoldSentiment; label: string }[]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setSentimentFilter(f.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    sentimentFilter === f.key
                      ? f.key === "positive"
                        ? "border-positive/50 bg-positive/15 text-positive"
                        : f.key === "negative"
                          ? "border-negative/50 bg-negative/15 text-negative"
                          : "border-primary/50 bg-primary/15 text-foreground"
                      : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <div className="-mr-2 max-h-[60vh] space-y-2 overflow-y-auto pr-2">
            {comments.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Comments will appear after the next scheduled sync scrapes this video.
              </p>
            )}
            {comments.length > 0 && dialogComments.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No {sentimentFilter} comments on this video.
              </p>
            )}
            {dialogComments.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-muted-foreground" dir="auto">
                      @{c.author}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed" dir="auto">
                      {displayText({ id: c.id, text: c.text })}
                    </p>
                  </div>
                  <SentimentBadge sentiment={c.sentiment} />
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {formatCompactNum(c.likes)}
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

export function IFoldVideos({ posts, comments }: { posts: IFoldPost[]; comments: IFoldComment[] }) {
  const [lens, setLens] = useState<"duo" | "vs">("duo")
  const { showTranslations, setShowTranslations, translating, ensureTranslations, displayText } =
    useCommentTranslations()

  const { duo, vs } = useMemo(() => {
    const byPost = new Map<string, IFoldComment[]>()
    for (const c of comments) {
      const list = byPost.get(c.postId)
      if (list) list.push(c)
      else byPost.set(c.postId, [c])
    }

    const ranked: RankedVideo[] = []
    for (const post of posts) {
      if (post.kind !== "social" || !isVideoPlatform(post.platform) || post.focus !== "fold") continue
      const embedUrl = embedUrlFor(post)
      if (!embedUrl) continue
      // Every scraped comment rides along — the browser dialog shows them all.
      const postComments = byPost.get(post.id) || []
      const comparison =
        VS_PATTERN.test(post.title) ||
        post.analysis?.lean != null ||
        postComments.some((c) => c.lean != null)
      ranked.push({ post, embedUrl, comments: postComments, comparison })
    }
    // GCC relevance first, then reach — this is the Gulf team's view.
    ranked.sort((a, b) => Number(b.post.gcc) - Number(a.post.gcc) || b.post.views - a.post.views)
    return { duo: ranked.slice(0, SHOWN), vs: ranked.filter((v) => v.comparison).slice(0, SHOWN) }
  }, [posts, comments])

  const shown = lens === "duo" ? duo : vs
  if (duo.length === 0) return null

  // Only what's on screen gets translated: the inline samples per shown card.
  const translatables = (set: RankedVideo[]) =>
    set.flatMap((v) => sampleComments(v).map((c) => ({ id: c.id, text: c.text })))

  const toggleTranslations = async () => {
    const next = !showTranslations
    setShowTranslations(next)
    if (next) await ensureTranslations(translatables(shown))
  }

  const switchLens = async (key: "duo" | "vs") => {
    setLens(key)
    if (showTranslations) await ensureTranslations(translatables(key === "duo" ? duo : vs))
  }

  // When a comment browser opens with translation on, cover its full list
  // (bounded — the translate API is per-comment).
  const handleCommentsOpened = (v: RankedVideo) => {
    if (showTranslations) {
      void ensureTranslations(v.comments.slice(0, 150).map((c) => ({ id: c.id, text: c.text })))
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 pt-3 accent-top">
        <div>
          <p className="section-label flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5 text-muted-foreground/70" />
            Top Videos — Most Relevant for GCC
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The iPhone Duo videos Gulf audiences are watching — tap to play them right here, click
            Comments to read the scored reactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(
            [
              { key: "duo", label: "iPhone Duo" },
              { key: "vs", label: "Duo vs Fold8" },
            ] as { key: "duo" | "vs"; label: string }[]
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => switchLens(f.key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                lens === f.key
                  ? "border-primary/50 bg-primary/15 text-foreground shadow-[0_0_16px_var(--glow-primary)]"
                  : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={toggleTranslations}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              showTranslations
                ? "border-primary/50 bg-primary/15 text-foreground"
                : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
            )}
          >
            {translating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
            {showTranslations ? "Original" : "Translate"}
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
          No direct Duo-vs-Fold8 comparison videos in this filter yet — they usually land with
          reviewer deep-dives a few days after the keynote.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((v) => (
            <VideoCard key={v.post.id} video={v} displayText={displayText} onCommentsOpened={handleCommentsOpened} />
          ))}
        </div>
      )}
    </div>
  )
}
