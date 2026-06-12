import raqamitvData from "@/data/influencer-raqamitv.json"
import slorksData from "@/data/influencer-slorks.json"
import mohamedhakimData from "@/data/influencer-mohamedhakim.json"
import ahmedaliData from "@/data/influencer-ahmedali.json"
import omardizerData from "@/data/influencer-omardizer.json"
import osamaqaqData from "@/data/influencer-osamaqaq.json"
import husamkwaikData from "@/data/influencer-husamkwaik.json"
import leenjadaanData from "@/data/influencer-leenjadaan.json"
import danaindxbData from "@/data/influencer-danaindxb.json"
import yourkuyamicoData from "@/data/influencer-yourkuyamico.json"

// Influencer metadata.
// category: "tech" = the original review-focused accounts; "lifestyle" =
// general accounts where ONLY their S26-related videos are tracked.
export const INFLUENCERS = {
  slorks: {
    id: "slorks",
    name: "Slorks",
    handle: "@slorks",
    engagementRate: 6.0,
    platform: "Instagram" as const,
    category: "tech" as const,
  },
  raqamitv: {
    id: "raqamitv",
    name: "RaqamiTV",
    handle: "@raqamitv",
    engagementRate: 3.0,
    platform: "Instagram" as const,
    category: "tech" as const,
  },
  omardizer: {
    id: "omardizer",
    name: "Omardizer",
    handle: "@omardizer",
    engagementRate: 5.0,
    platform: "Instagram" as const,
    category: "tech" as const,
  },
  ahmedali: {
    id: "ahmedali",
    name: "Ahmed Ali",
    handle: "@a7medali",
    engagementRate: 3.2,
    platform: "Instagram" as const,
    category: "tech" as const,
  },
  mohamedhakim: {
    id: "mohamedhakim",
    name: "Mohamed Hakim",
    handle: "@mohamedhakim",
    engagementRate: 2.3,
    platform: "Instagram" as const,
    category: "tech" as const,
  },
  osamaqaq: {
    id: "osamaqaq",
    name: "Osama Kak",
    handle: "@osamaqaq",
    engagementRate: 4.1, // avg engagement on the tracked S26 reel vs 242k followers
    platform: "Instagram" as const,
    category: "lifestyle" as const,
  },
  husamkwaik: {
    id: "husamkwaik",
    name: "Husam Kwaik",
    handle: "@husamkwaik",
    engagementRate: 0,
    platform: "Instagram" as const,
    category: "lifestyle" as const,
  },
  leenjadaan: {
    id: "leenjadaan",
    name: "Leen Jadaan",
    handle: "@leenjadaan",
    engagementRate: 0,
    platform: "Instagram" as const,
    category: "lifestyle" as const,
  },
  danaindxb: {
    id: "danaindxb",
    name: "Danah Alshayji",
    handle: "@danaindxb",
    engagementRate: 0,
    platform: "Instagram" as const,
    category: "lifestyle" as const,
  },
  yourkuyamico: {
    id: "yourkuyamico",
    name: "Michael Banua",
    handle: "@yourkuyamico",
    engagementRate: 0,
    platform: "Instagram" as const,
    category: "lifestyle" as const,
  },
} as const

export type InfluencerId = keyof typeof INFLUENCERS
export type InfluencerCategory = "tech" | "lifestyle"

export interface InfluencerComment {
  id: string
  text: string
  timestamp: string
  ownerUsername: string
  postUrl: string
  likes: number
  sentiment: "positive" | "neutral" | "negative"
  influencerId: InfluencerId
}

export interface InfluencerMetrics {
  totalComments: number
  positiveCount: number
  neutralCount: number
  negativeCount: number
  positivePercent: number
  neutralPercent: number
  negativePercent: number
  totalLikes: number
  avgLikesPerComment: number
  uniquePosts: number
  brandHealthScore: number
  engagementRate: number
}

