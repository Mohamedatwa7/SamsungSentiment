// Comments Data Processing - loads from static JSON file
// Provides department / product / feature segmentation on top of the existing Comment API.

import normalizedRaw from "@/data/social-normalized.json"
import { type DateRange, isWithinDateRange } from "@/components/dashboard/date-filter"

export type Sentiment = "positive" | "negative" | "neutral"

// Sentiment flags for classification insights
export type SentimentFlag = "SARCASM" | "COMPETITOR_MENTION" | "MIXED" | "SAFETY_ISSUE" | "PRICE_COMPLAINT" | "PURCHASE_INTENT"

export interface Comment {
  id: string
  platform: "instagram" | "tiktok" | "facebook" | "twitter"
  text: string
  username: string
  profilePicUrl: string
  postCaption: string
  postUrl: string
  sentiment: Sentiment
  sentimentFlags: SentimentFlag[]
  // Hierarchy
  product: string // = productModel (kept for backward compat)
  productModel: string
  productCategory: string
  department: string
  // Features inherited from the post the comment is on
  features: string[]
  likes: number
  createdAt: string
}

export interface CommentMetrics {
  totalComments: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  positivePercentage: number
  negativePercentage: number
  neutralPercentage: number
  topIssues: { issue: string; count: number }[]
  topPraise: { praise: string; count: number }[]
}

// Comment platform type for filtering
export type CommentPlatform = "instagram" | "tiktok" | "facebook" | "twitter"

// Segmentation filter — hierarchical
export interface Segmentation {
  departments?: string[] // e.g. ["MX"]
  productCategories?: string[] // e.g. ["Smartphone"]
  productModels?: string[] // e.g. ["Galaxy S26 Ultra"]
  features?: string[] // e.g. ["nightography"] - posts must have ALL listed features
}

// =============================================================================
// CLASSIFICATION HELPERS
// =============================================================================

const PRODUCT_KEYWORDS: Record<string, { department: string; category: string; model: string }> = {
  // MX - Mobile Experience
  "s26 ultra": { department: "MX", category: "Smartphone", model: "Galaxy S26 Ultra" },
  "s26+": { department: "MX", category: "Smartphone", model: "Galaxy S26+" },
  "s26": { department: "MX", category: "Smartphone", model: "Galaxy S26" },
  "s25 ultra": { department: "MX", category: "Smartphone", model: "Galaxy S25 Ultra" },
  "s25+": { department: "MX", category: "Smartphone", model: "Galaxy S25+" },
  "s25": { department: "MX", category: "Smartphone", model: "Galaxy S25" },
  "z fold": { department: "MX", category: "Smartphone", model: "Galaxy Z Fold6" },
  "z flip": { department: "MX", category: "Smartphone", model: "Galaxy Z Flip6" },
  "fold6": { department: "MX", category: "Smartphone", model: "Galaxy Z Fold6" },
  "flip6": { department: "MX", category: "Smartphone", model: "Galaxy Z Flip6" },
  "a57": { department: "MX", category: "Smartphone", model: "Galaxy A57" },
  "a55": { department: "MX", category: "Smartphone", model: "Galaxy A55" },
  "galaxy watch": { department: "MX", category: "Wearable", model: "Galaxy Watch7" },
  "watch7": { department: "MX", category: "Wearable", model: "Galaxy Watch7" },
  "watch ultra": { department: "MX", category: "Wearable", model: "Galaxy Watch Ultra" },
  "galaxy buds": { department: "MX", category: "Audio", model: "Galaxy Buds3" },
  "buds3": { department: "MX", category: "Audio", model: "Galaxy Buds3" },
  "galaxy ring": { department: "MX", category: "Wearable", model: "Galaxy Ring" },
  "galaxy tab": { department: "MX", category: "Tablet", model: "Galaxy Tab S10" },
  "tab s10": { department: "MX", category: "Tablet", model: "Galaxy Tab S10" },
  // VD - Visual Display
  "neo qled": { department: "VD", category: "TV", model: "Neo QLED 8K" },
  "qled": { department: "VD", category: "TV", model: "QLED TV" },
  "oled": { department: "VD", category: "TV", model: "OLED TV" },
  "the frame": { department: "VD", category: "TV", model: "The Frame" },
  "frame tv": { department: "VD", category: "TV", model: "The Frame" },
  "odyssey": { department: "VD", category: "Monitor", model: "Odyssey Gaming Monitor" },
  "smart monitor": { department: "VD", category: "Monitor", model: "Smart Monitor" },
  "soundbar": { department: "VD", category: "Audio", model: "Soundbar" },
  "projector": { department: "VD", category: "Projector", model: "The Premiere" },
  // DA - Digital Appliances
  "bespoke": { department: "DA", category: "Home Appliance", model: "Bespoke" },
  "refrigerator": { department: "DA", category: "Home Appliance", model: "Bespoke Refrigerator" },
  "washer": { department: "DA", category: "Home Appliance", model: "Bespoke Washer" },
  "dryer": { department: "DA", category: "Home Appliance", model: "Bespoke Dryer" },
  "air conditioner": { department: "DA", category: "Home Appliance", model: "Wind-Free AC" },
  "ac": { department: "DA", category: "Home Appliance", model: "Wind-Free AC" },
  "vacuum": { department: "DA", category: "Home Appliance", model: "Jet Bot" },
  "jet bot": { department: "DA", category: "Home Appliance", model: "Jet Bot" },
  "microwave": { department: "DA", category: "Home Appliance", model: "Microwave" },
  "oven": { department: "DA", category: "Home Appliance", model: "Smart Oven" },
}

