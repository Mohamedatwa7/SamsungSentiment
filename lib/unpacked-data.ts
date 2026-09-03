// Shared (client-safe) types and helpers for the Galaxy Unpacked section.
// The payload shape is produced by /api/unpacked and consumed by the
// components under components/unpacked/.

export type UnpackedSentiment = "positive" | "negative" | "neutral"

export interface UnpackedComment {
  id: string
  text: string
  username: string
  likes: number
  publishedAt: string | null
  sentiment: UnpackedSentiment
  sentimentScore: number | null
  // true when the sentiment came from the LLM pipeline, false when it is the
  // keyword fallback for a not-yet-analyzed comment.
  analyzed: boolean
}

export interface UnpackedInfluencer {
  username: string
  displayName: string
  avatar: string | null
}

export interface UnpackedVideo {
  id: string
  platform: "instagram" | "tiktok" | "youtube"
  url: string
  embedUrl: string
  thumbnail: string | null
  caption: string
  influencer: UnpackedInfluencer
  publishedAt: string | null
  views: number
  likes: number
  // platform-reported comment total (may exceed the number we scraped)
  commentsCount: number
  sharesCount: number
  engagementCount: number
  // engagements as % of views; null when the platform reported no view count
  engagementRate: number | null
  sentiment: { positive: number; neutral: number; negative: number }
  comments: UnpackedComment[]
}

export interface UnpackedTotals {
  videos: number
  influencers: number
  views: number
  likes: number
  comments: number
  shares: number
  engagements: number
  engagementRate: number | null
  scrapedComments: number
  analyzedComments: number
  sentiment: { positive: number; neutral: number; negative: number }
}

export interface UnpackedPayload {
  videos: UnpackedVideo[]
  totals: UnpackedTotals
  meta: {
    generatedAt: string
    campaignEndsAt: string
    campaignEnded: boolean
  }
}

// SWR fetcher with a static-snapshot fallback. The live routes rebuild from
// Supabase and 500 when the DB's cold-cache statement timeouts survive all
// their retries — the FIRST visitor after idle used to get an empty section.
// The campaign ended 2026-08-01 with final numbers, so a snapshot of each
// payload is committed under /public and served whenever the live call
// fails, times out, or returns an error body. Live data still wins when the
// API responds, so any later backfill flows through.
export function snapshotFetcher(snapshotUrl: string) {
  return async (url: string) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (res.ok) {
        const json = await res.json()
        if (json && !json.error && Array.isArray(json.videos)) return json
      }
    } catch {
      // fall through to the snapshot
    }
    const snap = await fetch(snapshotUrl)
    if (!snap.ok) throw new Error(`snapshot ${snapshotUrl} unavailable`)
    return snap.json()
  }
}

// Recompute campaign totals for a (possibly platform-filtered) video subset —
// mirrors the aggregation in /api/unpacked.
export function computeTotals(videos: UnpackedVideo[]): UnpackedTotals {
  const totals: UnpackedTotals = {
    videos: videos.length,
    influencers: new Set(videos.map((v) => `${v.platform}:${v.influencer.username}`)).size,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    engagements: 0,
    engagementRate: null,
    scrapedComments: 0,
    analyzedComments: 0,
    sentiment: { positive: 0, neutral: 0, negative: 0 },
  }
  for (const v of videos) {
    totals.views += v.views
    totals.likes += v.likes
    totals.comments += v.commentsCount
    totals.shares += v.sharesCount
    totals.engagements += v.engagementCount
    totals.scrapedComments += v.comments.length
    totals.analyzedComments += v.comments.filter((c) => c.analyzed).length
    totals.sentiment.positive += v.sentiment.positive
    totals.sentiment.neutral += v.sentiment.neutral
    totals.sentiment.negative += v.sentiment.negative
  }
  totals.engagementRate =
    totals.views > 0 ? Math.round((totals.engagements / totals.views) * 10000) / 100 : null
  return totals
}

// Positive share of a video's scraped comments (null when none scraped yet).
export function videoPositivePercent(v: UnpackedVideo): number | null {
  const total = v.sentiment.positive + v.sentiment.neutral + v.sentiment.negative
  return total > 0 ? Math.round((v.sentiment.positive / total) * 100) : null
}

export function formatCompact(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  return num.toLocaleString()
}

export function formatRate(rate: number | null): string {
  return rate == null ? "—" : `${rate.toFixed(rate >= 10 ? 1 : 2)}%`
}