// Sentiment analysis patterns
const POSITIVE_PATTERNS = [
  // Arabic positive words
  /جميل|رائع|ممتاز|حلو|جامد|تحفه|تحفة|خطير|روعه|روعة|عاش|برافو|فنان|مبدع|أحسنت|احسنت/,
  /الله|ماشاء|يسلمو|أفضل|افضل|حبيت|أحب|احب|اعجبني|أعجبني|شكرا|شكراً/,
  /فخم|جبار|خرافي|أسطوري|اسطوري|نار|قوي|قوية|مميز|مختلف/,
  // English positive
  /amazing|awesome|great|love|best|excellent|perfect|beautiful|fantastic|incredible/i,
  /good|nice|cool|wow|fire|wonderful|brilliant|superb|outstanding/i,
  // Emoji patterns for positive
  /[😍🔥❤️💪👏🙌✨💯🎉👍💕😎🤩⭐]/,
]

const NEGATIVE_PATTERNS = [
  // Arabic negative words
  /سيء|سيئ|مش حلو|ضعيف|فاشل|زفت|زبالة|خرا|غالي|مبالغ|مشكلة|مشكله|عيب/,
  /خايب|ما عجبني|ما حبيت|سرقه|سرقة|نصب|غش|كذب|وقح|تافه/,
  // English negative
  /bad|worst|terrible|horrible|hate|ugly|awful|disappointed|disappointing|overpriced/i,
  /expensive|waste|poor|sucks|boring|useless|fake|scam|garbage|trash/i,
  // Emoji patterns for negative
  /[😡😠😤💔👎😢😭🤮🤢]/,
]

function analyzeSentiment(text: string): "positive" | "neutral" | "negative" {
  if (!text || text.trim().length === 0) return "neutral"
  
  const textLower = text.toLowerCase()
  
  let positiveScore = 0
  let negativeScore = 0
  
  for (const pattern of POSITIVE_PATTERNS) {
    if (pattern.test(text) || pattern.test(textLower)) {
      positiveScore++
    }
  }
  
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(text) || pattern.test(textLower)) {
      negativeScore++
    }
  }
  
  if (positiveScore > negativeScore) return "positive"
  if (negativeScore > positiveScore) return "negative"
  
  // Default emoji-only or short positive comments to positive
  if (/^[😍🔥❤️💪👏🙌✨💯🎉👍💕😎🤩⭐\s]+$/.test(text)) return "positive"
  
  return "neutral"
}

// Political/country filter patterns (same as social comments)
const POLITICAL_PATTERNS = [
  /uae/i, /emirates/i, /emirati/i, /\bdubai\b/i, /\babu\s*dhabi\b/i,
  /الإمارات/, /الامارات/, /امارات/, /إمارات/, /دبي/, /ابوظبي/, /أبوظبي/, /زايد/,
  /sudan/i, /sudanese/i, /السودان/, /سوداني/, /الفاشر/, /فاشر/, /بارا/,
  /\bsaudi\b/i, /\bksa\b/i, /السعودية/, /سعودي/,
  /\bisrael\b/i, /إسرائيل/, /اسرائيل/, /\bpalestine\b/i, /\bpalestinian\b/i, /فلسطين/, /فلسطيني/,
  /\biran\b/i, /إيران/, /ايران/, /غزة/, /غزه/,
  /سياس/, /حكوم/, /حرب/, /جهاد/, /انقذ/, /أنقذ/, /تبيد/, /يبيد/, /تقتل/, /يقتل/,
  /مليشيا/, /قاطع/, /مقاطعة/, /إباد/, /ابادة/,
  /#.*save/i, /#.*stop/i, /#انقذ/, /#أنقذ/, /#.*boycott/i,
]

function containsPoliticalContent(text: string): boolean {
  if (!text) return false
  for (const pattern of POLITICAL_PATTERNS) {
    if (pattern.test(text)) return true
  }
  return false
}

interface RawCommentV1 {
  id?: string
  text: string
  timestamp?: string
  ownerUsername?: string
  postUrl: string
  likes?: number
}

