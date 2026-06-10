import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

// Use service role key for webhook inserts (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Verify webhook secret to ensure request is from Apify
function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = request.headers.get("x-apify-webhook-secret")
  return secret === process.env.APIFY_WEBHOOK_SECRET
}

// Simple sentiment analysis (can be replaced with AI-powered analysis later)
function analyzeSentiment(text: string): { sentiment: string; score: number } {
  const positiveWords = ["love", "great", "amazing", "awesome", "excellent", "perfect", "best", "beautiful", "fantastic", "wonderful", "good", "nice", "happy", "thank", "recommend"]
  const negativeWords = ["hate", "bad", "terrible", "awful", "worst", "horrible", "poor", "disappointing", "waste", "broken", "issue", "problem", "fail", "wrong", "ugly"]
  
  const lowerText = text.toLowerCase()
  let score = 0
  
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) score += 1
  })
  
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) score -= 1
  })
  
  if (score > 0) return { sentiment: "positive", score: Math.min(score / 5, 1) }
  if (score < 0) return { sentiment: "negative", score: Math.max(score / 5, -1) }
  return { sentiment: "neutral", score: 0 }
}

// Process Instagram posts from Apify
async function processInstagramPosts(data: any[], logId: string) {
  let inserted = 0
  let updated = 0
  
  for (const post of data) {
    const { error } = await supabaseAdmin
      .from("social_posts")
      .upsert({
        platform: "instagram",
        external_id: post.id || post.shortCode,
        post_url: post.url || `https://instagram.com/p/${post.shortCode}`,
        caption: post.caption || post.text,
        media_type: post.type || "image",
        media_url: post.displayUrl || post.thumbnailUrl,
        likes_count: post.likesCount || post.likes || 0,
        comments_count: post.commentsCount || post.comments || 0,
        shares_count: post.sharesCount || 0,
        views_count: post.videoViewCount || post.views || 0,
        published_at: post.timestamp ? new Date(post.timestamp) : null,
        raw_data: post,
        updated_at: new Date()
      }, { onConflict: "platform,external_id" })
    
    if (!error) inserted++
  }
  
  return { inserted, updated }
}

// Process Instagram comments from Apify
async function processInstagramComments(data: any[], logId: string) {
  let inserted = 0
  
  for (const comment of data) {
    const sentimentResult = analyzeSentiment(comment.text || "")
    
    const { error } = await supabaseAdmin
      .from("social_comments")
      .upsert({
        platform: "instagram",
        external_id: comment.id,
        external_post_id: comment.postId || comment.shortCode,
        author_username: comment.ownerUsername || comment.username,
        author_display_name: comment.ownerFullName,
        author_profile_url: comment.ownerProfilePicUrl,
        text: comment.text,
        likes_count: comment.likesCount || comment.likes || 0,
        replies_count: comment.repliesCount || 0,
        sentiment: sentimentResult.sentiment,
        sentiment_score: sentimentResult.score,
        published_at: comment.timestamp ? new Date(comment.timestamp) : null,
        raw_data: comment
      }, { onConflict: "platform,external_id" })
    
    if (!error) inserted++
  }
  
  return { inserted, updated: 0 }
}

// Process TikTok posts from Apify
async function processTikTokPosts(data: any[], logId: string) {
  let inserted = 0
  
  for (const post of data) {
    const { error } = await supabaseAdmin
      .from("social_posts")
      .upsert({
        platform: "tiktok",
        external_id: post.id || post.videoId,
        post_url: post.webVideoUrl || post.url,
        caption: post.text || post.desc,
        media_type: "video",
        media_url: post.videoUrl || post.playAddr,
        likes_count: post.diggCount || post.likes || 0,
        comments_count: post.commentCount || post.comments || 0,
        shares_count: post.shareCount || post.shares || 0,
        views_count: post.playCount || post.views || 0,
        published_at: post.createTime ? new Date(post.createTime * 1000) : null,
        raw_data: post,
        updated_at: new Date()
      }, { onConflict: "platform,external_id" })
    
    if (!error) inserted++
  }
  
  return { inserted, updated: 0 }
}

// Process TikTok comments from Apify
async function processTikTokComments(data: any[], logId: string) {
  let inserted = 0
  
  for (const comment of data) {
    const sentimentResult = analyzeSentiment(comment.text || "")
    
    const { error } = await supabaseAdmin
      .from("social_comments")
      .upsert({
        platform: "tiktok",
        external_id: comment.cid || comment.id,
        external_post_id: comment.videoId || comment.aweme_id,
        author_username: comment.uniqueId || comment.user?.uniqueId,
        author_display_name: comment.nickname || comment.user?.nickname,
        author_avatar_url: comment.avatarThumb || comment.user?.avatarThumb,
        author_followers_count: comment.user?.followerCount,
        author_is_verified: comment.user?.verified || false,
        text: comment.text,
        likes_count: comment.diggCount || comment.likes || 0,
        replies_count: comment.replyCommentTotal || 0,
        sentiment: sentimentResult.sentiment,
        sentiment_score: sentimentResult.score,
        published_at: comment.createTime ? new Date(comment.createTime * 1000) : null,
        raw_data: comment
      }, { onConflict: "platform,external_id" })
    
    if (!error) inserted++
  }
  
  return { inserted, updated: 0 }
}

