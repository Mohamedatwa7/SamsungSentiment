// Apify Data Sync Service
// Fetches data from Apify datasets and syncs to Supabase

import { createClient } from "@/lib/supabase/server"
import { analyzeComments } from "@/lib/sentiment"
import { instagramShortcodeToId, instagramShortcodeFromUrl } from "@/lib/instagram-id"

const APIFY_TOKEN = process.env.APIFY_API_TOKEN

// Actor IDs from your schedule "My Schedule 5"
const SCHEDULED_ACTORS = {
  twitter: "Fo9GoU5wC270BgcBr",        // Twitter/X scraper for @samsunggulf
  facebook: "KoJrdxJCTtpon81KY",       // Facebook scraper for SamsungGulf
  tiktok: "Zk4NL09KuDccV11Z4",         // TikTok COMMENTS scraper for @samsunggulf
  tiktokPosts: "GdWCkxBtKWOsKjdch",    // TikTok posts/videos scraper for @samsunggulf
  instagramComments: "dIKFJ95TN8YclK2no", // Instagram comments scraper
  instagram: "nH2AHrwxeTRJoN5hX",      // Instagram posts scraper for samsunggulf
  // URL-driven comment scrapers. These are NOT in the Apify schedule — their
  // input (recent post URLs) changes daily, so each sync fires fresh runs via
  // startCommentScrapes() and ingests the previous runs' datasets.
  facebookComments: "us5srxAYnsrkgUv2v", // apify/facebook-comments-scraper
  // apidojo/tweet-scraper with conversationIds. (scraper_one's replies actor
  // returned 0 items for 21 of 24 runs — do not go back to it.)
  twitterReplies: "61RPP7dywgiy0JPD0",
}

const SCHEDULE_ID = "AzNWcc9ZQxFcie6el"

// Public store actors used for the late-comment recheck (posts keep receiving
// comments for days after the nightly scrape). SHARED with the Galaxy
// Unpacked pipeline — safe because each side filters ingested comments to its
// own parent posts (brand posts here, campaign posts there).
const PUBLIC_COMMENT_ACTORS = {
  instagram: "SbK00X0JYCPblD2wp", // apify/instagram-comment-scraper
  tiktok: "BDec00yAmCm1QbMEI", // clockworks/tiktok-comments-scraper
}

// The tables also hold retailer/operator accounts from other scrapes; the
// brand pipeline must only scrape and attribute @samsunggulf content.
const BRAND_POST_COLUMNS =
  "external_id,platform,post_url,caption,published_at," +
  "owner_ig:raw_data->>ownerUsername,owner_tt:raw_data->authorMeta->>name," +
  "owner_fb:raw_data->>pageName,owner_tw:raw_data->author->>userName," +
  "src_input:raw_data->>inputUrl,src_fb:raw_data->>facebookUrl"

function isBrandAuthored(p: any): boolean {
  const s = (v: unknown) => String(v || "").toLowerCase().replace(/\s+/g, "")
  switch (p.platform) {
    case "instagram":
      return s(p.owner_ig) === "samsunggulf"
    case "tiktok":
      return s(p.owner_tt) === "samsunggulf"
    case "facebook":
      return (
        s(p.owner_fb) === "samsunggulf" ||
        s(p.src_input).includes("/samsunggulf") ||
        s(p.src_fb).includes("/samsunggulf")
      )
    case "twitter":
      return s(p.owner_tw) === "samsunggulf" || s(p.post_url).includes("/samsunggulf/")
    default:
      return false
  }
}

// Brand-authored posts for a platform, optionally limited to a publish
// window. Paginated — the posts table holds 16k+ rows across many accounts.
async function getBrandPosts(platform: string, sinceIso?: string): Promise<any[]> {
  const supabase = await createClient()
  const PAGE = 1000
  const rows: any[] = []
  let from = 0
  while (true) {
    let q = supabase
      .from("social_posts")
      .select(BRAND_POST_COLUMNS)
      .eq("platform", platform)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (sinceIso) q = q.gte("published_at", sinceIso)
    const { data, error } = await q
    if (error || !data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows.filter(isBrandAuthored)
}

interface ApifyRun {
  id: string
  actId: string
  status: string
  startedAt: string
  finishedAt: string
  defaultDatasetId: string
}

interface TwitterPost {
  type: string
  id: string
  url: string
  text: string
  fullText: string
  likeCount: number
  replyCount: number
  retweetCount: number
  viewCount: number
  createdAt: string
  author: {
    userName: string
    name: string
    profilePicture: string
    followers: number
    isVerified: boolean
  }
  media?: string[]
}

interface InstagramPost {
  id: string
  shortCode: string
  url: string
  caption: string
  likesCount: number
  commentsCount: number
  videoViewCount?: number
  timestamp: string
  ownerUsername: string
  displayUrl: string
  type: string
}

interface TikTokPost {
  id: string
  webVideoUrl: string
  text: string
  diggCount: number
  commentCount: number
  shareCount: number
  playCount: number
  createTime: number
  authorMeta: {
    name: string
    nickName: string
    avatar: string
    fans: number
    verified: boolean
  }
}

interface FacebookPost {
  postId: string
  url: string
  text: string
  likes: number
  comments: number
  shares: number
  time: string
  pageName: string
}

export async function getLatestRuns(actorId: string, limit = 5): Promise<ApifyRun[]> {
  const response = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}&limit=${limit}&desc=true&status=SUCCEEDED`
  )
  const data = await response.json()
  return data.data?.items || []
}

// Fetch ALL items from a dataset, paginating past Apify's per-request cap so a
// large scrape is never silently truncated. `maxItems` is a safety ceiling.
export async function getDatasetItems<T>(datasetId: string, maxItems = 50000): Promise<T[]> {
  const PAGE_SIZE = 1000
  const all: T[] = []
  let offset = 0
  while (all.length < maxItems) {
    const response = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${PAGE_SIZE}&offset=${offset}`
    )
    if (!response.ok) {
      console.error(`[v0] Dataset ${datasetId} fetch failed: ${response.status}`)
      break
    }
    const page = (await response.json()) as T[]
    if (!Array.isArray(page) || page.length === 0) break
    all.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return all
}

