// Process synced social media data and prepare it for the dashboard
// This transforms raw Apify data into the normalized format the dashboard expects

import { createClient } from "@/lib/supabase/server"

// Product classification rules
const PRODUCT_RULES = [
  { pattern: /s26\s*ultra/i, department: "MX", category: "Smartphone", model: "Galaxy S26 Ultra" },
  { pattern: /s26\s*\+|s26\s*plus/i, department: "MX", category: "Smartphone", model: "Galaxy S26+" },
  { pattern: /s26(?!\s*ultra|\s*\+|\s*plus)/i, department: "MX", category: "Smartphone", model: "Galaxy S26" },
  { pattern: /s25\s*ultra/i, department: "MX", category: "Smartphone", model: "Galaxy S25 Ultra" },
  { pattern: /s25\s*\+|s25\s*plus/i, department: "MX", category: "Smartphone", model: "Galaxy S25+" },
  { pattern: /s25(?!\s*ultra|\s*\+|\s*plus)/i, department: "MX", category: "Smartphone", model: "Galaxy S25" },
  { pattern: /a57/i, department: "MX", category: "Smartphone", model: "Galaxy A57" },
  { pattern: /a37/i, department: "MX", category: "Smartphone", model: "Galaxy A37" },
  { pattern: /z\s*fold\s*6/i, department: "MX", category: "Smartphone", model: "Galaxy Z Fold 6" },
  { pattern: /z\s*flip\s*6/i, department: "MX", category: "Smartphone", model: "Galaxy Z Flip 6" },
  { pattern: /galaxy\s*ring/i, department: "MX", category: "Wearable", model: "Galaxy Ring" },
  { pattern: /galaxy\s*watch\s*7|watch7/i, department: "MX", category: "Wearable", model: "Galaxy Watch 7" },
  { pattern: /galaxy\s*watch\s*ultra/i, department: "MX", category: "Wearable", model: "Galaxy Watch Ultra" },
  { pattern: /buds\s*3\s*pro/i, department: "MX", category: "Audio", model: "Galaxy Buds 3 Pro" },
  { pattern: /buds\s*3(?!\s*pro)/i, department: "MX", category: "Audio", model: "Galaxy Buds 3" },
  { pattern: /neo\s*qled|qn\d+/i, department: "VD", category: "TV", model: "Neo QLED TV" },
  { pattern: /the\s*frame/i, department: "VD", category: "TV", model: "The Frame" },
  { pattern: /bespoke/i, department: "DA", category: "Home Appliance", model: "Bespoke" },
]

// Feature extraction rules
const FEATURE_RULES = [
  { pattern: /nightography|night\s*mode|night\s*photo/i, feature: "nightography" },
  { pattern: /privacy\s*display|privacy\s*screen/i, feature: "privacy_display" },
  { pattern: /galaxy\s*ai|ai\s*feature/i, feature: "galaxy_ai" },
  { pattern: /pro\s*visual\s*engine/i, feature: "pro_visual_engine" },
  { pattern: /s\s*pen/i, feature: "s_pen" },
  { pattern: /one\s*ui\s*7/i, feature: "one_ui_7" },
  { pattern: /circle\s*to\s*search/i, feature: "circle_to_search" },
  { pattern: /live\s*translate/i, feature: "live_translate" },
  { pattern: /photo\s*assist/i, feature: "photo_assist" },
  { pattern: /flexcam|flex\s*mode/i, feature: "flex_mode" },
]

// Sentiment keywords
const POSITIVE_KEYWORDS = [
  "love", "amazing", "awesome", "great", "excellent", "perfect", "best", "beautiful",
  "fantastic", "wonderful", "impressive", "stunning", "incredible", "brilliant",
  "happy", "excited", "recommend", "worth", "good", "nice", "cool", "fire", "🔥", "❤️", "😍", "👏", "💯"
]

