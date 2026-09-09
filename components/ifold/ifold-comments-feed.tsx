"use client"

import { useMemo, useState } from "react"
import { Languages, Loader2, MessagesSquare, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { useCommentTranslations } from "@/hooks/use-comment-translations"
import {
  formatCompactNum,
  IFOLD_TOPIC_LABELS,
  type IFoldComment,
  type IFoldSentiment,
} from "@/lib/ifold-data"

const SENTIMENT_STYLES: Record<IFoldSentiment, string> = {
  positive: "border-positive/40 bg-positive/10 text-positive",
  negative: "border-negative/40 bg-negative/10 text-negative",
  neutral: "border-white/[0.1] bg-white/[0.04] text-muted-foreground",
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "IG",
  tiktok: "TT",
  twitter: "X",
  youtube: "YT",
}

const PAGE = 25

// Every scraped reaction with the competitive analyzer's verdict — filterable
// by sentiment/topic/brand-lean, searchable, translatable to English.
export function IFoldCommentsFeed({ comments }: { comments: IFoldComment[] }) {
  const [sentiment, setSentiment] = useState<"all" | IFoldSentiment>("all")
  const [topic, setTopic] = useState("all")
  const [lean, setLean] = useState<"all" | "samsung" | "apple">("all")
  const [query, setQuery] = useState("")
  const [shown, setShown] = useState(PAGE)
  const { showTranslations, setShowTranslations, translating, ensureTranslations, displayText } =
    useCommentTranslations()

  const topicsPresent = useMemo(() => {
    const keys = new Set<string>()
    for (const c of comments) for (const t of c.topics) keys.add(t)
    return [...keys].sort()
  }, [comments])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return comments.filter(
      (c) =>
        (sentiment === "all" || c.sentiment === sentiment) &&
        (topic === "all" || c.topics.includes(topic)) &&
        (lean === "all" || c.lean === lean) &&
        (!q || c.text.toLowerCase().includes(q) || c.author.toLowerCase().includes(q)),
    )
  }, [comments, sentiment, topic, lean, query])

  const visible = filtered.slice(0, shown)

  const toggleTranslations = async () => {
    const next = !showTranslations
    setShowTranslations(next)
    if (next) await ensureTranslations(visible)
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-label flex items-center gap-1.5">
            <MessagesSquare className="h-3.5 w-3.5 text-muted-foreground/70" />
            Reaction Feed
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCompactNum(filtered.length)} of {formatCompactNum(comments.length)} scraped reactions
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTranslations}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
            showTranslations
              ? "border-primary/50 bg-primary/15 text-foreground"
              : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
          )}
        >
          {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
          {showTranslations ? "Original text" : "Translate to English"}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "positive", "neutral", "negative"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSentiment(s)
              setShown(PAGE)
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
              sentiment === s
                ? "border-primary/50 bg-primary/15 text-foreground"
                : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}

        <div className="mx-1 hidden h-5 w-px bg-white/[0.08] sm:block" />

        <select
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value)
            setShown(PAGE)
          }}
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-muted-foreground outline-none"
        >
          <option value="all">All topics</option>
          {topicsPresent.map((t) => (
            <option key={t} value={t}>
              {IFOLD_TOPIC_LABELS[t] || t.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <select
          value={lean}
          onChange={(e) => {
            setLean(e.target.value as typeof lean)
            setShown(PAGE)
          }}
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-muted-foreground outline-none"
        >
          <option value="all">Any brand lean</option>
          <option value="samsung">Favors Samsung</option>
          <option value="apple">Favors Apple</option>
        </select>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShown(PAGE)
            }}
            placeholder="Search text or author"
            className="w-44 rounded-full border border-white/[0.08] bg-white/[0.03] py-1 pl-7 pr-3 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-primary/40"
          />
        </div>
      </div>

      {visible.length === 0 && (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No reactions match — comments land after each sync cycle.
        </p>
      )}

      <div className="space-y-2">
        {visible.map((c) => (
          <div key={c.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-2.5">
            <p className="text-sm leading-snug" dir="auto">
              {displayText(c)}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-1.5 py-px font-medium">
                {PLATFORM_LABELS[c.platform] || c.platform}
              </span>
              <span className="font-medium">@{c.author}</span>
              {c.likes > 0 && <span>♥ {formatCompactNum(c.likes)}</span>}
              <span className={cn("rounded-full border px-2 py-px capitalize", SENTIMENT_STYLES[c.sentiment])}>
                {c.sentiment}
                {!c.analyzed && " (est.)"}
              </span>
              {c.lean && (
                <span
                  className={cn(
                    "rounded-full border px-2 py-px",
                    c.lean === "samsung"
                      ? "border-positive/40 bg-positive/10 text-positive"
                      : "border-negative/40 bg-negative/10 text-negative",
                  )}
                >
                  {c.lean === "samsung" ? "→ Samsung" : "→ Apple"}
                </span>
              )}
              {c.topics.map((t) => (
                <span key={t} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-px">
                  {IFOLD_TOPIC_LABELS[t] || t.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length > shown && (
        <button
          type="button"
          onClick={async () => {
            const next = shown + PAGE
            setShown(next)
            if (showTranslations) await ensureTranslations(filtered.slice(0, next))
          }}
          className="mt-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Show more ({formatCompactNum(filtered.length - shown)} remaining)
        </button>
      )}
    </div>
  )
}