// How many recent runs to ingest per sync. Each daily Apify run only contains
// that day's scrape, so reading several runs back-fills any days missed
// between syncs (the upsert dedupes overlap).
const RUNS_TO_SYNC = 7

// Items from the last `runCount` succeeded runs, oldest run first so that when
// the same item appears in several runs, the newest scrape wins the upsert.
async function getRecentRunsItems<T>(actorId: string, runCount = RUNS_TO_SYNC): Promise<T[]> {
  const runs = await getLatestRuns(actorId, runCount)
  const all: T[] = []
  for (const run of runs.reverse()) {
    all.push(...(await getDatasetItems<T>(run.defaultDatasetId)))
  }
  return all
}

export async function syncTwitterPosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const posts = await getRecentRunsItems<TwitterPost>(SCHEDULED_ACTORS.twitter, runCount)
  let inserted = 0, updated = 0
  const errors: string[] = []
  
  console.log("[v0] Twitter posts fetched:", posts.length)
  if (posts.length > 0) {
    console.log("[v0] Twitter first post keys:", Object.keys(posts[0]))
    console.log("[v0] Twitter first post sample:", JSON.stringify(posts[0]).slice(0, 500))
  }
  
  for (const post of posts) {
    const p = post as any
    // The current actor emits postId/postText/postUrl; older actors used
    // id/text/url variants, so try every known shape.
    const externalId =
      post.id || p.postId || p.tweetId || p.id_str || p.rest_id ||
      (p.postUrl ? String(p.postUrl).match(/status\/(\d+)/)?.[1] : undefined)

    if (!externalId) {
      errors.push("No ID found for post: " + JSON.stringify(Object.keys(p)))
      continue
    }

    // media can be an array of URLs (old actor) or an object (current actor).
    const mediaObj = p.media
    const mediaUrl = Array.isArray(mediaObj)
      ? mediaObj[0]
      : mediaObj?.mediaUrlHttps || mediaObj?.media_url_https || undefined
    const mediaType = Array.isArray(mediaObj)
      ? (mediaObj.length ? "video" : "text")
      : mediaObj?.type || "text"

    // timestamp is epoch milliseconds on the current actor; createdAt on old ones.
    const publishedAt = post.createdAt
      ? new Date(post.createdAt).toISOString()
      : typeof p.timestamp === "number"
        ? new Date(p.timestamp).toISOString()
        : new Date().toISOString()

    const { error } = await supabase
      .from("social_posts")
      .upsert({
        platform: "twitter",
        external_id: String(externalId),
        post_url: post.url || p.tweetUrl || p.postUrl || `https://twitter.com/i/status/${externalId}`,
        caption: post.fullText || post.text || p.full_text || p.postText || "",
        media_type: mediaType,
        media_url: mediaUrl,
        likes_count: post.likeCount || p.favorite_count || p.favouriteCount || 0,
        comments_count: post.replyCount || p.reply_count || 0,
        shares_count: post.retweetCount || p.retweet_count || p.repostCount || 0,
        views_count: post.viewCount || p.views_count || 0,
        published_at: publishedAt,
        scraped_at: new Date().toISOString(),
        raw_data: post,
      }, { onConflict: "platform,external_id" })
    
    if (error) {
      errors.push(error.message)
    } else {
      inserted++
    }
  }
  
  if (errors.length > 0) {
    console.log("[v0] Twitter sync errors (first 5):", errors.slice(0, 5))
  }
  
  console.log("[v0] Twitter inserted:", inserted, "of", posts.length)
  
  return { inserted, updated, total: posts.length }
}

