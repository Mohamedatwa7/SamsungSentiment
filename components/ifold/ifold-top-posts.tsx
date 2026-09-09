"use client"

import { useMemo, useState } from "react"
import { ExternalLink, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCompactNum, type IFoldPost } from "@/lib/ifold-data"

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X",
  youtube: "YouTube",
}

// The social posts carrying the conversation, ranked by reach. Comment
// sentiment shows how each post's audience is reacting.
export function IFoldTopPosts({ posts }: { posts: IFoldPost[] }) {
  const [shown, setShown] = useState(12)

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

  if (ranked.length === 0) return null

  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="section-label flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/70" />
        Top Conversations
      </p>
      <p className="mt-1 mb-4 text-xs text-muted-foreground">
        Highest-reach fold posts across platforms · sentiment bar = their comment sections
      </p>

      <div className="space-y-1">
        {ranked.slice(0, shown).map((p) => {
          const cs = p.commentSentiment
          const scored = cs.positive + cs.neutral + cs.negative
          return (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
            >
              <span className="mt-0.5 w-16 shrink-0 rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-px text-center text-[10px] font-medium text-muted-foreground">
                {PLATFORM_LABELS[p.platform] || p.platform}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="font-medium">@{p.author}</span>
                  <span className="ml-2 text-muted-foreground">{p.title.slice(0, 110) || "(no caption)"}</span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  {p.views > 0 && <span>{formatCompactNum(p.views)} views</span>}
                  <span>{formatCompactNum(p.likes)} likes</span>
                  <span>{formatCompactNum(p.commentsCount)} comments</span>
                  {p.gcc && (
                    <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-px">GCC</span>
                  )}
                  {p.analysis && (
                    <span
                      className={cn(
                        "capitalize",
                        p.analysis.sentiment === "positive" && "text-positive",
                        p.analysis.sentiment === "negative" && "text-negative",
                      )}
                    >
                      {p.analysis.sentiment}
                    </span>
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
              <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
            </a>
          )
        })}
      </div>

      {ranked.length > shown && (
        <button
          type="button"
          onClick={() => setShown((s) => s + 12)}
          className="mt-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Show more ({ranked.length - shown} remaining)
        </button>
      )}
    </div>
  )
}