const NEGATIVE_KEYWORDS = [
  "hate", "terrible", "awful", "worst", "bad", "horrible", "disappointed", "disappointing",
  "broken", "issue", "problem", "bug", "crash", "slow", "laggy", "expensive", "overpriced",
  "waste", "regret", "return", "refund", "fail", "poor", "😡", "😤", "👎", "💔"
]

function classifyProduct(text: string): { department: string; category: string; model: string } {
  const lowerText = text.toLowerCase()
  
  for (const rule of PRODUCT_RULES) {
    if (rule.pattern.test(lowerText)) {
      return { department: rule.department, category: rule.category, model: rule.model }
    }
  }
  
  // Default to MX/Smartphone/Unknown if no match
  return { department: "MX", category: "Smartphone", model: "Galaxy" }
}

function extractFeatures(text: string): string[] {
  const features: string[] = []
  const lowerText = text.toLowerCase()
  
  for (const rule of FEATURE_RULES) {
    if (rule.pattern.test(lowerText)) {
      features.push(rule.feature)
    }
  }
  
  return features
}

function analyzeSentiment(text: string): { sentiment: "positive" | "negative" | "neutral"; flags: string[] } {
  const lowerText = text.toLowerCase()
  const flags: string[] = []
  
  let positiveScore = 0
  let negativeScore = 0
  
  for (const keyword of POSITIVE_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      positiveScore++
    }
  }
  
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      negativeScore++
    }
  }
  
  // Check for sarcasm indicators
  if (lowerText.includes("yeah right") || lowerText.includes("sure...") || 
      (positiveScore > 0 && negativeScore > 0)) {
    flags.push("MIXED")
  }
  
  // Check for competitor mentions
  if (/iphone|apple|pixel|xiaomi|huawei|oppo|vivo/i.test(lowerText)) {
    flags.push("COMPETITOR_MENTION")
  }
  
  // Check for purchase intent
  if (/buy|purchase|order|get one|getting one|want one|need one/i.test(lowerText)) {
    flags.push("PURCHASE_INTENT")
  }
  
  // Check for price complaints
  if (/expensive|overpriced|too much|cost|price/i.test(lowerText) && negativeScore > 0) {
    flags.push("PRICE_COMPLAINT")
  }
  
  if (positiveScore > negativeScore) {
    return { sentiment: "positive", flags }
  } else if (negativeScore > positiveScore) {
    return { sentiment: "negative", flags }
  }
  
  return { sentiment: "neutral", flags }
}

export interface NormalizedPost {
  id: string
  platform: "instagram" | "tiktok" | "facebook" | "twitter"
  url: string
  caption: string
  owner: string
  timestamp: string
  likes: number
  views: number
  department: string
  productCategory: string
  productModel: string
  features: string[]
}

export interface NormalizedComment {
  id: string
  postId: string
  platform: "instagram" | "tiktok" | "facebook" | "twitter"
  text: string
  username: string
  createdAt: string
  sentiment: "positive" | "negative" | "neutral"
  sentimentFlags: string[]
  likes: number
  language: string
  features: string[]
}