const FEATURE_KEYWORDS: Record<string, string[]> = {
  nightography: ["nightography", "night mode", "night photo", "low light", "night camera"],
  privacy_display: ["privacy display", "privacy screen", "privacy mode"],
  horizontal_lock: ["horizontal lock", "rotation lock"],
  galaxy_ai: ["galaxy ai", "ai features", "circle to search", "live translate", "interpreter", "generative edit", "photo assist", "note assist", "ai assistant"],
}

function classifyContent(text: string): { department: string; category: string; model: string } {
  const lower = text.toLowerCase()
  for (const [keyword, classification] of Object.entries(PRODUCT_KEYWORDS)) {
    if (lower.includes(keyword)) {
      return classification
    }
  }
  return { department: "Brand", category: "Other", model: "General" }
}

function extractFeatures(text: string): string[] {
  const lower = text.toLowerCase()
  const features: string[] = []
  for (const [feature, keywords] of Object.entries(FEATURE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      features.push(feature)
    }
  }
  return features
}

function analyzeSentiment(text: string): { sentiment: Sentiment; flags: SentimentFlag[] } {
  const lower = text.toLowerCase()
  const flags: SentimentFlag[] = []
  
  // Check for flags
  if (/iphone|apple|pixel|xiaomi|huawei|oppo|vivo/i.test(lower)) {
    flags.push("COMPETITOR_MENTION")
  }
  if (/😂|lol|lmao|🙄|sure|yeah right/i.test(lower) && /love|great|best/i.test(lower)) {
    flags.push("SARCASM")
  }
  if (/danger|unsafe|fire|burn|explod/i.test(lower)) {
    flags.push("SAFETY_ISSUE")
  }
  if (/expensive|overpriced|too much|cost/i.test(lower)) {
    flags.push("PRICE_COMPLAINT")
  }
  if (/buy|purchase|order|want to get|getting|gonna get/i.test(lower)) {
    flags.push("PURCHASE_INTENT")
  }
  
  // Sentiment scoring
  const positiveWords = ["love", "amazing", "awesome", "great", "best", "excellent", "beautiful", "perfect", "fantastic", "incredible", "stunning", "brilliant", "fire", "🔥", "❤️", "😍", "👍", "💯"]
  const negativeWords = ["hate", "terrible", "worst", "bad", "awful", "horrible", "disappointing", "trash", "garbage", "waste", "broken", "fail", "sucks", "poor", "👎", "😡", "😤", "💔"]
  
  let score = 0
  for (const word of positiveWords) {
    if (lower.includes(word)) score++
  }
  for (const word of negativeWords) {
    if (lower.includes(word)) score--
  }
  
  if (score > 0) return { sentiment: "positive", flags }
  if (score < 0) return { sentiment: "negative", flags }
  
  // Check if there are both positive and negative signals
  const hasPositive = positiveWords.some(w => lower.includes(w))
  const hasNegative = negativeWords.some(w => lower.includes(w))
  if (hasPositive && hasNegative) {
    flags.push("MIXED")
  }
  
  return { sentiment: "neutral", flags }
}

