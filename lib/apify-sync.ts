// Apify Data Sync Service
// Fetches data from Apify datasets and syncs to Supabase

import { createClient } from "@/lib/supabase/server"
import { analyzeComments } from "@/lib/sentiment"

const APIFY_TOKEN = process.env.APIFY_API_TOKEN

// Actor IDs from your schedule "My Schedule 5"
const SCHEDULED_ACTORS = {
  twitter: "Fo9GoU5wC270BgcBr",        // Twitter/X scraper for @samsunggulf
  facebook: "KoJrdxJCTtpon81KY",       // Facebook scraper for SamsungGulf
  tiktok: "Zk4NL09KuDccV11Z4",         // TikTok scraper for @samsunggulf
  instagramComments: "dIKFJ95TN8YclK2no", // Instagram comments scraper
  instagram: "nH2AHrwxeTRJoN5hX",      // Instagram posts scraper for samsunggulf
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

export async function syncTwitterPosts() {
  const supabase = await createClient()
  const runs = await getLatestRuns(SCHEDULED_ACTORS.twitter, 1)
  
  console.log("[v0] Twitter runs:", runs.length, runs[0]?.defaultDatasetId)
  
  if (runs.length === 0) return { inserted: 0, updated: 0, total: 0 }
  
  const posts = await getDatasetItems<TwitterPost>(runs[0].defaultDatasetId)
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

export async function syncInstagramPosts() {
  const supabase = await createClient()
  const runs = await getLatestRuns(SCHEDULED_ACTORS.instagram, 1)
  
  if (runs.length === 0) return { inserted: 0, updated: 0 }
  
  const posts = await getDatasetItems<InstagramPost>(runs[0].defaultDatasetId)
  let inserted = 0
  
  for (const post of posts) {
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
export async function syncTikTokPosts() {
  const supabase = await createClient()
  const runs = await getLatestRuns(SCHEDULED_ACTORS.tiktok, 1)
  
  if (runs.length === 0) return { inserted: 0, updated: 0 }
  
  // The TikTok actor scrapes comments, not posts
  const comments = await getDatasetItems<{
    video_url: string
    comment_id: string
    comment: string
    likes: number
    reply_count: number
    created_at: string
    author_username: string
    author_display_name: string
    comment_language: string
  }>(runs[0].defaultDatasetId)
  
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

export async function syncFacebookPosts() {
  const supabase = await createClient()
  const runs = await getLatestRuns(SCHEDULED_ACTORS.facebook, 1)
  
  if (runs.length === 0) return { inserted: 0, updated: 0 }
  
  const posts = await getDatasetItems<FacebookPost>(runs[0].defaultDatasetId)
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

export async function syncInstagramComments() {
  const supabase = await createClient()
  const runs = await getLatestRuns(SCHEDULED_ACTORS.instagramComments, 1)
  
  console.log("[v0] Instagram Comments runs:", runs.length, runs[0]?.defaultDatasetId)
  
  if (runs.length === 0) return { inserted: 0, updated: 0, total: 0 }
  
  const comments = await getDatasetItems<{
    id: string
    text: string
    ownerUsername: string
    timestamp: string
    likesCount: number
    postUrl: string
    postId?: string
  }>(runs[0].defaultDatasetId)
  
  console.log("[v0] Instagram Comments fetched:", comments.length)
  if (comments.length > 0) {
    console.log("[v0] Instagram Comments first item keys:", Object.keys(comments[0]))
    console.log("[v0] Instagram Comments first item sample:", JSON.stringify(comments[0]).slice(0, 500))
  }
  
  let inserted = 0
  const errors: string[] = []
  
  for (const comment of comments) {
    // Instagram Comments actor has nested structure with postInfo
    const rawComment = comment as Record<string, unknown>
    const postInfo = rawComment.postInfo as Record<string, unknown> | undefined
    
    // Extract fields from the Instagram Comments actor structure
    const commentText = (rawComment.commentText as string) || (rawComment.text as string) || ""
    const commentTimestamp = (rawComment.commentTimestamp as string) || (rawComment.timestamp as string)
    const commentatorUsername = (rawComment.commentatorUserName as string) || (rawComment.ownerUsername as string) || "unknown"
    
    // Get post ID from postInfo or direct fields
    const postId = postInfo?.shortCode || postInfo?.id || rawComment.postId || rawComment.shortCode
    const postIdFromUrl = rawComment.postUrl ? String(rawComment.postUrl).match(/\/p\/([^\/]+)/)?.[1] : undefined
    const externalPostId = String(postId || postIdFromUrl || "unknown")
    
    // Generate unique comment ID: combine post shortcode + username + timestamp hash
    // Instagram Comments actor doesn't provide a unique comment ID
    const uniqueKey = `${externalPostId}_${commentatorUsername}_${commentTimestamp || Date.now()}`
    const commentId = rawComment.id || rawComment.pk || rawComment.cid || uniqueKey
    
    if (!commentId) {
      errors.push("No comment id found: " + JSON.stringify(Object.keys(comment)))
      continue
    }
    
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

export async function syncAllPlatforms() {
  const results = {
    twitter: await syncTwitterPosts(),
    instagram: await syncInstagramPosts(),
    instagramComments: await syncInstagramComments(),
    tiktok: await syncTikTokPosts(),
    facebook: await syncFacebookPosts(),
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

// Trigger a manual run of the schedule
export async function triggerScheduleRun() {
  const response = await fetch(
    `https://api.apify.com/v2/schedules/AzNWcc9ZQxFcie6el/run?token=${APIFY_TOKEN}`,
    { method: "POST" }
  )
  return response.json()
}
