import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { instagramShortcodeToId, instagramShortcodeFromUrl } from "@/lib/instagram-id"
import { campaignEnded, CAMPAIGN_END, UNPACKED_ID_PREFIX, stripUnpackedPrefix } from "@/lib/unpacked-sync"
import type {
  UnpackedComment,
  UnpackedPayload,
  UnpackedSentiment,
  UnpackedVideo,
} from "@/lib/unpacked-data"

// Always read live from Supabase — never prerendered at build time.
export const dynamic = "force-dynamic"

const PAGE_SIZE = 1000

const COMMENT_COLUMNS =
  "external_id,external_post_id,platform,text,author_username,likes_count," +
  "published_at,sentiment,sentiment_score,sentiment_analyzed_at"

// Keyword fallback for comments the LLM has not scored yet — mirrors the
// fallback in /api/comments so both sections behave the same before analysis.
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

export async function GET() {
  try {
    const supabase = await createClient()

    // Campaign videos are few — a single page is plenty.
    const { data: postData, error: postError } = await supabase
      .from("social_posts")
      .select(
        "external_id,platform,post_url,caption,media_url,likes_count,comments_count," +
          "shares_count,views_count,published_at,raw_data",
      )
      .like("external_id", `${UNPACKED_ID_PREFIX}%`)
      .limit(2000)
    if (postError) throw new Error(postError.message)
    const postRows = (postData || []) as any[]

    // Comments can grow into the thousands — paginate.
    const commentRows: any[] = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from("social_comments")
        .select(COMMENT_COLUMNS)
        .like("external_id", `${UNPACKED_ID_PREFIX}%`)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) {
        console.error("[unpacked] Comment fetch error:", error.message)
        break
      }
      if (!data || data.length === 0) break
      commentRows.push(...data)
      if (data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    // Build videos and register every alias a comment might use to reference
    // its parent (external id, IG shortcode + numeric id, TikTok video id).
    const videos: UnpackedVideo[] = []
    const aliasToVideo = new Map<string, UnpackedVideo>()
    const register = (key: string | null | undefined, video: UnpackedVideo) => {
      if (key && !aliasToVideo.has(key)) aliasToVideo.set(key, video)
    }

    for (const p of postRows) {
      const raw = (p.raw_data || {}) as any
      const platform = p.platform as "instagram" | "tiktok"
      const url = p.post_url || ""
      // Real platform id — comments reference videos by this, not the
      // unpacked_-prefixed row key.
      const externalId = stripUnpackedPrefix(String(p.external_id || ""))

      let embedUrl = ""
      let username = "unknown"
      let displayName = ""
      let avatar: string | null = null

      if (platform === "instagram") {
        const shortcode =
          instagramShortcodeFromUrl(url) || raw.shortCode || (/^\d+$/.test(externalId) ? null : externalId)
        embedUrl = shortcode ? `https://www.instagram.com/p/${shortcode}/embed/captioned` : ""
        username = raw.ownerUsername || "unknown"
        displayName = raw.ownerFullName || raw.ownerUsername || "Instagram creator"
        avatar = raw.ownerProfilePicUrl || null
      } else {
        const videoId = url.match(/video\/(\d+)/)?.[1] || externalId
        // player/v1 strictly plays THIS video; the embed/v2 widget falls back
        // to a related-videos feed when it can't embed the target.
        embedUrl = `https://www.tiktok.com/player/v1/${videoId}?autoplay=0&rel=0&description=1`
        username = raw.authorMeta?.name || "unknown"
        displayName = raw.authorMeta?.nickName || raw.authorMeta?.name || "TikTok creator"
        avatar = raw.authorMeta?.avatar || null
      }

      const likes = p.likes_count || 0
      const commentsCount = p.comments_count || 0
      const shares = p.shares_count || 0
      const views = p.views_count || 0
      const engagementCount = likes + commentsCount + shares

      const video: UnpackedVideo = {
        id: `${platform}-${externalId}`,
        platform,
        url,
        embedUrl,
        thumbnail: p.media_url || null,
        caption: p.caption || "",
        influencer: { username, displayName, avatar },
        publishedAt: p.published_at || null,
        views,
        likes,
        commentsCount,
        sharesCount: shares,
        engagementCount,
        engagementRate: views > 0 ? Math.round((engagementCount / views) * 10000) / 100 : null,
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        comments: [],
      }
      videos.push(video)

      register(externalId, video)
      register(url.replace(/\/+$/, ""), video)
      if (platform === "instagram") {
        const shortcode = instagramShortcodeFromUrl(url) || raw.shortCode
        register(shortcode, video)
        if (shortcode) register(instagramShortcodeToId(shortcode), video)
        if (/^\d+$/.test(externalId)) register(externalId, video)
        else register(instagramShortcodeToId(externalId), video)
      }
    }

    // Attach comments to their videos with sentiment.
    let analyzedCount = 0
    for (const c of commentRows) {
      const ref = String(c.external_post_id || "")
      const video =
        aliasToVideo.get(ref) ||
        aliasToVideo.get(ref.replace(/\/+$/, "")) ||
        (c.platform === "instagram"
          ? aliasToVideo.get(
              (/^\d+$/.test(ref) ? null : instagramShortcodeToId(ref)) || "",
            )
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

    // Most-liked comments first within each video; most-viewed videos first.
    for (const v of videos) v.comments.sort((a, b) => b.likes - a.likes)
    videos.sort((a, b) => b.views - a.views)

    const totals = videos.reduce(
      (acc, v) => {
        acc.views += v.views
        acc.likes += v.likes
        acc.comments += v.commentsCount
        acc.shares += v.sharesCount
        acc.engagements += v.engagementCount
        acc.scrapedComments += v.comments.length
        acc.sentiment.positive += v.sentiment.positive
        acc.sentiment.neutral += v.sentiment.neutral
        acc.sentiment.negative += v.sentiment.negative
        return acc
      },
      {
        videos: videos.length,
        influencers: new Set(videos.map((v) => `${v.platform}:${v.influencer.username}`)).size,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagements: 0,
        engagementRate: null as number | null,
        scrapedComments: 0,
        analyzedComments: analyzedCount,
        sentiment: { positive: 0, neutral: 0, negative: 0 },
      },
    )
    totals.engagementRate =
      totals.views > 0 ? Math.round((totals.engagements / totals.views) * 10000) / 100 : null

    const payload: UnpackedPayload = {
      videos,
      totals,
      meta: {
        generatedAt: new Date().toISOString(),
        campaignEndsAt: CAMPAIGN_END.toISOString(),
        campaignEnded: campaignEnded(),
      },
    }

    return NextResponse.json(payload, {
      headers: {
        // Data changes only on the twice-daily sync — same edge-cache policy
        // as /api/comments.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    })
  } catch (error) {
    console.error("[unpacked] Error building payload:", error)
    return NextResponse.json({ error: "Failed to fetch Galaxy Unpacked data" }, { status: 500 })
  }
}