export async function syncInstagramPosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const posts = await getRecentRunsItems<InstagramPost>(SCHEDULED_ACTORS.instagram, runCount)
  let inserted = 0

  for (const post of posts) {
    // Only the brand's own posts. The FF8 roster pipeline also runs this
    // actor (historical influencer scrapes) — its runs must not be ingested
    // here as brand posts.
    if ((post.ownerUsername || "").toLowerCase() !== "samsunggulf") continue
    const { error } = await supabase
      .from("social_posts")
      .upsert({
        platform: "instagram",
        external_id: post.id || post.shortCode,
        post_url: post.url,
        caption: post.caption,
        media_type: post.type || "image",
        media_url: post.displayUrl,
        likes_count: post.likesCount || 0,
        comments_count: post.commentsCount || 0,
        views_count: post.videoViewCount || 0,
        published_at: post.timestamp ? new Date(post.timestamp).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: post,
      }, { onConflict: "platform,external_id" })
    
    if (!error) inserted++
  }
  
  return { inserted, total: posts.length }
}

// TikTok actor returns COMMENTS, not posts
export async function syncTikTokPosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()

  // The TikTok actor scrapes comments, not posts
  const rawComments = await getRecentRunsItems<{
    video_url: string
    comment_id: string
    comment: string
    likes: number
    reply_count: number
    created_at: string
    author_username: string
    author_display_name: string
    comment_language: string
  }>(SCHEDULED_ACTORS.tiktok, runCount)

  // Consecutive runs re-scrape the same recent videos, so dedupe by comment id
  // (newest scrape wins) before hitting Supabase.
  const byId = new Map<string, (typeof rawComments)[number]>()
  for (const c of rawComments) {
    if (c.comment_id) byId.set(c.comment_id, c)
  }
  const comments = [...byId.values()]

  let inserted = 0
  const errors: string[] = []
  
  for (const comment of comments) {
    if (!comment.comment_id) {
      errors.push("No comment_id found")
      continue
    }
    
    // Extract video ID from URL for external_post_id
    const videoIdMatch = comment.video_url?.match(/video\/(\d+)/)
    const externalPostId = videoIdMatch ? videoIdMatch[1] : comment.video_url || "unknown"
    
    const { error } = await supabase
      .from("social_comments")
      .upsert({
        platform: "tiktok",
        external_id: comment.comment_id,
        external_post_id: externalPostId,
        text: comment.comment || "",
        author_username: comment.author_username || comment.author_display_name || "unknown",
        author_display_name: comment.author_display_name,
        likes_count: comment.likes || 0,
        replies_count: comment.reply_count || 0,
        published_at: comment.created_at ? new Date(comment.created_at).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: comment,
      }, { onConflict: "platform,external_id" })
    
    if (error) {
      errors.push(error.message)
    } else {
      inserted++
    }
  }
  
  if (errors.length > 0) {
    console.log("[v0] TikTok sync errors (first 5):", errors.slice(0, 5))
  }

  // The TikTok actor only returns comments, so synthesize a stub post row per
  // distinct video. Without these, TikTok comments have no parent post and the
  // dashboard can't link to or attribute them.
  const videos = new Map<string, { url: string; count: number }>()
  for (const comment of comments) {
    if (!comment.video_url) continue
    const videoIdMatch = comment.video_url.match(/video\/(\d+)/)
    const videoId = videoIdMatch ? videoIdMatch[1] : comment.video_url
    const existing = videos.get(videoId)
    if (existing) existing.count++
    else videos.set(videoId, { url: comment.video_url, count: 1 })
  }
  for (const [videoId, v] of videos) {
    await supabase
      .from("social_posts")
      .upsert({
        platform: "tiktok",
        external_id: videoId,
        post_url: v.url,
        caption: "",
        media_type: "video",
        comments_count: v.count,
        published_at: new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: { source: "derived_from_comments", video_url: v.url },
      }, { onConflict: "platform,external_id", ignoreDuplicates: true })
  }

  return { inserted, total: comments.length }
}

// TikTok posts scraper (clockworks/tiktok-scraper) — real video data (caption,
// plays, likes) that overwrites the stub rows synthesized from comments.
export async function syncTikTokVideos(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const posts = await getRecentRunsItems<TikTokPost>(SCHEDULED_ACTORS.tiktokPosts, runCount)
  let inserted = 0
  const errors: string[] = []

  for (const post of posts) {
    const p = post as any
    if (!post.id) continue
    // Only the brand's own videos. The Galaxy Unpacked pipeline also runs
    // this actor (keyword-search mode for influencer discovery), and its runs
    // must not be ingested here as brand posts.
    if ((post.authorMeta?.name || "").toLowerCase() !== "samsunggulf") continue

    const { error } = await supabase
      .from("social_posts")
      .upsert({
        platform: "tiktok",
        external_id: String(post.id),
        post_url: post.webVideoUrl || `https://www.tiktok.com/@${p.authorMeta?.name || "samsunggulf"}/video/${post.id}`,
        caption: post.text || "",
        media_type: "video",
        media_url: p.videoMeta?.coverUrl || undefined,
        likes_count: post.diggCount || 0,
        comments_count: post.commentCount || 0,
        shares_count: post.shareCount || 0,
        views_count: post.playCount || 0,
        published_at: p.createTimeISO
          ? new Date(p.createTimeISO).toISOString()
          : post.createTime
            ? new Date(post.createTime * 1000).toISOString()
            : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: post,
      }, { onConflict: "platform,external_id" })

    if (error) errors.push(error.message)
    else inserted++
  }

  if (errors.length > 0) {
    console.log("[v0] TikTok videos sync errors (first 5):", errors.slice(0, 5))
  }

  return { inserted, total: posts.length }
}