// =============================================================================
// DATA LOADING FROM STATIC JSON
// =============================================================================

interface NormalizedPost {
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

interface NormalizedComment {
  id: string
  postId: string
  platform: "instagram" | "tiktok" | "facebook" | "twitter"
  text: string
  username: string
  createdAt: string
  sentiment: Sentiment
  sentimentFlags: SentimentFlag[]
  likes: number
  features: string[]
}

// Cache for data loaded from static JSON
let cachedData: {
  posts: NormalizedPost[]
  comments: NormalizedComment[]
  allComments: Comment[]
  postById: Map<string, NormalizedPost>
  postByUrl: Map<string, NormalizedPost>
} | null = null

function loadData(): NonNullable<typeof cachedData> {
  // Return cached if available
  if (cachedData) return cachedData
  
  // Load from static JSON
  const normalized = normalizedRaw as {
    posts: NormalizedPost[]
    comments: NormalizedComment[]
  }
  
  const posts = normalized.posts || []
  const comments = normalized.comments || []
  
  // Build lookup maps
  const postById = new Map<string, NormalizedPost>()
  for (const p of posts) postById.set(p.id, p)
  
  const postByUrl = new Map<string, NormalizedPost>()
  for (const p of posts) postByUrl.set(p.url, p)
  
  // Build unified Comment array with post context
  const allComments: Comment[] = comments.map((c) => {
    const post = postById.get(c.postId)
    const department = post?.department ?? "Brand"
    const productCategory = post?.productCategory ?? "Other"
    const productModel = post?.productModel ?? "General"
    const commentFeatures = c.features ?? []
    const postFeatures = post?.features ?? []
    const mergedFeatures = [...new Set([...commentFeatures, ...postFeatures])]
    
    return {
      id: c.id,
      platform: c.platform,
      text: c.text,
      username: c.username,
      profilePicUrl: "",
      postCaption: post?.caption ?? "",
      postUrl: post?.url ?? "",
      sentiment: c.sentiment,
      sentimentFlags: (c.sentimentFlags || []) as SentimentFlag[],
      product: productModel,
      productModel,
      productCategory,
      department,
      features: mergedFeatures,
      likes: c.likes,
      createdAt: c.createdAt,
    }
  })
  
  cachedData = { posts, comments, allComments, postById, postByUrl }
  return cachedData
}

// =============================================================================
// PUBLIC HELPERS
// =============================================================================

function applySegmentation(comments: Comment[], seg?: Segmentation): Comment[] {
  if (!seg) return comments
  const hasDept = seg.departments && seg.departments.length > 0
  const hasCat = seg.productCategories && seg.productCategories.length > 0
  const hasModel = seg.productModels && seg.productModels.length > 0
  const hasFeat = seg.features && seg.features.length > 0
  if (!hasDept && !hasCat && !hasModel && !hasFeat) return comments

  return comments.filter((c) => {
    if (hasDept && !seg.departments!.includes(c.department)) return false
    if (hasCat && !seg.productCategories!.includes(c.productCategory)) return false
    if (hasModel && !seg.productModels!.includes(c.productModel)) return false
    if (hasFeat && !seg.features!.every((f) => c.features.includes(f))) return false
    return true
  })
}

function applyPlatform(comments: Comment[], platforms?: CommentPlatform[]): Comment[] {
  if (!platforms || platforms.length === 0) return comments
  return comments.filter((c) => platforms.includes(c.platform))
}

function applyDate(comments: Comment[], dateRange?: DateRange): Comment[] {
  if (!dateRange) return comments
  return comments.filter((c) => isWithinDateRange(c.createdAt, dateRange))
}

// Get all processed comments with optional platform, date and segmentation filters
export function getComments(
  platformFilter?: CommentPlatform[],
  dateRange?: DateRange,
  segmentation?: Segmentation,
): Comment[] {
  const data = loadData()
  
  let out = applyPlatform(data.allComments, platformFilter)
  out = applyDate(out, dateRange)
  out = applySegmentation(out, segmentation)
  return out
}

export function getCommentsBySentiment(sentiment: Sentiment, platformFilter?: CommentPlatform[]): Comment[] {
  const data = loadData()
  return applyPlatform(data.allComments, platformFilter).filter((c) => c.sentiment === sentiment)
}

// Get total posts count with optional platform and date filters
export function getTotalPosts(
  platformFilter?: CommentPlatform[],
  dateRange?: DateRange,
): number {
  const data = loadData()
  
  let posts = data.posts
  
  // Apply platform filter
  if (platformFilter && platformFilter.length > 0) {
    posts = posts.filter(p => platformFilter.includes(p.platform as CommentPlatform))
  }
  
  // Apply date filter
  if (dateRange) {
    posts = posts.filter(p => isWithinDateRange(p.timestamp, dateRange))
  }
  
  return posts.length
}

// =============================================================================
// ISSUE / PRAISE keyword tracking (lightweight)
// =============================================================================

const issuePatterns: { pattern: RegExp; issue: string }[] = [
  { pattern: /battery|drain|dies|charge/i, issue: "Battery" },
  { pattern: /price|expensive|cost|cheap/i, issue: "Price" },
  { pattern: /update|software|bug|glitch|laggy|slow|freez/i, issue: "Software" },
  { pattern: /camera|photo|picture/i, issue: "Camera" },
  { pattern: /heat|overheat|hot/i, issue: "Heating" },
  { pattern: /service|support|repair|center/i, issue: "Service" },
  { pattern: /screen|display|crack/i, issue: "Display" },
]

const praisePatterns: { pattern: RegExp; praise: string }[] = [
  { pattern: /camera|photo|picture/i, praise: "Camera" },
  { pattern: /battery/i, praise: "Battery Life" },
  { pattern: /design|beautiful|look/i, praise: "Design" },
  { pattern: /screen|display/i, praise: "Display" },
  { pattern: /performance|fast|speed/i, praise: "Performance" },
  { pattern: /innovation|innovative/i, praise: "Innovation" },
]

export function getCommentMetrics(
  platformFilter?: CommentPlatform[],
  dateRange?: DateRange,
  segmentation?: Segmentation,
): CommentMetrics {
  const comments = getComments(platformFilter, dateRange, segmentation)
  const total = comments.length

  let positiveCount = 0
  let negativeCount = 0
  let neutralCount = 0
  const issueCount: Record<string, number> = {}
  const praiseCount: Record<string, number> = {}

  for (const c of comments) {
    if (c.sentiment === "positive") positiveCount++
    else if (c.sentiment === "negative") negativeCount++
    else neutralCount++

    if (c.sentiment === "negative") {
      for (const { pattern, issue } of issuePatterns) {
        if (pattern.test(c.text)) issueCount[issue] = (issueCount[issue] || 0) + 1
      }
    } else if (c.sentiment === "positive") {
      for (const { pattern, praise } of praisePatterns) {
        if (pattern.test(c.text) || pattern.test(c.postCaption)) praiseCount[praise] = (praiseCount[praise] || 0) + 1
      }
    }
  }

  const topIssues = Object.entries(issueCount)
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const topPraise = Object.entries(praiseCount)
    .map(([praise, count]) => ({ praise, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Calculate percentages that always add up to 100%
  let positivePercentage = 0
  let negativePercentage = 0
  let neutralPercentage = 0
  
  if (total > 0) {
    positivePercentage = Math.floor((positiveCount / total) * 100)
    negativePercentage = Math.floor((negativeCount / total) * 100)
    neutralPercentage = 100 - positivePercentage - negativePercentage
  }

  return {
    totalComments: total,
    positiveCount,
    negativeCount,
    neutralCount,
    positivePercentage,
    negativePercentage,
    neutralPercentage,
    topIssues,
    topPraise,
  }
}

export function getCommentsByProduct(
  platformFilter?: CommentPlatform[],
  dateRange?: DateRange,
  segmentation?: Segmentation,
): Record<string, { total: number; positive: number; negative: number; neutral: number }> {
  const comments = getComments(platformFilter, dateRange, segmentation)
  const byProduct: Record<string, { total: number; positive: number; negative: number; neutral: number }> = {}

  for (const c of comments) {
    const key = c.productModel
    if (!byProduct[key]) byProduct[key] = { total: 0, positive: 0, negative: 0, neutral: 0 }
    byProduct[key].total++
    byProduct[key][c.sentiment]++
  }

  return byProduct
}

// Collapse near-identical texts (residual cross-source duplicates from the
// static import era), keeping the highest-engagement copy.
function dedupeByText(comments: Comment[]): Comment[] {
  const seen = new Map<string, Comment>()
  for (const c of comments) {
    const key = (c.text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120)
    const prev = seen.get(key)
    if (!prev || (c.likes || 0) > (prev.likes || 0)) seen.set(key, c)
  }
  return [...seen.values()]
}

export function getTopComments(
  limit: number = 10,
  platformFilter?: CommentPlatform[],
  dateRange?: DateRange,
  segmentation?: Segmentation,
): Comment[] {
  const comments = getComments(platformFilter, dateRange, segmentation)
  return dedupeByText(comments.filter((c) => c.text.length > 10))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, limit)
}

export function getTopCommentsByProduct(product: string, limit: number = 5): Comment[] {
  const data = loadData()
  return data.allComments
    .filter((c) => c.productModel.toLowerCase().includes(product.toLowerCase()) && c.text.length > 10)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, limit)
}

export function getTopPositiveReviews(
  limit: number = 10,
  platformFilter?: CommentPlatform[],
  dateRange?: DateRange,
  segmentation?: Segmentation,
): Comment[] {
  const comments = getComments(platformFilter, dateRange, segmentation)
  return dedupeByText(comments.filter((c) => c.sentiment === "positive" && c.text.length > 20))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, limit)
}

export function getTopNegativeReviews(
  limit: number = 10,
  platformFilter?: CommentPlatform[],
  dateRange?: DateRange,
  segmentation?: Segmentation,
): Comment[] {
  const comments = getComments(platformFilter, dateRange, segmentation)
  return dedupeByText(comments.filter((c) => c.sentiment === "negative" && c.text.length > 20))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, limit)
}