export async function processAndNormalizeData(): Promise<{
  meta: { generatedAt: string; dateRange: { from: string; to: string }; totals: { posts: number; comments: number } }
  posts: NormalizedPost[]
  comments: NormalizedComment[]
}> {
  const supabase = await createClient()
  
  // Fetch all posts from Supabase
  const { data: rawPosts, error: postsError } = await supabase
    .from("social_posts")
    .select("*")
    .order("published_at", { ascending: false })
  
  console.log("[v0] Processing - fetched posts:", rawPosts?.length || 0, postsError?.message || "no error")
  
  if (postsError) {
    console.error("Error fetching posts:", postsError)
    throw postsError
  }
  
  // Fetch all comments from Supabase
  const { data: rawComments, error: commentsError } = await supabase
    .from("social_comments")
    .select("*")
    .order("published_at", { ascending: false })
  
  console.log("[v0] Processing - fetched comments:", rawComments?.length || 0, commentsError?.message || "no error")
  
  if (commentsError) {
    console.error("Error fetching comments:", commentsError)
    // Continue without comments if table doesn't exist
  }
  
  const posts: NormalizedPost[] = []
  const comments: NormalizedComment[] = []
  
  // Process posts
  for (const post of rawPosts || []) {
    const caption = post.caption || ""
    const classification = classifyProduct(caption)
    const features = extractFeatures(caption)
    
    posts.push({
      id: post.external_id,
      platform: post.platform,
      url: post.post_url,
      caption: caption,
      owner: post.raw_data?.ownerUsername || post.raw_data?.author?.username || "samsunggulf",
      timestamp: post.published_at,
      likes: post.likes_count || 0,
      views: post.views_count || 0,
      department: classification.department,
      productCategory: classification.category,
      productModel: classification.model,
      features: features,
    })
    
    // Process comments from raw_data if available (Instagram posts often have comments embedded)
    const embeddedComments = post.raw_data?.latestComments || post.raw_data?.comments || []
    for (const comment of embeddedComments) {
      const sentimentResult = analyzeSentiment(comment.text || "")
      const commentFeatures = extractFeatures(comment.text || "")
      
      comments.push({
        id: comment.id || `${post.external_id}-${comments.length}`,
        postId: post.external_id,
        platform: post.platform,
        text: comment.text || "",
        username: comment.ownerUsername || comment.owner?.username || "anonymous",
        createdAt: comment.timestamp || post.published_at,
        sentiment: sentimentResult.sentiment,
        sentimentFlags: sentimentResult.flags,
        likes: comment.likesCount || comment.likes || 0,
        language: detectLanguage(comment.text || ""),
        features: commentFeatures,
      })
    }
  }
  
  // Process standalone comments from social_comments table
  for (const comment of rawComments || []) {
    const sentimentResult = analyzeSentiment(comment.text || "")
    const commentFeatures = extractFeatures(comment.text || "")
    
    comments.push({
      id: comment.external_id,
      postId: comment.external_post_id || "unknown",
      platform: comment.platform,
      text: comment.text || "",
      username: comment.author_username || "anonymous",
      createdAt: comment.published_at,
      sentiment: sentimentResult.sentiment,
      sentimentFlags: sentimentResult.flags,
      likes: comment.likes_count || 0,
      language: detectLanguage(comment.text || ""),
      features: commentFeatures,
    })
  }
  
  console.log("[v0] Processing complete - posts:", posts.length, "comments:", comments.length)
  
  // Calculate date range
  const timestamps = posts.map(p => new Date(p.timestamp).getTime()).filter(t => !isNaN(t))
  const minDate = timestamps.length ? new Date(Math.min(...timestamps)) : new Date()
  const maxDate = timestamps.length ? new Date(Math.max(...timestamps)) : new Date()
  
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      dateRange: {
        from: minDate.toISOString().split("T")[0],
        to: maxDate.toISOString().split("T")[0],
      },
      totals: {
        posts: posts.length,
        comments: comments.length,
      },
    },
    posts,
    comments,
  }
}

function detectLanguage(text: string): string {
  // Simple Arabic detection
  if (/[\u0600-\u06FF]/.test(text)) {
    return "ar"
  }
  return "en"
}

// Merge new data with existing data (deduplication by ID)
export function mergeNormalizedData(
  existing: { posts: NormalizedPost[]; comments: NormalizedComment[] },
  newData: { posts: NormalizedPost[]; comments: NormalizedComment[] }
): { posts: NormalizedPost[]; comments: NormalizedComment[] } {
  const postMap = new Map<string, NormalizedPost>()
  const commentMap = new Map<string, NormalizedComment>()
  
  // Add existing data
  for (const post of existing.posts) {
    postMap.set(post.id, post)
  }
  for (const comment of existing.comments) {
    commentMap.set(comment.id, comment)
  }
  
  // Add/update with new data
  for (const post of newData.posts) {
    postMap.set(post.id, post)
  }
  for (const comment of newData.comments) {
    commentMap.set(comment.id, comment)
  }
  
  return {
    posts: Array.from(postMap.values()).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ),
    comments: Array.from(commentMap.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  }
}