// Ingest Facebook comments from recent facebook-comments-scraper runs.
// Brand-authored comments are skipped — the page replying to customers is not
// customer sentiment.
export async function syncFacebookComments(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const items = await getRecentRunsItems<any>(SCHEDULED_ACTORS.facebookComments, runCount)

  const byId = new Map<string, any>()
  for (const c of items) {
    if (c?.error || !c?.commentId) continue
    if ((c.profileName || "").trim().toLowerCase() === "samsung gulf") continue
    byId.set(String(c.commentId), c)
  }

  let inserted = 0
  const errors: string[] = []
  for (const c of byId.values()) {
    const parentUrl = String(c.facebookUrl || c.inputUrl || "")
    const numericId = parentUrl.match(/\/(\d{10,})/)?.[1]
    const { error } = await supabase
      .from("social_comments")
      .upsert({
        platform: "facebook",
        external_id: String(c.commentId),
        // Numeric id when the URL carries one (reels); otherwise the post URL —
        // /api/comments resolves either form.
        external_post_id: numericId || parentUrl || "unknown",
        text: c.text || "",
        author_username: c.profileName || "Facebook User",
        likes_count: c.likesCount || 0,
        published_at: c.date ? new Date(c.date).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: c,
      }, { onConflict: "platform,external_id" })
    if (error) errors.push(error.message)
    else inserted++
  }
  if (errors.length > 0) console.log("[v0] FB comments sync errors (first 5):", errors.slice(0, 5))
  return { inserted, total: items.length }
}

// Ingest X replies from recent apidojo/tweet-scraper runs (conversationIds
// mode). Replies authored by the brand account itself are skipped.
export async function syncTwitterReplies(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const items = await getRecentRunsItems<any>(SCHEDULED_ACTORS.twitterReplies, runCount)

  const byId = new Map<string, any>()
  const brandTweets = new Map<string, any>()
  for (const r of items) {
    if (!r?.id) continue
    if ((r.author?.userName || "").toLowerCase() === "samsunggulf") {
      // Samsung's own thread tweets are POSTS the profile scraper misses
      // (it only returns top-level posts) — capture them here.
      if (!r.isRetweet) brandTweets.set(String(r.id), r)
      continue
    }
    if (!r.isReply) continue
    byId.set(String(r.id), r)
  }

  let inserted = 0
  const errors: string[] = []

  for (const t of brandTweets.values()) {
    const publishedAt = t.createdAt ? new Date(t.createdAt) : new Date()
    await supabase
      .from("social_posts")
      .upsert({
        platform: "twitter",
        external_id: String(t.id),
        post_url: t.url || t.twitterUrl || `https://x.com/SamsungGulf/status/${t.id}`,
        caption: t.text || t.fullText || "",
        media_type: "text",
        likes_count: t.likeCount || 0,
        comments_count: t.replyCount || 0,
        shares_count: t.retweetCount || 0,
        views_count: Number(t.viewCount) || 0,
        published_at: isNaN(publishedAt.getTime()) ? new Date().toISOString() : publishedAt.toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: t,
      }, { onConflict: "platform,external_id" })
  }
  for (const r of byId.values()) {
    const publishedAt = r.createdAt ? new Date(r.createdAt) : new Date()
    const { error } = await supabase
      .from("social_comments")
      .upsert({
        platform: "twitter",
        external_id: String(r.id),
        external_post_id: String(r.conversationId || r.inReplyToId || "unknown"),
        text: r.text || r.fullText || "",
        author_username: r.author?.userName || "unknown",
        author_display_name: r.author?.name,
        likes_count: r.likeCount || 0,
        replies_count: r.replyCount || 0,
        published_at: isNaN(publishedAt.getTime()) ? new Date().toISOString() : publishedAt.toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: r,
      }, { onConflict: "platform,external_id" })
    if (error) errors.push(error.message)
    else inserted++
  }
  if (errors.length > 0) console.log("[v0] X replies sync errors (first 5):", errors.slice(0, 5))
  return { inserted, total: items.length }
}