// =============================================================================
// SEGMENTATION DICTIONARY (used by the SegmentationFilter UI)
// =============================================================================

export interface SegmentationTree {
  department: string
  postCount: number
  commentCount: number
  categories: {
    name: string
    postCount: number
    commentCount: number
    models: { name: string; postCount: number; commentCount: number }[]
  }[]
}

export function getSegmentationTree(): SegmentationTree[] {
  const data = loadData()
  
  // Count comments per (dept, cat, model)
  const counts = new Map<string, { posts: Set<string>; comments: number }>()
  const key = (d: string, c: string, m: string) => `${d}||${c}||${m}`

  for (const c of data.allComments) {
    const k = key(c.department, c.productCategory, c.productModel)
    if (!counts.has(k)) counts.set(k, { posts: new Set(), comments: 0 })
    const entry = counts.get(k)!
    entry.comments++
  }
  // Posts per (dept, cat, model) from the post list
  for (const p of data.posts) {
    const k = key(p.department, p.productCategory, p.productModel)
    if (!counts.has(k)) counts.set(k, { posts: new Set(), comments: 0 })
    counts.get(k)!.posts.add(p.id)
  }

  const tree = new Map<string, SegmentationTree>()
  for (const [k, v] of counts.entries()) {
    const [dept, cat, model] = k.split("||")
    if (!tree.has(dept)) tree.set(dept, { department: dept, postCount: 0, commentCount: 0, categories: [] })
    const deptNode = tree.get(dept)!
    deptNode.postCount += v.posts.size
    deptNode.commentCount += v.comments

    let catNode = deptNode.categories.find((c) => c.name === cat)
    if (!catNode) {
      catNode = { name: cat, postCount: 0, commentCount: 0, models: [] }
      deptNode.categories.push(catNode)
    }
    catNode.postCount += v.posts.size
    catNode.commentCount += v.comments
    catNode.models.push({ name: model, postCount: v.posts.size, commentCount: v.comments })
  }

  // Sort: department by total comments, then categories, then models
  const ordered = [...tree.values()].sort((a, b) => b.commentCount - a.commentCount)
  for (const d of ordered) {
    d.categories.sort((a, b) => b.commentCount - a.commentCount)
    for (const c of d.categories) c.models.sort((a, b) => b.commentCount - a.commentCount)
  }
  return ordered
}