function normalizeComments(data: RawCommentV1[], influencerId: InfluencerId): InfluencerComment[] {
  const comments: InfluencerComment[] = []
  let idCounter = 0
  
  for (const item of data) {
    const text = item.text?.trim() || ""
    
    // Skip empty comments
    if (!text) continue
    
    // Skip political content
    if (containsPoliticalContent(text)) continue
    
    comments.push({
      id: item.id || `${influencerId}-${idCounter++}`,
      text,
      timestamp: item.timestamp || new Date().toISOString(),
      ownerUsername: item.ownerUsername || "user",
      postUrl: item.postUrl || "",
      likes: item.likes || 0,
      sentiment: analyzeSentiment(text),
      influencerId,
    })
  }
  
  return comments
}

// Cache for processed comments
let cachedComments: Map<InfluencerId, InfluencerComment[]> | null = null

export function getInfluencerComments(influencerId: InfluencerId): InfluencerComment[] {
  if (!cachedComments) {
    cachedComments = new Map()
    cachedComments.set("raqamitv", normalizeComments(raqamitvData as RawCommentV1[], "raqamitv"))
    cachedComments.set("slorks", normalizeComments(slorksData as RawCommentV1[], "slorks"))
    cachedComments.set("mohamedhakim", normalizeComments(mohamedhakimData as RawCommentV1[], "mohamedhakim"))
    cachedComments.set("ahmedali", normalizeComments(ahmedaliData as RawCommentV1[], "ahmedali"))
    cachedComments.set("omardizer", normalizeComments(omardizerData as RawCommentV1[], "omardizer"))
    cachedComments.set("osamaqaq", normalizeComments(osamaqaqData as RawCommentV1[], "osamaqaq"))
    cachedComments.set("husamkwaik", normalizeComments(husamkwaikData as RawCommentV1[], "husamkwaik"))
    cachedComments.set("leenjadaan", normalizeComments(leenjadaanData as RawCommentV1[], "leenjadaan"))
    cachedComments.set("danaindxb", normalizeComments(danaindxbData as RawCommentV1[], "danaindxb"))
    cachedComments.set("yourkuyamico", normalizeComments(yourkuyamicoData as RawCommentV1[], "yourkuyamico"))
  }
  
  return cachedComments.get(influencerId) || []
}

export function getAllInfluencerComments(): InfluencerComment[] {
  const allComments: InfluencerComment[] = []
  for (const id of Object.keys(INFLUENCERS) as InfluencerId[]) {
    allComments.push(...getInfluencerComments(id))
  }
  return allComments
}

export function getInfluencerMetrics(influencerId: InfluencerId): InfluencerMetrics {
  const comments = getInfluencerComments(influencerId)
  const influencer = INFLUENCERS[influencerId]
  
  const positiveCount = comments.filter(c => c.sentiment === "positive").length
  const neutralCount = comments.filter(c => c.sentiment === "neutral").length
  const negativeCount = comments.filter(c => c.sentiment === "negative").length
  const totalComments = comments.length
  
  const totalLikes = comments.reduce((sum, c) => sum + c.likes, 0)
  const uniquePosts = new Set(comments.map(c => c.postUrl)).size
  
  // Calculate brand health score (weighted sentiment)
  const positiveWeight = 1
  const neutralWeight = 0.5
  const negativeWeight = 0
  const weightedSum = (positiveCount * positiveWeight) + (neutralCount * neutralWeight) + (negativeCount * negativeWeight)
  const maxPossible = totalComments * positiveWeight
  const brandHealthScore = maxPossible > 0 ? Math.round((weightedSum / maxPossible) * 100) : 0
  
  return {
    totalComments,
    positiveCount,
    neutralCount,
    negativeCount,
    positivePercent: totalComments > 0 ? Math.round((positiveCount / totalComments) * 100) : 0,
    neutralPercent: totalComments > 0 ? Math.round((neutralCount / totalComments) * 100) : 0,
    negativePercent: totalComments > 0 ? Math.round((negativeCount / totalComments) * 100) : 0,
    totalLikes,
    avgLikesPerComment: totalComments > 0 ? Math.round((totalLikes / totalComments) * 10) / 10 : 0,
    uniquePosts,
    brandHealthScore,
    engagementRate: influencer.engagementRate,
  }
}

