// Processed social media data from Samsung Gulf social accounts
// Sources: @samsunggulf on Facebook, Instagram, TikTok, and X (Twitter)
// Updated: 2026-04-29 - Added new TikTok posts data

// Import raw scraped data
import facebookRaw from "@/data/facebook-posts.json"
import instagramRaw from "@/data/instagram-posts.json"
import twitterRaw from "@/data/twitter-posts.json"
import tiktokRaw from "@/data/tiktok-posts.json"
import { type DateRange, isWithinDateRange } from "@/components/dashboard/date-filter"

export type Platform = "facebook" | "instagram" | "tiktok" | "twitter"

export interface SocialPost {
  id: string
  platform: Platform
  url: string
  text: string
  likes: number
  comments: number
  shares: number
  views?: number
  publishDate: string
  product: string | null
}

export interface PlatformMetrics {
  platform: Platform
  totalPosts: number
  totalLikes: number
  totalComments: number
  totalShares: number
  totalViews?: number
  totalEngagement: number
}

export interface ProductMetrics {
  product: string
  posts: number
  likes: number
  comments: number
  shares: number
  engagement: number
}

export interface ProcessedDashboardData {
  posts: SocialPost[]
  kpiMetrics: {
    totalEngagement: number
    totalLikes: number
    totalComments: number
    totalShares: number
    totalViews: number
    totalPosts: number
    avgLikesPerPost: number
    avgCommentsPerPost: number
  }
  platformMetrics: PlatformMetrics[]
  productMetrics: ProductMetrics[]
  topPosts: SocialPost[]
}