// =============================================================================
// FEATURE-LEVEL HELPERS
// =============================================================================

export type FeatureKey = "nightography" | "privacy_display" | "horizontal_lock" | "galaxy_ai"

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  nightography: "Nightography",
  privacy_display: "Privacy Display",
  horizontal_lock: "Horizontal Lock",
  galaxy_ai: "Galaxy AI",
}

export interface FeatureMetrics {
  feature: FeatureKey
  label: string
  totalComments: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  positivePercentage: number
  negativePercentage: number
  postCount: number
}

export function getFeatureMetrics(
  feature: Feature,
  platformFilter?: CommentPlatform[],
  dateRange?: DateRange,
  segmentation?: Segmentation,
): FeatureMetrics {
  const data = loadData()
  if (!data) {
    return {
      feature,
      label: FEATURE_LABELS[feature],
      totalComments: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      positivePercentage: 0,
      negativePercentage: 0,
      postCount: 0,
    }
  }
  
  const allFilteredComments = getComments(platformFilter, dateRange, segmentation)
  const featureComments = allFilteredComments.filter((c) =>
    c.features && c.features.includes(feature),
  )
  const total = featureComments.length
  const positiveCount = featureComments.filter((c) => c.sentiment === "positive").length
  const negativeCount = featureComments.filter((c) => c.sentiment === "negative").length
  const neutralCount = featureComments.filter((c) => c.sentiment === "neutral").length

  let posts = data.posts.filter((p) => p.features && p.features.includes(feature))
  if (segmentation) {
    posts = posts.filter((p) => {
      if (segmentation.departments?.length && !segmentation.departments.includes(p.department)) return false
      if (segmentation.productCategories?.length && !segmentation.productCategories.includes(p.productCategory)) return false
      if (segmentation.productModels?.length && !segmentation.productModels.includes(p.productModel)) return false
      return true
    })
  }
  if (platformFilter && platformFilter.length > 0) {
    posts = posts.filter((p) => platformFilter.includes(p.platform))
  }

  return {
    feature,
    label: FEATURE_LABELS[feature],
    totalComments: total,
    positiveCount,
    negativeCount,
    neutralCount,
    positivePercentage: total > 0 ? Math.round((positiveCount / total) * 100) : 0,
    negativePercentage: total > 0 ? Math.round((negativeCount / total) * 100) : 0,
    postCount: posts.length,
  }
}

