"use client"

import { useEffect, useState } from "react"
import { Languages, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCommentTranslations } from "@/hooks/use-comment-translations"
import { formatCompactNum, IFOLD_TOPIC_LABELS, type IFoldSentiment } from "@/lib/ifold-data"
import type { Reaction } from "@/lib/ifold-reactions"

export interface DrilldownState {
  title: string
  subtitle?: string
  items: Reaction[]
}

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
  news: "News",
}

const PAGE = 40
const MAX_ITEMS = 400

// The shared click-through dialog: every clickable stat on the Competition
// Watch page opens this with the reactions behind the number, most-liked
// first, translatable to English.
export function IFoldDrilldownDialog({
  state,
  onClose,
}: {
  state: DrilldownState | null
  onClose: () => void
}) {
  const [shown, setShown] = useState(PAGE)
  const { showTranslations, setShowTranslations, translating, ensureTranslations, displayText } =
    useCommentTranslations()

  const items = (state?.items || [])
    .slice()
    .sort((a, b) => b.likes - a.likes)
    .slice(0, MAX_ITEMS)
  const visible = items.slice(0, shown)

  // Fresh dialog content → reset paging (translations cache persists across
  // opens so nothing is re-billed).
  useEffect(() => {
    setShown(PAGE)
  }, [state?.title])

  const toggleTranslations = async () => {
    const next = !showTranslations
    setShowTranslations(next)
    if (next) await ensureTranslations(visible)
  }

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <DialogTitle>{state?.title}</DialogTitle>
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
              {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
              {showTranslations ? "Original" : "Translate"}
            </button>
          </div>
          <DialogDescription>
            {state?.subtitle || `${formatCompactNum(items.length)} reactions, most-liked first`}
            {state && state.items.length > MAX_ITEMS && ` (top ${MAX_ITEMS} shown)`}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[62vh] space-y-2 overflow-y-auto px-1 pb-1">
          {visible.length === 0 && (
            <p className="py-10 text-center text-xs text-muted-foreground">
              Nothing here yet — this fills up as reactions are scraped and scored.
            </p>
          )}
          {visible.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-2.5">
              <p className="text-sm leading-snug" dir="auto">
                {displayText(r)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-1.5 py-px font-medium">
                  {PLATFORM_LABELS[r.platform] || r.platform}
                </span>
                <span className="font-medium">@{r.author}</span>
                {r.likes > 0 && <span>♥ {formatCompactNum(r.likes)}</span>}
                <span className={cn("rounded-full border px-2 py-px capitalize", SENTIMENT_STYLES[r.sentiment])}>
                  {r.sentiment}
                </span>
                {r.lean && (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-px",
                      r.lean === "samsung"
                        ? "border-positive/40 bg-positive/10 text-positive"
                        : "border-negative/40 bg-negative/10 text-negative",
                    )}
                  >
                    {r.lean === "samsung" ? "→ Samsung" : "→ Apple"}
                  </span>
                )}
                {r.topics.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-px">
                    {IFOLD_TOPIC_LABELS[t] || t.replace(/_/g, " ")}
                  </span>
                ))}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary/80 hover:text-primary"
                  >
                    source ↗
                  </a>
                )}
              </div>
            </div>
          ))}

          {items.length > shown && (
            <button
              type="button"
              onClick={async () => {
                const next = shown + PAGE
                setShown(next)
                if (showTranslations) await ensureTranslations(items.slice(0, next))
              }}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Show more ({formatCompactNum(items.length - shown)} remaining)
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
