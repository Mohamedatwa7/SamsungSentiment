"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { CalendarClock, Swords, Timer } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  ifoldCampaignDay,
  type IFoldPayload,
  type IFoldPost,
} from "@/lib/ifold-data"
import { snapshotFetcher, type UnpackedPayload } from "@/lib/unpacked-data"
import { buildAppleReactions, buildSamsungReactions } from "@/lib/ifold-reactions"
import { IFoldDrilldownDialog, type DrilldownState } from "@/components/ifold/drilldown"
import { IFoldKPIs } from "@/components/ifold/ifold-kpis"
import { IFoldWhatsHappening } from "@/components/ifold/ifold-whats-happening"
import { IFoldPies } from "@/components/ifold/ifold-pies"
import { IFoldTrend } from "@/components/ifold/ifold-trend"
import { IFoldInsights } from "@/components/ifold/ifold-insights"
import { IFoldNewsWire } from "@/components/ifold/ifold-news-wire"
import { IFoldTopPosts } from "@/components/ifold/ifold-top-posts"
import { IFoldCommentsFeed } from "@/components/ifold/ifold-comments-feed"
import { IFoldWatchlist } from "@/components/ifold/ifold-watchlist"
import { Skeleton } from "@/components/ui/skeleton"

const fetcher = async (url: string) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  const json = await res.json()
  if (!res.ok || json?.error) throw new Error(json?.error || `HTTP ${res.status}`)
  return json
}

// The FF8 side of the pie charts comes from the Galaxy Unpacked + roster
// payloads (both have committed snapshots, so these never block the page).
const unpackedFetcher = snapshotFetcher("/unpacked-snapshot.json")
const rosterFetcher = snapshotFetcher("/roster-snapshot.json")

type FocusFilter = "fold" | "all"
type RegionFilter = "gcc" | "all"
type PlatformFilter = "all" | "instagram" | "tiktok" | "twitter" | "youtube" | "news"

function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[120px] w-full rounded-lg" />
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-[300px] w-full rounded-lg" />
        <Skeleton className="h-[300px] w-full rounded-lg" />
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
  )
}

function LaunchStatusChip({ launchAt, trackingEndsAt }: { launchAt: string; trackingEndsAt: string }) {
  const now = Date.now()
  const launch = new Date(launchAt).getTime()
  if (now < launch) {
    const hours = Math.floor((launch - now) / 3600000)
    const mins = Math.floor(((launch - now) % 3600000) / 60000)
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-accent">
        <Timer className="h-3 w-3" />
        Apple event in {hours > 0 ? `${hours}h ` : ""}{mins}m — 9:00 PM Dubai
      </span>
    )
  }
  const day = ifoldCampaignDay()
  const totalDays = Math.round(
    (new Date(trackingEndsAt).getTime() - new Date("2026-09-09T00:00:00+04:00").getTime()) / 86400000,
  )
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-positive/40 bg-positive/10 px-3 py-1 text-positive">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
      </span>
      Launched — tracking day {Math.min(day, totalDays)} of {totalDays}
    </span>
  )
}