// =============================================================================
// RECENT POSTS (used by Social Feed)
// =============================================================================

export interface RecentPost {
  id: string
  platform: "instagram" | "tiktok" | "facebook" | "twitter"
  postUrl: string
  caption: string
  postDate: string
  totalComments: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  positivePercent: number
  negativePercent: number
  neutralPercent: number
  latestCommentDate: string
  sampleComments: { text: string; sentiment: Sentiment; username: string }[]
}

export function getRecentPostsWithSentiment(
  days: number = 7,
  platformFilter?: CommentPlatform[],
  dateRange?: DateRange,
): RecentPost[] {
  const data = loadData()

  let posts = data.posts

  if (platformFilter && platformFilter.length > 0) {
    posts = posts.filter((p) => platformFilter.includes(p.platform))
  }

  // Apply explicit date range when provided, otherwise fall back to a rolling
  // window of `days` anchored to the most recent post in the (filtered) data.
  if (dateRange) {
    posts = posts.filter((p) => isWithinDateRange(p.timestamp, dateRange))
  } else if (days && days > 0) {
    let maxDate = 0
    for (const p of posts) {
      const t = new Date(p.timestamp).getTime()
      if (!Number.isNaN(t) && t > maxDate) maxDate = t
    }
    if (maxDate > 0) {
      const cutoff = maxDate - days * 24 * 60 * 60 * 1000
      posts = posts.filter((p) => {
        const t = new Date(p.timestamp).getTime()
        return !Number.isNaN(t) && t >= cutoff
      })
    }
  }

  // Build the RecentPost shape expected by RecentPosts and LastWeekPosts.
  const result: RecentPost[] = posts.map((post) => {
    const postComments = data.allComments.filter((c) => c.postUrl === post.url)
    const positive = postComments.filter((c) => c.sentiment === "positive").length
    const negative = postComments.filter((c) => c.sentiment === "negative").length
    const neutral = postComments.filter((c) => c.sentiment === "neutral").length
    const total = postComments.length

    // Most recent comment date (fallback to the post timestamp).
    let latestCommentDate = post.timestamp
    let latestTime = 0
    for (const c of postComments) {
      const t = new Date(c.createdAt).getTime()
      if (!Number.isNaN(t) && t > latestTime) {
        latestTime = t
        latestCommentDate = c.createdAt
      }
    }

    // Pick up to 3 representative sample comments (prefer non-empty text).
    const sampleComments = postComments
      .filter((c) => c.text && c.text.trim().length > 0)
      .slice(0, 3)
      .map((c) => ({ text: c.text, sentiment: c.sentiment, username: c.username }))

    return {
      id: post.id,
      platform: post.platform,
      postUrl: post.url,
      caption: post.caption,
      postDate: post.timestamp,
      totalComments: total,
      positiveCount: positive,
      negativeCount: negative,
      neutralCount: neutral,
      positivePercent: total > 0 ? Math.round((positive / total) * 100) : 0,
      negativePercent: total > 0 ? Math.round((negative / total) * 100) : 0,
      neutralPercent: total > 0 ? Math.round((neutral / total) * 100) : 0,
      latestCommentDate,
      sampleComments,
    }
  })

  // Only surface posts that actually have comment activity, newest first.
  return result
    .filter((p) => p.totalComments > 0)
    .sort((a, b) => new Date(b.latestCommentDate).getTime() - new Date(a.latestCommentDate).getTime())
}

// Export NormalizedPost type for use in other files
export type { NormalizedPost }

// Get all posts with optional filters
export function getAllPosts(
  platformFilter?: CommentPlatform[],
  dateRange?: DateRange,
): NormalizedPost[] {
  const data = loadData()
  
  let posts = data.posts
  
  if (platformFilter && platformFilter.length > 0) {
    posts = posts.filter(p => platformFilter.includes(p.platform))
  }
  
  if (dateRange) {
    posts = posts.filter(p => isWithinDateRange(p.timestamp, dateRange))
  }
  
  return posts
}