export function getAllInfluencerMetrics(): Record<InfluencerId, InfluencerMetrics> {
  const metrics: Partial<Record<InfluencerId, InfluencerMetrics>> = {}
  for (const id of Object.keys(INFLUENCERS) as InfluencerId[]) {
    metrics[id] = getInfluencerMetrics(id)
  }
  return metrics as Record<InfluencerId, InfluencerMetrics>
}

export interface InfluencerComparison {
  influencerId: InfluencerId
  name: string
  handle: string
  engagementRate: number
  totalComments: number
  positivePercent: number
  negativePercent: number
  brandHealthScore: number
  avgLikesPerComment: number
}

export function getInfluencerComparison(): InfluencerComparison[] {
  return (Object.keys(INFLUENCERS) as InfluencerId[]).map(id => {
    const influencer = INFLUENCERS[id]
    const metrics = getInfluencerMetrics(id)
    return {
      influencerId: id,
      name: influencer.name,
      handle: influencer.handle,
      engagementRate: influencer.engagementRate,
      totalComments: metrics.totalComments,
      positivePercent: metrics.positivePercent,
      negativePercent: metrics.negativePercent,
      brandHealthScore: metrics.brandHealthScore,
      avgLikesPerComment: metrics.avgLikesPerComment,
    }
  }).sort((a, b) => b.brandHealthScore - a.brandHealthScore)
}

export interface InfluencerInsight {
  type: "success" | "warning" | "danger" | "info"
  title: string
  message: string
  influencerId?: InfluencerId
  sentiment?: "positive" | "neutral" | "negative"
  comments: InfluencerComment[]
}

export function getInfluencerInsights(influencerId: InfluencerId): InfluencerInsight[] {
  const comments = getInfluencerComments(influencerId)
  const metrics = getInfluencerMetrics(influencerId)
  const influencer = INFLUENCERS[influencerId]
  const insights: InfluencerInsight[] = []
  
  // 1. Sentiment insight (always show)
  const sentimentType = metrics.positivePercent >= 60 ? "success" : metrics.negativePercent >= 20 ? "warning" : "info"
  const sentimentTitle = metrics.positivePercent >= metrics.negativePercent 
    ? `${metrics.positivePercent}% Positive Sentiment`
    : `${metrics.negativePercent}% Negative Sentiment`
  const sentimentMessage = metrics.positivePercent >= 60
    ? `Strong positive reception with ${metrics.positiveCount} positive comments`
    : metrics.negativePercent >= 20
      ? `${metrics.negativeCount} negative comments require attention`
      : `Balanced sentiment with ${metrics.positiveCount} positive comments`
  insights.push({
    type: sentimentType,
    title: sentimentTitle,
    message: sentimentMessage,
    influencerId,
    sentiment: metrics.positivePercent >= metrics.negativePercent ? "positive" : "negative",
    comments: comments.filter(c => c.sentiment === (metrics.positivePercent >= metrics.negativePercent ? "positive" : "negative")).slice(0, 200),
  })
  
  // 2. Engagement insight (always show)
  const engagementType = influencer.engagementRate >= 5 ? "success" : influencer.engagementRate >= 3 ? "info" : "warning"
  const engagementMessage = influencer.engagementRate >= 5 
    ? "Above average engagement - high audience interaction"
    : influencer.engagementRate >= 3
      ? "Good engagement - solid audience interaction"
      : "Moderate engagement - consider content optimization"
  insights.push({
    type: engagementType,
    title: `${influencer.engagementRate}% Engagement Rate`,
    message: engagementMessage,
    influencerId,
    comments: comments.slice(0, 50),
  })
  
  // 3. Volume insight (always show)
  insights.push({
    type: "info",
    title: `${metrics.totalComments} Comments Analyzed`,
    message: metrics.totalComments >= 100 
      ? `Data from ${metrics.uniquePosts} posts provides reliable insights`
      : `Data from ${metrics.uniquePosts} posts`,
    influencerId,
    comments: comments.slice(0, 100),
  })
  
  // 4. Comment health (always show)
  insights.push({
    type: metrics.brandHealthScore >= 70 ? "success" : metrics.brandHealthScore >= 50 ? "warning" : "danger",
    title: `Comment Health: ${metrics.brandHealthScore}/100`,
    message: metrics.brandHealthScore >= 70 
      ? "Strong comment sentiment" 
      : metrics.brandHealthScore >= 50 
        ? "Moderate sentiment - monitor for trends"
        : "Low comment health - review content strategy",
    influencerId,
    comments: comments.slice(0, 100),
  })
  
  return insights
}

