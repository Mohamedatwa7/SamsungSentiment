"use client"

import { useMemo, useState } from "react"
import { ExternalLink, Languages, Loader2, Newspaper, Pin } from "lucide-react"

import { cn } from "@/lib/utils"
import { useCommentTranslations } from "@/hooks/use-comment-translations"
import type { IFoldPost, IFoldSentiment } from "@/lib/ifold-data"

const SENTIMENT_STYLES: Record<IFoldSentiment, string> = {
  positive: "border-positive/40 bg-positive/10 text-positive",
  negative: "border-negative/40 bg-negative/10 text-negative",
  neutral: "border-white/[0.1] bg-white/[0.04] text-muted-foreground",
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// Press coverage stream — every fold/launch article from the monitored GCC
// and global feeds, with the analyzer's read on the headline tone.
export function IFoldNewsWire({ posts }: { posts: IFoldPost[] }) {
  const [lang, setLang] = useState<"all" | "ar" | "en">("all")
  const [shown, setShown] = useState(15)
  const { showTranslations, setShowTranslations, translating, ensureTranslations, displayText } =
    useCommentTranslations()

  const articles = useMemo(
    () =>
      posts
        .filter((p) => p.kind === "news" && (lang === "all" || p.sourceLang === lang))
        .sort(
          (a, b) =>
            // Comms-team picks pinned first, then the wire runs newest-first.
            Number(!!b.seeded) - Number(!!a.seeded) ||
            new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime(),
        ),
    [posts, lang],
  )

  const toggleTranslations = async () => {
    const next = !showTranslations
    setShowTranslations(next)
    if (next) await ensureTranslations(articles.slice(0, shown).map((a) => ({ id: a.id, text: a.title })))
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="section-label flex items-center gap-1.5">
            <Newspaper className="h-3.5 w-3.5 text-muted-foreground/70" />
            News Wire
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {articles.length} articles from GCC &amp; global tech press RSS
          </p>
        </div>
        <div className="flex gap-1.5">
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
          {(
            [
              { key: "all", label: "All" },
              { key: "ar", label: "العربية" },
              { key: "en", label: "English" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setLang(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                lang === f.key
                  ? "border-primary/50 bg-primary/15 text-foreground"
                  : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {articles.length === 0 && (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No matching articles yet — the wire fills up as feeds sync.
        </p>
      )}

      <div className="space-y-1">
        {articles.slice(0, shown).map((a) => (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
          >
            <div className="min-w-0 flex-1">
              <p
                className="text-sm leading-snug group-hover:text-foreground"
                dir={showTranslations ? "ltr" : a.sourceLang === "ar" ? "rtl" : "ltr"}
              >
                {displayText({ id: a.id, text: a.title })}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-medium">{a.source}</span>
                <span>·</span>
                <span>{timeAgo(a.publishedAt)}</span>
                {a.seeded && (
                  <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-px text-foreground">
                    <Pin className="h-2.5 w-2.5" /> Pinned
                  </span>
                )}
                {a.focus === "fold" && (
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-px text-accent">
                    Fold
                  </span>
                )}
                {a.gcc && (
                  <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-px">GCC</span>
                )}
                {a.analysis && (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-px capitalize",
                      SENTIMENT_STYLES[a.analysis.sentiment],
                    )}
                  >
                    {a.analysis.sentiment}
                  </span>
                )}
              </p>
            </div>
            <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
          </a>
        ))}
      </div>

      {articles.length > shown && (
        <button
          type="button"
          onClick={async () => {
            const next = shown + 15
            setShown(next)
            if (showTranslations)
              await ensureTranslations(articles.slice(0, next).map((a) => ({ id: a.id, text: a.title })))
          }}
          className="mt-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Show more ({articles.length - shown} remaining)
        </button>
      )}
    </div>
  )
}
