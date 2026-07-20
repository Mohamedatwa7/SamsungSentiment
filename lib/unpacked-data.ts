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
  platform: "instagram" | "tiktok"
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

export function formatCompact(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  return num.toLocaleString()
}

export function formatRate(rate: number | null): string {
  return rate == null ? "—" : `${rate.toFixed(rate >= 10 ? 1 : 2)}%`
}
