"use client"

import { useState } from "react"
import { ChevronDown, ExternalLink, Radar } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  IFOLD_APPLE_ACCOUNTS,
  IFOLD_INFLUENCER_WATCHLIST,
  IFOLD_NEWS_FEEDS,
  IFOLD_TRACKED_TERMS,
} from "@/lib/ifold-data"
import { FF8_ROSTER } from "@/lib/roster"

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
}

// What the tracker is listening to — the monitored press feeds, GCC tech
// voices and search terms. Collapsed by default; reference material.
export function IFoldWatchlist() {
  const [open, setOpen] = useState(false)

  return (
    <div className="glass-panel rounded-2xl p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="text-left">
          <p className="section-label flex items-center gap-1.5">
            <Radar className="h-3.5 w-3.5 text-muted-foreground/70" />
            Monitoring Watchlist
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {IFOLD_APPLE_ACCOUNTS.length} Apple official accounts · {IFOLD_NEWS_FEEDS.length} press feeds ·{" "}
            {IFOLD_INFLUENCER_WATCHLIST.length} GCC tech voices · {FF8_ROSTER.length} Samsung roster accounts ·{" "}
            {IFOLD_TRACKED_TERMS.length} tracked terms
          </p>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-5 space-y-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Apple official accounts
            </p>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {IFOLD_APPLE_ACCOUNTS.map((inf) => (
                <a
                  key={`${inf.platform}-${inf.handle}`}
                  href={inf.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-white/[0.04]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{inf.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{PLATFORM_LABELS[inf.platform]}</span>
                  </span>
                  {inf.note && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{inf.note}</span>}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tracked terms &amp; hashtags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {IFOLD_TRACKED_TERMS.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-muted-foreground"
                  dir="auto"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Press feeds (RSS)
            </p>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {IFOLD_NEWS_FEEDS.map((f) => (
                <a
                  key={f.id}
                  href={`https://${f.site}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-white/[0.04]"
                >
                  <span className="truncate" dir="auto">
                    {f.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded-full border border-white/[0.08] px-1.5 py-px uppercase">{f.lang}</span>
                    {f.region === "gcc" && (
                      <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-px text-accent">
                        GCC
                      </span>
                    )}
                    <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              GCC tech voices
            </p>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {IFOLD_INFLUENCER_WATCHLIST.map((inf) => (
                <a
                  key={`${inf.platform}-${inf.handle}`}
                  href={inf.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-white/[0.04]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium" dir="auto">
                      {inf.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {PLATFORM_LABELS[inf.platform]} · {inf.country}
                    </span>
                  </span>
                  {inf.note && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{inf.note}</span>}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Samsung FF8 campaign roster
            </p>
            <p className="mb-2 text-[11px] text-muted-foreground">
              All {FF8_ROSTER.length} campaign influencer profiles are scraped daily — any iPhone Duo coverage they
              post lands in this section automatically.
            </p>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {FF8_ROSTER.map((inf) => (
                <a
                  key={inf.id}
                  href={inf.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-white/[0.04]"
                >
                  <span className="truncate font-medium">{inf.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {PLATFORM_LABELS[inf.platform]} · {inf.category}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