// Process Facebook posts from Apify
async function processFacebookPosts(data: any[], logId: string) {
  let inserted = 0
  
  for (const post of data) {
    const { error } = await supabaseAdmin
      .from("social_posts")
      .upsert({
        platform: "facebook",
        external_id: post.postId || post.id,
        post_url: post.url || post.postUrl,
        caption: post.text || post.message,
        media_type: post.type || "post",
        media_url: post.media?.[0]?.url,
        likes_count: post.likes || post.reactionsCount || 0,
        comments_count: post.comments || post.commentsCount || 0,
        shares_count: post.shares || post.sharesCount || 0,
        views_count: post.views || 0,
        published_at: post.time ? new Date(post.time) : null,
        raw_data: post,
        updated_at: new Date()
      }, { onConflict: "platform,external_id" })
    
    if (!error) inserted++
  }
  
  return { inserted, updated: 0 }
}

// Process Twitter/X posts from Apify
async function processTwitterPosts(data: any[], logId: string) {
  let inserted = 0
  
  for (const tweet of data) {
    const { error } = await supabaseAdmin
      .from("social_posts")
      .upsert({
        platform: "twitter",
        external_id: tweet.id || tweet.id_str,
        post_url: tweet.url || `https://twitter.com/i/status/${tweet.id}`,
        caption: tweet.text || tweet.full_text,
        media_type: tweet.entities?.media?.[0]?.type || "text",
        media_url: tweet.entities?.media?.[0]?.media_url_https,
        likes_count: tweet.favorite_count || tweet.likes || 0,
        comments_count: tweet.reply_count || 0,
        shares_count: tweet.retweet_count || tweet.retweets || 0,
        views_count: tweet.views || tweet.impressions || 0,
        published_at: tweet.created_at ? new Date(tweet.created_at) : null,
        raw_data: tweet,
        updated_at: new Date()
      }, { onConflict: "platform,external_id" })
    
    if (!error) inserted++
  }
  
  return { inserted, updated: 0 }
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    if (!verifyWebhookSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const body = await request.json()
    
    // Extract platform and scraper type from request
    const platform = body.platform || request.nextUrl.searchParams.get("platform") || "unknown"
    const scraperType = body.scraperType || request.nextUrl.searchParams.get("type") || "posts"
    const actorId = body.actorId || body.resource?.actorId
    const runId = body.runId || body.resource?.actorRunId
    
    // Get the actual data - Apify can send data in different formats
    const data = body.data || body.items || body.resource?.defaultDatasetItems || []
    
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "No data to process",
        recordsProcessed: 0 
      })
    }
    
    // Log the sync start
    const { data: logEntry } = await supabaseAdmin
      .from("apify_sync_log")
      .insert({
        platform,
        scraper_type: scraperType,
        actor_id: actorId,
        run_id: runId,
        status: "started",
        records_processed: data.length
      })
      .select()
      .single()
    
    const logId = logEntry?.id
    
    // Process based on platform and type
    let result = { inserted: 0, updated: 0 }
    
    switch (platform.toLowerCase()) {
      case "instagram":
        result = scraperType === "comments" 
          ? await processInstagramComments(data, logId)
          : await processInstagramPosts(data, logId)
        break
      case "tiktok":
        result = scraperType === "comments"
          ? await processTikTokComments(data, logId)
          : await processTikTokPosts(data, logId)
        break
      case "facebook":
        result = await processFacebookPosts(data, logId)
        break
      case "twitter":
      case "x":
        result = await processTwitterPosts(data, logId)
        break
      default:
        // Try to auto-detect based on data structure
        if (data[0]?.shortCode || data[0]?.ownerUsername) {
          result = data[0]?.text && !data[0]?.caption
            ? await processInstagramComments(data, logId)
            : await processInstagramPosts(data, logId)
        } else if (data[0]?.videoId || data[0]?.aweme_id) {
          result = data[0]?.cid
            ? await processTikTokComments(data, logId)
            : await processTikTokPosts(data, logId)
        }
    }
    
    // Update sync log with completion
    if (logId) {
      await supabaseAdmin
        .from("apify_sync_log")
        .update({
          status: "completed",
          records_inserted: result.inserted,
          records_updated: result.updated,
          completed_at: new Date()
        })
        .eq("id", logId)
    }
    
    return NextResponse.json({
      success: true,
      platform,
      scraperType,
      recordsProcessed: data.length,
      recordsInserted: result.inserted,
      recordsUpdated: result.updated
    })
    
  } catch (error) {
    console.error("[Apify Webhook Error]", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/webhook/apify",
    supportedPlatforms: ["instagram", "tiktok", "facebook", "twitter"],
    usage: "POST with x-apify-webhook-secret header and data array"
  })
}
