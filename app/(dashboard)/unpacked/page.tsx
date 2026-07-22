"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { CalendarClock, Clapperboard } from "lucide-react"

import { cn } from "@/lib/utils"
import { computeTotals, formatCompact, type UnpackedPayload } from "@/lib/unpacked-data"
import { UnpackedKPIs } from "@/components/unpacked/unpacked-kpis"
import { UnpackedVideoCards } from "@/components/unpacked/unpacked-video-cards"
import { UnpackedCommentsFeed } from "@/components/unpacked/unpacked-comments-feed"
import { Skeleton } from "@/components/ui/skeleton"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[120px] w-full rounded-lg" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[560px] w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

type PlatformFilter = "all" | "instagram" | "tiktok"

export default function GalaxyUnpackedPage() {
  const { data, error, isLoading } = useSWR<UnpackedPayload>("/api/unpacked", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const [platform, setPlatform] = useState<PlatformFilter>("all")

  const hasData = !!data && !("error" in (data as object)) && data.videos !== undefined

  // Platform filter drives everything below it — KPIs, cards, comments feed.
  const filtered = useMemo<UnpackedPayload | null>(() => {
    if (!hasData || !data) return null
    if (platform === "all") return data
    const videos = data.videos.filter((v) => v.platform === platform)
    return { ...data, videos, totals: computeTotals(videos) }
  }, [data, hasData, platform])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Editorial masthead */}
      <div className="animate-in fade-in slide-in-from-bottom-2 pt-4 duration-500">
        <p className="section-label">Samsung Gulf · Influencer Campaign</p>
        <h1 className="display-title text-gradient mt-2 text-3xl md:text-4xl">Galaxy Unpacked</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
          Influencer videos posted for Galaxy Unpacked on Instagram &amp; TikTok — tracked via
          #newshape, #galaxyunpacked and @samsunggulf, with AI sentiment on every comment
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground">
          <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
            <CalendarClock className="h-3 w-3" />
            Auto-sync 9:00 AM &amp; 2:00 PM daily until Aug 1
          </span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">#newshape</span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">#galaxyunpacked</span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">@samsunggulf</span>
        </div>
      </div>

      {isLoading && <LoadingState />}

      {!isLoading && (error || !hasData) && (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
          <Clapperboard className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Could not load Galaxy Unpacked data. Try refreshing the page.
          </p>
        </div>
      )}

      {!isLoading && hasData && data.videos.length === 0 && (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
          <Clapperboard className="h-8 w-8 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            No campaign videos synced yet. The scraper runs automatically at 9:00 AM and 2:00 PM —
            videos matching the campaign hashtags will appear here after the next sync.
          </p>
        </div>
      )}

      {!isLoading && hasData && data.videos.length > 0 && filtered && (
        <>
          {/* Platform filter — drives KPIs, video cards and the comments feed */}
          <div className="sticky top-14 z-20 -mx-4 border-y border-white/[0.06] bg-background/70 px-4 py-2.5 backdrop-blur-xl md:-mx-6 md:px-6">
            <div className="flex items-center gap-2">
              <span className="section-label mr-1">Platform</span>
              {(
                [
                  { key: "all", label: "All", count: data.videos.length },
                  {
                    key: "instagram",
                    label: "Instagram",
                    count: data.videos.filter((v) => v.platform === "instagram").length,
                  },
                  {
                    key: "tiktok",
                    label: "TikTok",
                    count: data.videos.filter((v) => v.platform === "tiktok").length,
                  },
                ] as { key: PlatformFilter; label: string; count: number }[]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setPlatform(f.key)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                    platform === f.key
                      ? "border-primary/50 bg-primary/15 text-foreground shadow-[0_0_16px_var(--glow-primary)]"
                      : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label} ({formatCompact(f.count)})
                </button>
              ))}
            </div>
          </div>

          {/* Overall totals — views, likes, comments, engagements, blended ER */}
          <UnpackedKPIs data={filtered} />

          {/* One card per influencer video: playable embed, ER + comment count */}
          <div>
            <p className="section-label accent-top mb-4 pt-3">Influencer Videos</p>
            <UnpackedVideoCards videos={filtered.videos} />
          </div>

          {/* Every scraped comment with AI sentiment */}
          <UnpackedCommentsFeed data={filtered} />
        </>
      )}
    </div>
  )
}