export function getTopEngagingComments(influencerId: InfluencerId, limit = 10): InfluencerComment[] {
  const comments = getInfluencerComments(influencerId)
  return [...comments]
    .sort((a, b) => b.likes - a.likes)
    .slice(0, limit)
}

// Combined insights for all influencers
export function getCombinedInsights(): InfluencerInsight[] {
  const allComments = getAllInfluencerComments()
  const comparison = getInfluencerComparison()
  const insights: InfluencerInsight[] = []
  
  // Best performing influencer
  const best = comparison[0]
  if (best) {
  insights.push({
    type: "success",
    title: `${best.name} - Best Performer`,
    message: `${best.brandHealthScore}/100 comment health with ${best.positivePercent}% positive sentiment`,
      influencerId: best.influencerId,
      comments: getInfluencerComments(best.influencerId).filter(c => c.sentiment === "positive").slice(0, 100),
    })
  }
  
  // Highest engagement
  const highestEngagement = [...comparison].sort((a, b) => b.engagementRate - a.engagementRate)[0]
  if (highestEngagement) {
    insights.push({
      type: "success",
      title: `${highestEngagement.name} - Highest Engagement`,
      message: `${highestEngagement.engagementRate}% engagement rate leads the group`,
      influencerId: highestEngagement.influencerId,
      comments: getInfluencerComments(highestEngagement.influencerId).slice(0, 100),
    })
  }
  
  // Most comments
  const mostComments = [...comparison].sort((a, b) => b.totalComments - a.totalComments)[0]
  if (mostComments) {
    insights.push({
      type: "info",
      title: `${mostComments.name} - Most Active`,
      message: `${mostComments.totalComments} comments analyzed - highest volume`,
      influencerId: mostComments.influencerId,
      comments: getInfluencerComments(mostComments.influencerId).slice(0, 100),
    })
  }
  
  // Needs attention (lowest comment health)
  const lowest = comparison[comparison.length - 1]
  if (lowest && lowest.brandHealthScore < 70) {
    insights.push({
      type: "warning",
      title: `${lowest.name} - Needs Review`,
      message: `${lowest.brandHealthScore}/100 comment health - consider content strategy`,
      influencerId: lowest.influencerId,
      comments: getInfluencerComments(lowest.influencerId).filter(c => c.sentiment === "negative").slice(0, 100),
    })
  }
  
  // Total volume
  const totalComments = allComments.length
  const totalPositive = allComments.filter(c => c.sentiment === "positive").length
  const overallPositiveRate = Math.round((totalPositive / totalComments) * 100)
  
  insights.push({
    type: overallPositiveRate >= 60 ? "success" : "info",
    title: `${totalComments.toLocaleString()} Total Comments`,
    message: `${overallPositiveRate}% overall positive sentiment across all influencers`,
    comments: allComments.slice(0, 200),
  })
  
  return insights
}
