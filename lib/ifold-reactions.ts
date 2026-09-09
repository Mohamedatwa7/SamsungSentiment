// Unified "reaction" model for the Competition Watch drill-downs: every
// clickable number on the page resolves to a list of these, shown in the
// shared dialog with translation. Apple-side reactions come from the ifold
// corpus (comments + analyzed tweets/headlines); Samsung-side reactions come
// from the Galaxy Unpacked + FF8 roster campaign payloads.

import type { IFoldComment, IFoldLean, IFoldPost, IFoldSentiment } from "@/lib/ifold-data"
import type { UnpackedPayload, UnpackedVideo } from "@/lib/unpacked-data"

export interface Reaction {
  id: string
  text: string
  author: string
  platform: string // instagram | tiktok | twitter | youtube | news
  likes: number
  publishedAt: string | null
  sentiment: IFoldSentiment
  topics: string[]
  lean: IFoldLean
  brand: "apple" | "samsung"
  url?: string
}

// Comments plus the posts that ARE the opinion unit (tweets, news headlines).
export function buildAppleReactions(posts: IFoldPost[], comments: IFoldComment[]): Reaction[] {
  const out: Reaction[] = []
  for (const p of posts) {
    if (!p.analysis) continue
    out.push({
      id: p.id,
      text: p.title,
      author: p.author,
      platform: p.platform,
      likes: p.likes,
      publishedAt: p.publishedAt,
      sentiment: p.analysis.sentiment,
      topics: p.analysis.topics,
      lean: p.analysis.lean,
      brand: "apple",
      url: p.url,
    })
  }
  for (const c of comments) {
    if (!c.analyzed) continue
    out.push({
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
    })
  }
  return out
}

// Fold8 campaign comments from the Unpacked + roster feeds, deduped by raw
// id (the same comment can be ingested by both pipelines).
export function buildSamsungReactions(
  payloads: (UnpackedPayload | { videos?: UnpackedVideo[] } | undefined)[],
): Reaction[] {
  const seen = new Set<string>()
  const out: Reaction[] = []
  for (const payload of payloads) {
    for (const v of payload?.videos || []) {
      for (const c of v.comments) {
        const rawId = c.id.replace(/^(unpacked_|roster_)/, "")
        if (seen.has(rawId)) continue
        seen.add(rawId)
        out.push({
          id: c.id,
          text: c.text,
          author: c.username,
          platform: v.platform,
          likes: c.likes,
          publishedAt: c.publishedAt,
          sentiment: c.sentiment,
          topics: [],
          lean: null,
          brand: "samsung",
          url: v.url,
        })
      }
    }
  }
  return out
}

export function bySentiment(items: Reaction[], sentiment: IFoldSentiment): Reaction[] {
  return items.filter((r) => r.sentiment === sentiment)
}

export function byTopic(items: Reaction[], topic: string, sentiment?: IFoldSentiment): Reaction[] {
  return items.filter((r) => r.topics.includes(topic) && (!sentiment || r.sentiment === sentiment))
}

export function byLean(items: Reaction[], lean: "apple" | "samsung"): Reaction[] {
  return items.filter((r) => r.lean === lean)
}