export default function CompetitionWatchPage() {
  // The first cold read after idle can 500 while the DB cache warms — keep
  // retrying quickly and show a warming state instead of a dead error panel.
  const { data, error, isLoading, isValidating } = useSWR<IFoldPayload>("/api/ifold", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    errorRetryCount: 10,
    errorRetryInterval: 4000,
  })
  const { data: unpackedData } = useSWR<UnpackedPayload>("/api/unpacked", unpackedFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  })
  const { data: rosterData } = useSWR<UnpackedPayload>("/api/roster", rosterFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  })

  const [focus, setFocus] = useState<FocusFilter>("fold")
  const [region, setRegion] = useState<RegionFilter>("all")
  const [platform, setPlatform] = useState<PlatformFilter>("all")
  const [drill, setDrill] = useState<DrilldownState | null>(null)

  const hasData = !!data && Array.isArray(data.posts)

  const filtered = useMemo(() => {
    if (!hasData || !data) return null
    const postOk = (p: IFoldPost) =>
      (focus === "all" || p.focus === "fold") &&
      (region === "all" || p.gcc) &&
      (platform === "all" || p.platform === platform)
    const posts = data.posts.filter(postOk)
    const postById = new Map(data.posts.map((p) => [p.id, p]))
    // Comments follow their parent post's focus/platform; region uses the
    // comment's own GCC signal (Arabic text on a global post still counts).
    const comments = data.comments.filter((c) => {
      const parent = postById.get(c.postId)
      if (focus === "fold" && parent && parent.focus !== "fold") return false
      if (region === "gcc" && !c.gcc && !(parent && parent.gcc)) return false
      if (platform !== "all" && (parent ? parent.platform : c.platform) !== platform) return false
      return true
    })
    return { posts, comments }
  }, [data, hasData, focus, region, platform])

  const appleReactions = useMemo(
    () => (filtered ? buildAppleReactions(filtered.posts, filtered.comments) : []),
    [filtered],
  )
  const samsungReactions = useMemo(
    () => buildSamsungReactions([unpackedData, rosterData]),
    [unpackedData, rosterData],
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Editorial masthead */}
      <div className="animate-in fade-in slide-in-from-bottom-2 pt-4 duration-500">
        <p className="section-label">Samsung Gulf · Competition Analysis</p>
        <h1 className="display-title text-gradient mt-2 text-3xl md:text-4xl">
          Competition Watch — iPhone Fold
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
          Live GCC + global reactions to Apple&apos;s first foldable, scored by AI and compared with our
          Galaxy Fold8 campaign. Every number is clickable — tap any stat, slice or bar to read the
          actual comments behind it, with one-tap translation.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground">
          {data?.meta && <LaunchStatusChip launchAt={data.meta.launchAt} trackingEndsAt={data.meta.trackingEndsAt} />}
          <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
            <CalendarClock className="h-3 w-3" />
            Auto-sync 9:00 AM daily until Oct 1
          </span>
        </div>
      </div>

      {isLoading && <LoadingState />}

      {(!isLoading && error && !hasData && isValidating) && <LoadingState />}

      {!isLoading && error && !hasData && !isValidating && (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
          <Swords className="h-8 w-8 animate-pulse text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Warming up the data store — retrying automatically…
          </p>
        </div>
      )}

      {!isLoading && hasData && filtered && (
        <>
          {/* Filters — drive every Apple-side section below */}
          <div className="sticky top-14 z-20 -mx-4 border-y border-white/[0.06] bg-background/70 px-4 py-2.5 backdrop-blur-xl md:-mx-6 md:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="section-label mr-1">Focus</span>
              {(
                [
                  { key: "fold", label: "iPhone Fold" },
                  { key: "all", label: "Full launch" },
                ] as { key: FocusFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFocus(f.key)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                    focus === f.key
                      ? "border-primary/50 bg-primary/15 text-foreground shadow-[0_0_16px_var(--glow-primary)]"
                      : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}

              <div className="mx-1 hidden h-5 w-px bg-white/[0.08] sm:block" />

              <span className="section-label mr-1">Region</span>
              {(
                [
                  { key: "all", label: "Global" },
                  { key: "gcc", label: "GCC" },
                ] as { key: RegionFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setRegion(f.key)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                    region === f.key
                      ? "border-primary/50 bg-primary/15 text-foreground shadow-[0_0_16px_var(--glow-primary)]"
                      : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}

              <div className="mx-1 hidden h-5 w-px bg-white/[0.08] sm:block" />

              <span className="section-label mr-1">Channel</span>
              {(
                [
                  { key: "all", label: "All" },
                  { key: "instagram", label: "Instagram" },
                  { key: "tiktok", label: "TikTok" },
                  { key: "twitter", label: "X" },
                  { key: "youtube", label: "YouTube" },
                  { key: "news", label: "News" },
                ] as { key: PlatformFilter; label: string }[]
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
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filtered.posts.length === 0 && filtered.comments.length === 0 ? (
            <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
              <Swords className="h-8 w-8 text-muted-foreground" />
              <p className="max-w-md text-sm text-muted-foreground">
                No conversations tracked yet for this filter — try widening the focus, region or
                channel above.
              </p>
            </div>
          ) : (
            <>
              {/* Headline numbers — each opens the reactions behind it */}
              <IFoldKPIs posts={filtered.posts} reactions={appleReactions} onDrill={setDrill} />

              {/* Plain-language digest of what's going on */}
              <IFoldWhatsHappening reactions={appleReactions} onDrill={setDrill} />

              {/* FF8 vs iPhone Fold pie charts */}
              <IFoldPies apple={appleReactions} samsung={samsungReactions} onDrill={setDrill} />

              {/* Daily sentiment volume — click a day to read it */}
              <IFoldTrend
                reactions={appleReactions}
                launchAt={data.meta.launchAt}
                onDrill={setDrill}
              />

              {/* Strengths to answer / weaknesses to attack — click any topic */}
              <IFoldInsights reactions={appleReactions} onDrill={setDrill} />

              {/* Press + top social conversations side by side on wide screens */}
              <div className="grid items-start gap-6 xl:grid-cols-2">
                <IFoldNewsWire posts={filtered.posts} />
                <IFoldTopPosts posts={filtered.posts} comments={filtered.comments} onDrill={setDrill} />
              </div>

              {/* Every scraped reaction, filterable + translatable */}
              <IFoldCommentsFeed comments={filtered.comments} />

              {/* What we're listening to */}
              <IFoldWatchlist />
            </>
          )}
        </>
      )}

      <IFoldDrilldownDialog state={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