// Fire comment scrapes for BRAND posts published in the last `daysBack` days.
// Every post is re-scraped nightly for `daysBack` days after publishing, so
// comments that arrive after the first scrape are still captured. Fire-and-
// forget with charge caps: today's runs are ingested by TOMORROW's sync
// (getRecentRunsItems), so the cron never waits on them.
export async function startCommentScrapes(daysBack = 3) {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString()
  const started: Record<string, string | null> = {
    facebookComments: null,
    twitterReplies: null,
    instagramComments: null,
    tiktokComments: null,
  }

  const fbPosts = await getBrandPosts("facebook", since)
  const fbUrls = [...new Set(fbPosts.filter((p) => p.post_url).map((p: any) => String(p.post_url).replace(/\/+$/, "")))]
  if (fbUrls.length > 0) {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${SCHEDULED_ACTORS.facebookComments}/runs?token=${APIFY_TOKEN}&maxTotalChargeUsd=2`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: fbUrls.map((url) => ({ url })),
          resultsLimit: 300,
          includeNestedComments: false,
        }),
      },
    )
    const out = await res.json().catch(() => null)
    started.facebookComments = out?.data?.id || null
  }

  // Wider window for X: replies often land days after the tweet, so re-scrape
  // conversations for the last 14 days of tweets (cheap at per-reply pricing).
  const xSince = new Date(Date.now() - Math.max(daysBack, 14) * 86400000).toISOString()
  const xPosts = await getBrandPosts("twitter", xSince)
  const conversationIds = [...new Set(xPosts.map((p: any) => String(p.external_id)))]
    .filter((id) => /^\d+$/.test(id))
  if (conversationIds.length > 0) {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${SCHEDULED_ACTORS.twitterReplies}/runs?token=${APIFY_TOKEN}&maxTotalChargeUsd=2`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationIds, maxItems: 2000 }),
      },
    )
    const out = await res.json().catch(() => null)
    started.twitterReplies = out?.data?.id || null
  }

  // Instagram + TikTok late-comment recheck: the scheduled comment actors
  // only cover the newest posts, so re-scrape every brand post from the last
  // `daysBack` days via the public actors.
  const igPosts = await getBrandPosts("instagram", since)
  const igUrls = [...new Set(igPosts.filter((p) => p.post_url).map((p: any) => String(p.post_url)))]
  if (igUrls.length > 0) {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${PUBLIC_COMMENT_ACTORS.instagram}/runs?token=${APIFY_TOKEN}&maxTotalChargeUsd=2`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directUrls: igUrls, resultsLimit: 300 }),
      },
    )
    const out = await res.json().catch(() => null)
    started.instagramComments = out?.data?.id || null
  }

  const ttPosts = await getBrandPosts("tiktok", since)
  const ttUrls = [...new Set(ttPosts.filter((p) => p.post_url).map((p: any) => String(p.post_url)))]
  if (ttUrls.length > 0) {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${PUBLIC_COMMENT_ACTORS.tiktok}/runs?token=${APIFY_TOKEN}&maxTotalChargeUsd=2`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postURLs: ttUrls, commentsPerPost: 300 }),
      },
    )
    const out = await res.json().catch(() => null)
    started.tiktokComments = out?.data?.id || null
  }

  return started
}

// One-off backfill: fire comment scrapes for the FOLD 7 / FLIP 7 launch
// window (July 9–20, 2025) so last year's launch sentiment has full data for
// the day-N comparison against FF8. Comment sections persist on old posts,
// so scraping them today returns the 2025 comments. Ingestion happens via
// the normal sync paths (syncFacebookComments / syncTwitterReplies /
// syncLateComments all resolve parents across the full brand history).
const F7_MARKERS = /fold|flip|فولد|فليب|فلب|unpacked|انباكد|أنباكد|galaxy\s*z/i

