import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { instagramShortcodeToId, instagramShortcodeFromUrl } from "@/lib/instagram-id"
import { ROSTER_ID_PREFIX, stripRosterPrefix, youtubeVideoId } from "@/lib/roster-sync"
import { FF8_ROSTER } from "@/lib/roster"
import type { UnpackedComment, UnpackedSentiment, UnpackedVideo } from "@/lib/unpacked-data"

// Always read live from Supabase — never prerendered at build time.
export const dynamic = "force-dynamic"

const PAGE_SIZE = 1000

const COMMENT_COLUMNS =
  "external_id,external_post_id,platform,text,author_username,likes_count," +
  "published_at,sentiment,sentiment_score,sentiment_analyzed_at"

function fallbackSentiment(text: string): UnpackedSentiment {
  const t = (text || "").toLowerCase()
  const pos = ["love", "amazing", "great", "awesome", "perfect", "best", "excellent", "حلو", "روعة", "ممتاز", "جميل"]
  const neg = ["hate", "terrible", "worst", "bad", "awful", "broken", "waste", "problem", "issue", "سيء", "مشكلة", "خربان"]
  let p = 0
  let n = 0
  for (const w of pos) if (t.includes(w)) p++
  for (const w of neg) if (t.includes(w)) n++
  if (p > n) return "positive"
  if (n > p) return "negative"
  return "neutral"
}

async function withRetry<T>(
  label: string,
  fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  attempts = 3,
): Promise<T> {
  let lastError = "unknown"
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await fn()
    if (!error) return (data || []) as T
    lastError = error.message
    console.error(`[roster] ${label} attempt ${i + 1} failed:`, error.message)
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastError}`)
}

// FF8 roster video with influencer identity attached. Reuses the Unpacked
// payload shapes so components can share rendering logic.
export interface RosterVideo extends UnpackedVideo {
  rosterId: string
  rosterName: string
  category: string
}

export async function GET() {
  try {
    const supabase = await createClient()

    const postRows = await withRetry<any[]>("posts query", () =>
      supabase
        .from("social_posts")
        .select(
          "external_id,platform,post_url,caption,media_url,likes_count,comments_count," +
            "shares_count,views_count,published_at,raw_data",
        )
        .like("external_id", `${ROSTER_ID_PREFIX}%`)
        .limit(2000),
    )

    const commentRows: any[] = []
    let from = 0
    while (true) {
      const page = await withRetry<any[]>("comments query", () =>
        supabase
          .from("social_comments")
          .select(COMMENT_COLUMNS)
          .like("external_id", `${ROSTER_ID_PREFIX}%`)
          .order("external_id", { ascending: true })
          .range(from, from + PAGE_SIZE - 1),
      )
      if (page.length === 0) break
      commentRows.push(...page)
      if (page.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    const videos: RosterVideo[] = []
    const aliasToVideo = new Map<string, RosterVideo>()
    const register = (key: string | null | undefined, video: RosterVideo) => {
      if (key && !aliasToVideo.has(key)) aliasToVideo.set(key, video)
    }

    for (const p of postRows) {
      const raw = (p.raw_data || {}) as any
      // YouTube rows are stored under a constraint-allowed platform with
      // raw_data._platform carrying the real one.
      const platform = (raw._platform === "youtube" ? "youtube" : p.platform) as
        | "instagram"
        | "tiktok"
        | "youtube"
      const url = p.post_url || ""
      const externalId = stripRosterPrefix(String(p.external_id || ""))
      const roster = FF8_ROSTER.find((r) => r.id === raw._rosterId)

      let embedUrl = ""
      if (platform === "instagram") {
        const shortcode = instagramShortcodeFromUrl(url) || raw.shortCode || (/^\d+$/.test(externalId) ? null : externalId)
        embedUrl = shortcode ? `https://www.instagram.com/p/${shortcode}/embed/captioned` : ""
      } else if (platform === "youtube") {
        const vid = youtubeVideoId(url) || externalId.replace(/^yt_/, "")
        embedUrl = vid ? `https://www.youtube.com/embed/${vid}` : ""
      } else {
        const videoId = url.match(/video\/(\d+)/)?.[1] || externalId
        embedUrl = `https://www.tiktok.com/player/v1/${videoId}?autoplay=0&rel=0&description=1`
      }
      if (raw._unavailable) continue

      const likes = Math.max(0, p.likes_count || 0)
      const commentsCount = Math.max(0, p.comments_count || 0)
      const shares = Math.max(0, p.shares_count || 0)
      const views = Math.max(0, p.views_count || 0)
      const engagementCount = likes + commentsCount + shares

      const video: RosterVideo = {
        id: `${platform}-${externalId}`,
        platform,
        url,
        embedUrl,
        thumbnail: p.media_url || null,
        caption: p.caption || "",
        influencer: {
          username: raw.ownerUsername || raw.authorMeta?.name || raw.channelName || roster?.handle || "unknown",
          displayName: raw._rosterName || roster?.name || "Creator",
          avatar: raw.authorMeta?.avatar || null,
        },
        publishedAt: p.published_at || null,
        views,
        likes,
        commentsCount,
        sharesCount: shares,
        engagementCount,
        engagementRate: views > 0 ? Math.round((engagementCount / views) * 10000) / 100 : null,
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        comments: [],
        rosterId: raw._rosterId || roster?.id || "unknown",
        rosterName: raw._rosterName || roster?.name || "Creator",
        category: raw._rosterCategory || roster?.category || "Content Creator",
      }
      videos.push(video)

      register(externalId, video)
      register(url.replace(/\/+$/, ""), video)
      if (platform === "instagram") {
        const shortcode = instagramShortcodeFromUrl(url) || raw.shortCode
        register(shortcode, video)
        if (shortcode) register(instagramShortcodeToId(shortcode), video)
        if (!/^\d+$/.test(externalId)) register(instagramShortcodeToId(externalId), video)
      }
      if (platform === "youtube") {
        // Comments reference the bare video id (no yt_ prefix).
        register(externalId.replace(/^yt_/, ""), video)
        register(youtubeVideoId(url), video)
      }
    }

    let analyzedCount = 0
    for (const c of commentRows) {
      const ref = String(c.external_post_id || "")
      const video =
        aliasToVideo.get(ref) ||
        aliasToVideo.get(ref.replace(/\/+$/, "")) ||
        (c.platform === "instagram"
          ? aliasToVideo.get((/^\d+$/.test(ref) ? null : instagramShortcodeToId(ref)) || "")
          : undefined)
      if (!video) continue

      const analyzed = !!c.sentiment_analyzed_at && !!c.sentiment
      if (analyzed) analyzedCount++
      const sentiment: UnpackedSentiment = c.sentiment || fallbackSentiment(c.text || "")
      const comment: UnpackedComment = {
        id: String(c.external_id),
        text: c.text || "",
        username: c.author_username || "anonymous",
        likes: c.likes_count || 0,
        publishedAt: c.published_at || null,
        sentiment,
        sentimentScore: c.sentiment_score ?? null,
        analyzed,
      }
      video.comments.push(comment)
      video.sentiment[sentiment]++
    }

    for (const v of videos) v.comments.sort((a, b) => b.likes - a.likes)
    videos.sort((a, b) => b.views - a.views)

    return NextResponse.json(
      {
        videos,
        roster: FF8_ROSTER,
        meta: {
          generatedAt: new Date().toISOString(),
          analyzedComments: analyzedCount,
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
    )
  } catch (error) {
    console.error("[roster] Error building payload:", error)
    return NextResponse.json({ error: "Failed to fetch roster data" }, { status: 500 })
  }
}
