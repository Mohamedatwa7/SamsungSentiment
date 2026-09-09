"use client"

import { useMemo, useState } from "react"
import { ExternalLink, Languages, Loader2, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { useCommentTranslations } from "@/hooks/use-comment-translations"
import { formatCompactNum, type IFoldComment, type IFoldPost } from "@/lib/ifold-data"
import type { Reaction } from "@/lib/ifold-reactions"
import type { DrilldownState } from "@/components/ifold/drilldown"

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X",
  youtube: "YouTube",
}

// The social posts carrying the conversation, ranked by reach. Click a post
// to read its scraped comments; the external-link icon opens the post itself.
export function IFoldTopPosts({
  posts,
  comments,
  onDrill,
}: {
  posts: IFoldPost[]
  comments: IFoldComment[]
  onDrill: (state: DrilldownState) => void
}) {
  const [shown, setShown] = useState(12)
  const { showTranslations, setShowTranslations, translating, ensureTranslations, displayText } =
    useCommentTranslations()

  const ranked = useMemo(
    () =>
      posts
        .filter((p) => p.kind === "social")
        .sort(
          (a, b) =>
            b.views + b.likes * 20 + b.commentsCount * 40 - (a.views + a.likes * 20 + a.commentsCount * 40),
        ),
    [posts],
  )

  const commentsByPost = useMemo(() => {
    const map = new Map<string, IFoldComment[]>()
    for (const c of comments) {
      const list = map.get(c.postId) || []
      list.push(c)
      map.set(c.postId, list)
    }
    return map
  }, [comments])

  const drillPost = (p: IFoldPost) => {
    const postComments = commentsByPost.get(p.id) || []
    const items: Reaction[] = postComments.map((c) => ({
      id: c.id,
      text: c.text,
      author: c.author,
      platform: c.platform,
      likes: c.likes,
      publishedAt: c.publishedAt,
      sentiment: c.sentiment,
      topics: c.topics,
      lean: c.lean,
      brand: "apple",
    }))
    onDrill({
      title: `Comments on @${p.author}'s post`,
      subtitle: p.title.slice(0, 120) || undefined,
      items,
    })
  }

  const toggleTranslations = async () => {
    const next = !showTranslations
    setShowTranslations(next)
    if (next)
      await ensureTranslations(
        ranked.slice(0, shown).map((p) => ({ id: p.id, text: p.title.slice(0, 300) })),
      )
  }

  if (ranked.length === 0) return null

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="section-label flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/70" />
            Top Conversations
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Highest-reach fold posts — click one to read its comments
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTranslations}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            showTranslations
              ? "border-primary/50 bg-primary/15 text-foreground"
              : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
          )}
        >
          {translating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
          {showTranslations ? "Original" : "Translate"}
        </button>
      </div>

      <div className="space-y-1">
        {ranked.slice(0, shown).map((p) => {
          const cs = p.commentSentiment
          const scored = cs.positive + cs.neutral + cs.negative
          const scrapedCount = (commentsByPost.get(p.id) || []).length
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => drillPost(p)}
              onKeyDown={(e) => e.key === "Enter" && drillPost(p)}
              className="group flex w-full cursor-pointer items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span className="mt-0.5 w-16 shrink-0 rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-px text-center text-[10px] font-medium text-muted-foreground">
                {PLATFORM_LABELS[p.platform] || p.platform}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" dir="auto">
                  <span className="font-medium">@{p.author}</span>
                  <span className="ml-2 text-muted-foreground">
                    {displayText({ id: p.id, text: p.title.slice(0, 300) }).slice(0, 110) || "(no caption)"}
                  </span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{formatCompactNum(p.likes)} likes</span>
                  <span>
                    {formatCompactNum(p.commentsCount)} comments
                    {scrapedCount > 0 && ` · ${formatCompactNum(scrapedCount)} scraped ↗`}
                  </span>
                  {p.gcc && (
                    <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-px">GCC</span>
                  )}
                  {scored > 0 && (
                    <span className="flex h-1.5 w-20 overflow-hidden rounded-full">
                      <span style={{ width: `${(cs.positive / scored) * 100}%`, background: "var(--positive)" }} />
                      <span style={{ width: `${(cs.neutral / scored) * 100}%`, background: "var(--neutral)" }} />
                      <span style={{ width: `${(cs.negative / scored) * 100}%`, background: "var(--negative)" }} />
                    </span>
                  )}
                </div>
              </div>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label="Open original post"
              >
                <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50 hover:text-foreground" />
              </a>
            </div>
          )
        })}
      </div>

      {ranked.length > shown && (
        <button
          type="button"
          onClick={async () => {
            const next = shown + 12
            setShown(next)
            if (showTranslations)
              await ensureTranslations(ranked.slice(0, next).map((p) => ({ id: p.id, text: p.title.slice(0, 300) })))
          }}
          className="mt-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Show more ({ranked.length - shown} remaining)
        </button>
      )}
    </div>
  )
}