// Helper function to detect product from post text
function detectProduct(text: string): string | null {
  if (!text) return null
  
  const productPatterns: { pattern: RegExp; product: string }[] = [
    { pattern: /Galaxy\s*S26\s*Ultra|#GalaxyS26Ultra/i, product: "Galaxy S26 Ultra" },
    { pattern: /Galaxy\s*S26\s*\+|Galaxy\s*S26\s*Plus/i, product: "Galaxy S26+" },
    { pattern: /Galaxy\s*S26\s*Series|#GalaxyS26(?!\w)/i, product: "Galaxy S26 Series" },
    { pattern: /Galaxy\s*S25\s*Ultra|#GalaxyS25Ultra/i, product: "Galaxy S25 Ultra" },
    { pattern: /Galaxy\s*S25|#GalaxyS25/i, product: "Galaxy S25 Series" },
    { pattern: /Galaxy\s*S24\s*Ultra|#GalaxyS24Ultra/i, product: "Galaxy S24 Ultra" },
    { pattern: /Galaxy\s*S24|#GalaxyS24/i, product: "Galaxy S24 Series" },
    { pattern: /Galaxy\s*Z\s*Fold\s*7|#GalaxyZFold7/i, product: "Galaxy Z Fold 7" },
    { pattern: /Galaxy\s*Z\s*Fold\s*6|#GalaxyZFold6/i, product: "Galaxy Z Fold 6" },
    { pattern: /Galaxy\s*Z\s*Flip\s*6|#GalaxyZFlip6/i, product: "Galaxy Z Flip 6" },
    { pattern: /Galaxy\s*Z\s*Fold|#GalaxyZFold/i, product: "Galaxy Z Fold" },
    { pattern: /Galaxy\s*Z\s*Flip|#GalaxyZFlip/i, product: "Galaxy Z Flip" },
    { pattern: /Galaxy\s*Buds\s*4\s*Pro|#GalaxyBuds4Pro/i, product: "Galaxy Buds 4 Pro" },
    { pattern: /Galaxy\s*Buds\s*4|#GalaxyBuds4/i, product: "Galaxy Buds 4" },
    { pattern: /Galaxy\s*Buds|#GalaxyBuds/i, product: "Galaxy Buds" },
    { pattern: /Galaxy\s*Watch\s*8|#GalaxyWatch8/i, product: "Galaxy Watch 8" },
    { pattern: /Galaxy\s*Watch\s*7|#GalaxyWatch7/i, product: "Galaxy Watch 7" },
    { pattern: /Galaxy\s*Watch|#GalaxyWatch/i, product: "Galaxy Watch" },
    { pattern: /Galaxy\s*Ring|#GalaxyRing/i, product: "Galaxy Ring" },
    { pattern: /Samsung\s*Art\s*TV|#SamsungArtTV/i, product: "Samsung Art TV" },
    { pattern: /The\s*Frame|#TheFrame/i, product: "The Frame" },
    { pattern: /Neo\s*QLED|#NeoQLED/i, product: "Neo QLED TV" },
    { pattern: /Micro\s*LED|#MicroLED/i, product: "Micro LED TV" },
    { pattern: /Bespoke\s*AI|#BespokeAI/i, product: "Bespoke AI" },
    { pattern: /Smart\s*Things|#SmartThings/i, product: "SmartThings" },
    { pattern: /Smart\s*Switch|#SmartSwitch/i, product: "Smart Switch" },
    { pattern: /Samsung\s*Knox|#SamsungKnox/i, product: "Samsung Knox" },
    { pattern: /Samsung\s*Health/i, product: "Samsung Health" },
    { pattern: /#GalaxyAI/i, product: "Galaxy AI" },
    { pattern: /Galaxy\s*Tab|#GalaxyTab/i, product: "Galaxy Tab" },
    { pattern: /Galaxy\s*A\d{2}/i, product: "Galaxy A Series" },
  ]

  for (const { pattern, product } of productPatterns) {
    if (pattern.test(text)) {
      return product
    }
  }
  return null
}

// Parse date from various formats
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0]
  
  // Handle Twitter format: "Tue Mar 31 06:10:36 +0000 2026"
  if (dateStr.includes("+0000")) {
    const date = new Date(dateStr)
    return date.toISOString().split('T')[0]
  }
  // Handle ISO format
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0]
  }
  return dateStr
}

// Process Facebook posts (handles both old format and new processed format)
function processFacebookPosts(): SocialPost[] {
  return (facebookRaw as any[]).map((post, index) => ({
    id: post.id || `fb-${index + 1}`,
    platform: "facebook" as Platform,
    url: post.url || "",
    text: post.content || post.text || "",
    likes: post.engagement?.likes || post.likes || 0,
    comments: post.engagement?.comments || post.comments || 0,
    shares: post.engagement?.shares || post.shares || 0,
    views: post.engagement?.views || post.views || 0,
    publishDate: parseDate(post.timestamp || post.time || post.date || ""),
    product: detectProduct(post.content || post.text || ""),
  }))
}

// Process Instagram posts (handles both old format and new processed format)
function processInstagramPosts(): SocialPost[] {
  return (instagramRaw as any[]).map((post, index) => ({
    id: post.id || `ig-${index + 1}`,
    platform: "instagram" as Platform,
    url: post.url || post.inputUrl || "",
    text: post.content || post.caption || post.text || "",
    likes: post.engagement?.likes || post.likesCount || post.likes || 0,
    comments: post.engagement?.comments || post.commentsCount || post.comments || 0,
    shares: post.engagement?.shares || 0, // Instagram doesn't expose shares
    views: post.engagement?.views || post.views || 0,
    publishDate: parseDate(post.timestamp || post.date || ""),
    product: detectProduct(post.content || post.caption || post.text || ""),
  }))
}

// Process Twitter/X posts (handles both old format and new processed format)
function processTwitterPosts(): SocialPost[] {
  return (twitterRaw as any[]).map((post, index) => ({
    id: post.id || `tw-${index + 1}`,
    platform: "twitter" as Platform,
    url: post.url || `https://x.com/SamsungGulf/status/${post.id}`,
    text: post.content || post.text || post.full_text || "",
    likes: post.engagement?.likes || post.likeCount || post.favorite_count || 0,
    comments: post.engagement?.comments || post.replyCount || 0,
    shares: post.engagement?.shares || post.retweetCount || post.retweet_count || 0,
    views: post.engagement?.views || post.viewCount || 0,
    publishDate: parseDate(post.timestamp || post.createdAt || post.created_at || ""),
    product: detectProduct(post.content || post.text || post.full_text || ""),
  }))
}

// Process TikTok posts (handles both old format and new processed format)
function processTiktokPosts(): SocialPost[] {
  return (tiktokRaw as any[])
    .filter(post => post.content || post.text || post.desc || post.url)
    .map((post, index) => ({
      id: post.id || `tt-${index + 1}`,
      platform: "tiktok" as Platform,
      url: post.url || post.webVideoUrl || "https://www.tiktok.com/@samsunggulf",
      text: post.content || post.text || post.desc || "(Video post)",
      likes: post.engagement?.likes || post.diggCount || post.likes || 0,
      comments: post.engagement?.comments || post.commentCount || 0,
      shares: post.engagement?.shares || post.shareCount || post.shares || 0,
      views: post.engagement?.views || post.playCount || post.views || 0,
      publishDate: parseDate(post.timestamp || post.createTimeISO || post.createTime || ""),
      product: detectProduct(post.content || post.text || post.desc || ""),
    }))
}

// Helper function to deduplicate posts by text content
function deduplicatePosts(posts: SocialPost[]): SocialPost[] {
  const seen = new Set<string>()
  return posts.filter(post => {
    // Use URL as primary deduplication key (more reliable), fallback to text
    const key = post.url || post.text.slice(0, 100).toLowerCase().trim()
    if (!key || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

// Process all posts
const facebookPosts = deduplicatePosts(processFacebookPosts())
const instagramPosts = deduplicatePosts(processInstagramPosts())
const twitterPosts = deduplicatePosts(processTwitterPosts())
const tiktokPosts = deduplicatePosts(processTiktokPosts())

// Combine all posts
const allPosts: SocialPost[] = [
  ...facebookPosts,
  ...instagramPosts,
  ...twitterPosts,
  ...tiktokPosts,
]

// Process the data for dashboard with optional platform and date filters
export function getProcessedDashboardData(platformFilter?: Platform[], dateRange?: DateRange): ProcessedDashboardData {
  // Filter posts by platform and date range if filters are provided
  let filteredPosts = platformFilter && platformFilter.length > 0
    ? allPosts.filter(post => platformFilter.includes(post.platform))
    : allPosts
  
  if (dateRange) {
    filteredPosts = filteredPosts.filter(post => isWithinDateRange(post.publishDate, dateRange))
  }
    
  // Calculate KPI metrics
  const totalLikes = filteredPosts.reduce((sum, post) => sum + post.likes, 0)
  const totalComments = filteredPosts.reduce((sum, post) => sum + post.comments, 0)
  const totalShares = filteredPosts.reduce((sum, post) => sum + post.shares, 0)
  const totalViews = filteredPosts.reduce((sum, post) => sum + (post.views || 0), 0)
  const totalPosts = filteredPosts.length
  const totalEngagement = totalLikes + totalComments + totalShares

  // Group by platform - only include platforms in filter (or all if no filter)
  const platformMap = new Map<Platform, PlatformMetrics>()
  const platforms: Platform[] = platformFilter && platformFilter.length > 0 
    ? platformFilter 
    : ["facebook", "instagram", "twitter", "tiktok"]
  
  platforms.forEach(platform => {
    const platformPosts = filteredPosts.filter(p => p.platform === platform)
    platformMap.set(platform, {
      platform,
      totalPosts: platformPosts.length,
      totalLikes: platformPosts.reduce((sum, p) => sum + p.likes, 0),
      totalComments: platformPosts.reduce((sum, p) => sum + p.comments, 0),
      totalShares: platformPosts.reduce((sum, p) => sum + p.shares, 0),
      totalViews: platformPosts.reduce((sum, p) => sum + (p.views || 0), 0),
      totalEngagement: platformPosts.reduce((sum, p) => sum + p.likes + p.comments + p.shares, 0),
    })
  })

  const platformMetrics = Array.from(platformMap.values())
    .sort((a, b) => b.totalEngagement - a.totalEngagement)

  // Group by product
  const productMap = new Map<string, { posts: number; likes: number; comments: number; shares: number }>()
  
  filteredPosts.forEach(post => {
    const product = post.product || "Other"
    const existing = productMap.get(product) || { posts: 0, likes: 0, comments: 0, shares: 0 }
    productMap.set(product, {
      posts: existing.posts + 1,
      likes: existing.likes + post.likes,
      comments: existing.comments + post.comments,
      shares: existing.shares + post.shares,
    })
  })

  const productMetrics = Array.from(productMap.entries())
    .map(([product, data]) => ({
      product,
      ...data,
      engagement: data.likes + data.comments + data.shares,
    }))
    .sort((a, b) => b.engagement - a.engagement)

  // Get top posts by engagement
  const topPosts = [...filteredPosts]
    .sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares))
    .slice(0, 10)

  return {
    posts: filteredPosts,
    kpiMetrics: {
      totalEngagement,
      totalLikes,
      totalComments,
      totalShares,
      totalViews,
      totalPosts,
      avgLikesPerPost: totalPosts > 0 ? Math.round(totalLikes / totalPosts) : 0,
      avgCommentsPerPost: totalPosts > 0 ? Math.round((totalComments / totalPosts) * 10) / 10 : 0,
    },
    platformMetrics,
    productMetrics,
    topPosts,
  }
}

// Get posts for social feed display with optional platform and date filters
export function getSocialFeedPosts(platformFilter?: Platform[], dateRange?: DateRange) {
  let filteredPosts = platformFilter && platformFilter.length > 0
    ? allPosts.filter(post => platformFilter.includes(post.platform))
    : allPosts
  
  if (dateRange) {
    filteredPosts = filteredPosts.filter(post => isWithinDateRange(post.publishDate, dateRange))
  }
    
  return filteredPosts
    .map(post => ({
      id: post.id,
      platform: post.platform,
      url: post.url,
      content: post.text,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      views: post.views,
      product: post.product || "Samsung",
      publishDate: post.publishDate,
    }))
    .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
}

// Get platform-specific metrics with optional platform filter
export function getPlatformMetrics(platformFilter?: Platform[]) {
  const data = getProcessedDashboardData(platformFilter)
  return data.platformMetrics
}

// Export raw data arrays for reference
export { facebookPosts, instagramPosts, twitterPosts, tiktokPosts, allPosts }