export async function startF7CommentBackfill() {
  const startIso = "2025-07-08T20:00:00Z" // Jul 9, 2025 00:00 Gulf
  const endMs = Date.parse("2025-07-20T20:00:00Z") // Jul 21, 2025 00:00 Gulf
  const inWindow = (rows: any[]) =>
    rows.filter(
      (p) => Date.parse(p.published_at) < endMs && F7_MARKERS.test(p.caption || ""),
    )
  const started: Record<string, string | null> = {}

  const fire = async (actorId: string, input: Record<string, unknown>) => {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}&maxTotalChargeUsd=3`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    )
    const out = await res.json().catch(() => null)
    return out?.data?.id || null
  }

  const ig = inWindow(await getBrandPosts("instagram", startIso))
  const igUrls = [...new Set(ig.filter((p) => p.post_url).map((p) => String(p.post_url)))]
  if (igUrls.length > 0)
    started.f7Instagram = await fire(PUBLIC_COMMENT_ACTORS.instagram, {
      directUrls: igUrls,
      resultsLimit: 300,
    })

  const tt = inWindow(await getBrandPosts("tiktok", startIso))
  const ttUrls = [...new Set(tt.filter((p) => p.post_url).map((p) => String(p.post_url)))]
  if (ttUrls.length > 0)
    started.f7TikTok = await fire(PUBLIC_COMMENT_ACTORS.tiktok, {
      postURLs: ttUrls,
      commentsPerPost: 300,
    })

  const fb = inWindow(await getBrandPosts("facebook", startIso))
  const fbUrls = [...new Set(fb.filter((p) => p.post_url).map((p) => String(p.post_url).replace(/\/+$/, "")))]
  if (fbUrls.length > 0)
    started.f7Facebook = await fire(SCHEDULED_ACTORS.facebookComments, {
      startUrls: fbUrls.map((url) => ({ url })),
      resultsLimit: 300,
      includeNestedComments: false,
    })

  const x = inWindow(await getBrandPosts("twitter", startIso))
  const conversationIds = [...new Set(x.map((p) => String(p.external_id)))].filter((id) => /^\d+$/.test(id))
  if (conversationIds.length > 0)
    started.f7Twitter = await fire(SCHEDULED_ACTORS.twitterReplies, {
      conversationIds,
      maxItems: 3000,
    })

  return {
    started,
    postsTargeted: {
      instagram: igUrls.length,
      tiktok: ttUrls.length,
      facebook: fbUrls.length,
      twitter: conversationIds.length,
    },
  }
}

// Ingest brand comments from the public comment actors' recent runs. These
// actors are shared with the Galaxy Unpacked pipeline, so ONLY comments whose
// parent is a brand post are kept.
export async function syncLateComments(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  let inserted = 0

  // Instagram — items: { id, text, ownerUsername, timestamp, likesCount, postUrl }
  const igBrand = await getBrandPosts("instagram")
  const igKeys = new Set<string>()
  for (const p of igBrand) {
    const extId = String(p.external_id || "")
    if (extId) igKeys.add(extId)
    const sc = instagramShortcodeFromUrl(p.post_url || "")
    if (sc) {
      igKeys.add(sc)
      const numeric = instagramShortcodeToId(sc)
      if (numeric) igKeys.add(numeric)
    }
  }
  const igItems = await (async () => {
    const runs = await getLatestRuns(PUBLIC_COMMENT_ACTORS.instagram, runCount)
    const all: any[] = []
    for (const run of runs.reverse()) all.push(...(await getDatasetItems<any>(run.defaultDatasetId)))
    return all
  })()
  const igSeen = new Set<string>()
  for (const c of [...igItems].reverse()) {
    const text = (c.text || "").trim()
    if (!text) continue
    const sc = instagramShortcodeFromUrl(c.postUrl || "")
    if (!sc) continue
    const numeric = instagramShortcodeToId(sc)
    if (!igKeys.has(sc) && !igKeys.has(numeric || "")) continue
    const commentId = c.id || `${sc}_${c.ownerUsername || "user"}_${c.timestamp || text.slice(0, 40)}`
    if (igSeen.has(String(commentId))) continue
    igSeen.add(String(commentId))
    const { error } = await supabase.from("social_comments").upsert(
      {
        platform: "instagram",
        external_id: String(commentId),
        external_post_id: numeric || sc,
        text,
        author_username: c.ownerUsername || "unknown",
        likes_count: c.likesCount || 0,
        published_at: c.timestamp ? new Date(c.timestamp).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: c,
      },
      { onConflict: "platform,external_id" },
    )
    if (!error) inserted++
  }

  // TikTok — items: { cid, text, diggCount, uniqueId, createTimeISO, videoWebUrl }
  const ttBrand = await getBrandPosts("tiktok")
  const ttKeys = new Set<string>(ttBrand.map((p) => String(p.external_id || "")))
  const ttItems = await (async () => {
    const runs = await getLatestRuns(PUBLIC_COMMENT_ACTORS.tiktok, runCount)
    const all: any[] = []
    for (const run of runs.reverse()) all.push(...(await getDatasetItems<any>(run.defaultDatasetId)))
    return all
  })()
  const ttSeen = new Set<string>()
  for (const c of [...ttItems].reverse()) {
    const text = (c.text || c.comment || "").trim()
    if (!text) continue
    const videoUrl = c.videoWebUrl || c.submittedVideoUrl || c.video_url || ""
    const videoId = videoUrl.match(/video\/(\d+)/)?.[1]
    if (!videoId || !ttKeys.has(videoId)) continue
    const commentId = c.cid || c.id
    if (!commentId || ttSeen.has(String(commentId))) continue
    ttSeen.add(String(commentId))
    const { error } = await supabase.from("social_comments").upsert(
      {
        platform: "tiktok",
        external_id: String(commentId),
        external_post_id: videoId,
        text,
        author_username: c.uniqueId || c.user?.uniqueId || c.author_username || "unknown",
        likes_count: c.diggCount ?? c.likes ?? 0,
        published_at: c.createTimeISO
          ? new Date(c.createTimeISO).toISOString()
          : c.created_at
            ? new Date(c.created_at).toISOString()
            : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: c,
      },
      { onConflict: "platform,external_id" },
    )
    if (!error) inserted++
  }

  return { inserted, total: igItems.length + ttItems.length }
}

export async function syncFacebookPosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const posts = await getRecentRunsItems<FacebookPost>(SCHEDULED_ACTORS.facebook, runCount)
  let inserted = 0
  
  for (const post of posts) {
    const { error } = await supabase
      .from("social_posts")
      .upsert({
        platform: "facebook",
        external_id: post.postId,
        post_url: post.url,
        caption: post.text,
        media_type: "post",
        likes_count: post.likes || 0,
        comments_count: post.comments || 0,
        shares_count: post.shares || 0,
        published_at: post.time ? new Date(post.time).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: post,
      }, { onConflict: "platform,external_id" })
    
    if (!error) inserted++
  }
  
  return { inserted, total: posts.length }
}

export async function syncInstagramComments(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const comments = await getRecentRunsItems<{
    id: string
    text: string
    ownerUsername: string
    timestamp: string
    likesCount: number
    postUrl: string
    postId?: string
  }>(SCHEDULED_ACTORS.instagramComments, runCount)

  console.log("[v0] Instagram Comments fetched:", comments.length)
  if (comments.length > 0) {
    console.log("[v0] Instagram Comments first item keys:", Object.keys(comments[0]))
    console.log("[v0] Instagram Comments first item sample:", JSON.stringify(comments[0]).slice(0, 500))
  }
  
  let inserted = 0
  const errors: string[] = []

  // Consecutive runs re-scrape the same recent posts; iterate newest run first
  // and skip ids already handled so each comment is upserted once per sync.
  const seenIds = new Set<string>()

  for (const comment of [...comments].reverse()) {
    // Instagram Comments actor has nested structure with postInfo
    const rawComment = comment as Record<string, unknown>
    const postInfo = rawComment.postInfo as Record<string, unknown> | undefined
    
    // Extract fields from the Instagram Comments actor structure
    const commentText = (rawComment.commentText as string) || (rawComment.text as string) || ""
    const commentTimestamp = (rawComment.commentTimestamp as string) || (rawComment.timestamp as string)
    const commentatorUsername = (rawComment.commentatorUserName as string) || (rawComment.ownerUsername as string) || "unknown"
    
    // Post reference in the legacy precedence (shortCode first) — this exact
    // string feeds the synthetic comment id below, so it must never change
    // encoding or every already-synced comment would get a new id (= dupes).
    const legacyPostRef = String(
      postInfo?.shortCode || postInfo?.id || rawComment.postId || rawComment.shortCode ||
      (rawComment.postUrl ? instagramShortcodeFromUrl(String(rawComment.postUrl)) : "") ||
      "",
    )
    // Instagram POSTS are keyed by numeric media id, so normalize shortcodes to
    // the numeric id (same number, two encodings) or the post join fails.
    const externalPostId = /^\d+$/.test(legacyPostRef)
      ? legacyPostRef
      : instagramShortcodeToId(legacyPostRef) || legacyPostRef || "unknown"
    
    // Generate unique comment ID: combine post shortcode + username + timestamp
    // (Instagram Comments actor doesn't provide one). The fallback must be
    // STABLE across syncs — Date.now() would mint a fresh id every run and
    // re-insert the same comment as a duplicate each day. Uses legacyPostRef
    // (shortcode form), NOT externalPostId, to match ids already in the table.
    const uniqueKey = `${legacyPostRef || "unknown"}_${commentatorUsername}_${commentTimestamp || commentText.slice(0, 40)}`
    const commentId = rawComment.id || rawComment.pk || rawComment.cid || uniqueKey
    
    if (!commentId) {
      errors.push("No comment id found: " + JSON.stringify(Object.keys(comment)))
      continue
    }
    if (seenIds.has(String(commentId))) continue
    seenIds.add(String(commentId))


    const { error } = await supabase
      .from("social_comments")
      .upsert({
        platform: "instagram",
        external_id: String(commentId),
        external_post_id: externalPostId,
        text: commentText,
        author_username: commentatorUsername,
        likes_count: Number(rawComment.likesCount) || 0,
        published_at: commentTimestamp ? new Date(commentTimestamp).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: comment,
      }, { onConflict: "platform,external_id" })
    
    if (error) {
      errors.push(error.message)
    } else {
      inserted++
    }
  }
  
  if (errors.length > 0) {
    console.log("[v0] Instagram comments sync errors (first 5):", errors.slice(0, 5))
  }
  
  console.log("[v0] Instagram Comments inserted:", inserted, "of", comments.length)
  
  return { inserted, total: comments.length }
}

// `runCount` lets a manual backfill ingest deeper history (e.g. every run
// since the schedule was created) instead of the default recent window.
// `ingestOnly` harvests completed Apify runs without starting new paid ones.
export async function syncAllPlatforms(runCount = RUNS_TO_SYNC, opts: { ingestOnly?: boolean } = {}) {
  const results = {
    twitter: await syncTwitterPosts(runCount),
    instagram: await syncInstagramPosts(runCount),
    instagramComments: await syncInstagramComments(runCount),
    tiktok: await syncTikTokPosts(runCount),
    // After comments, so real video data overwrites the comment-derived stubs.
    tiktokVideos: await syncTikTokVideos(runCount),
    facebook: await syncFacebookPosts(runCount),
    facebookComments: await syncFacebookComments(runCount),
    twitterReplies: await syncTwitterReplies(runCount),
    // IG/TikTok late-comment recheck runs (public actors, brand-filtered).
    lateComments: await syncLateComments(runCount),
  }

  // Kick off today's comment scrapes for fresh posts (ingested tomorrow).
  if (!opts.ingestOnly) {
    try {
      await startCommentScrapes()
    } catch (e) {
      console.error("[v0] Failed to start comment scrapes:", e)
    }
  }

  // After syncing, analyze any freshly inserted comments so the dashboard never
  // falls back to keyword sentiment. Capped per run to keep sync responsive.
  let analyzed = 0
  try {
    analyzed = await analyzeUnanalyzedComments(1500)
  } catch (e) {
    console.error("[v0] Post-sync sentiment analysis failed:", e)
  }

  return { ...results, sentimentAnalyzed: analyzed }
}

// Analyze comments that have not yet been processed by the LLM and persist the
// sentiment back to Supabase. Returns the number of comments analyzed.
export async function analyzeUnanalyzedComments(limit = 500): Promise<number> {
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from("social_comments")
    .select("external_id, text, platform")
    .is("sentiment_analyzed_at", null)
    .not("text", "is", null)
    .limit(limit)

  if (error || !rows || rows.length === 0) return 0

  const toAnalyze = rows
    .filter((r: any) => (r.text || "").trim().length > 0)
    .map((r: any) => ({ id: r.external_id as string, text: r.text as string }))

  if (toAnalyze.length === 0) return 0

  let persisted = 0
  const now = new Date().toISOString()

  await analyzeComments(toAnalyze, {
    batchSize: 25,
    delayMs: 300,
    concurrency: 4,
    onBatch: async (batchResults) => {
      // Skip failed placeholders so those comments are retried next sync
      // instead of being permanently stamped as neutral.
      const real = batchResults.filter((res) => !res.failed)
      await Promise.all(
        real.map((res) =>
          supabase
            .from("social_comments")
            .update({
              sentiment: res.sentiment,
              sentiment_score: res.score,
              flags: res.flags,
              sentiment_analyzed_at: now,
            })
            .eq("external_id", res.id),
        ),
      )
      persisted += real.length
    },
  })

  return persisted
}

// Get all runs for all scheduled actors
export async function getAllScheduledRuns() {
  const allRuns: Record<string, ApifyRun[]> = {}
  
  for (const [platform, actorId] of Object.entries(SCHEDULED_ACTORS)) {
    try {
      allRuns[platform] = await getLatestRuns(actorId, 3)
    } catch (e) {
      console.error(`Failed to get runs for ${platform}:`, e)
      allRuns[platform] = []
    }
  }
  
  return allRuns
}

// Trigger a manual run of every actor in the schedule. Apify has no
// "run schedule now" endpoint, so start each actor with the input (and charge
// cap) stored on the schedule's actions.
export async function triggerScheduleRun() {
  const schedRes = await fetch(`https://api.apify.com/v2/schedules/${SCHEDULE_ID}?token=${APIFY_TOKEN}`)
  const sched = await schedRes.json()
  const actions: Array<{
    actorId: string
    runInput?: { body: string; contentType: string }
    runOptions?: { maxTotalChargeUsd?: number; timeoutSecs?: number }
  }> = sched.data?.actions || []

  const started: Array<{ actorId: string; runId?: string; error?: string }> = []
  for (const action of actions) {
    const params = new URLSearchParams({ token: APIFY_TOKEN || "" })
    if (action.runOptions?.maxTotalChargeUsd) {
      params.set("maxTotalChargeUsd", String(action.runOptions.maxTotalChargeUsd))
    }
    try {
      const res = await fetch(`https://api.apify.com/v2/acts/${action.actorId}/runs?${params}`, {
        method: "POST",
        headers: { "Content-Type": action.runInput?.contentType || "application/json" },
        body: action.runInput?.body || "{}",
      })
      const out = await res.json()
      started.push(
        res.ok
          ? { actorId: action.actorId, runId: out.data?.id }
          : { actorId: action.actorId, error: out.error?.message || `HTTP ${res.status}` },
      )
    } catch (e) {
      started.push({ actorId: action.actorId, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return { started }
}
