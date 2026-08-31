import { consumeStream, convertToModelMessages, streamText, type UIMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import {
  getAnalyzedReviews,
  calculateSentimentMetrics,
  analyzeThemes,
  getProductLines,
  getMonthVsLastYearComparison,
  getQuarterVsLastYearComparison,
  getTopReviews,
  type AnalyzedReview
} from '@/lib/reviews-data'
import type { UnpackedPayload, UnpackedVideo, UnpackedComment } from '@/lib/unpacked-data'
import { videoPositivePercent } from '@/lib/unpacked-data'

// Building the live context fetches the full dashboard payloads through the
// edge cache. A warm edge serves /api/comments in ~0.4s, but a cold one pays
// the full ~90s DB rebuild — with a 60s cap the function died before the
// rebuild could finish (and before the cache ever warmed), so every cold chat
// 504'd forever. 300s lets the first cold request complete and warm the cache.
export const maxDuration = 300

// =============================================================================
// LIVE DATA — shapes returned by our own dashboard API routes
// =============================================================================

interface LivePost {
  id: string
  platform: string
  url: string
  caption: string
  timestamp: string
  likes: number
  views: number
  department: string
  productCategory: string
  productModel: string
}

interface LiveComment {
  id: string
  postId: string
  postUrl: string
  platform: string
  text: string
  username: string
  createdAt: string
  sentiment: 'positive' | 'negative' | 'neutral'
  sentimentFlags: string[]
  likes: number
  productModel: string | null
  department: string | null
}

interface CommentsPayload {
  posts: LivePost[]
  comments: LiveComment[]
  meta: { totalPosts: number; totalComments: number; analyzedComments: number; unanalyzedComments: number }
}

interface RosterVideo extends UnpackedVideo {
  rosterId: string
  rosterName: string
  category: string
}

interface RosterPayload {
  videos: RosterVideo[]
  roster: { id: string; name: string; handle: string; platform: string; category: string }[]
  f7Comments: { text: string; username: string; likes: number; sentiment: string }[]
  meta: { generatedAt: string; f7Videos: number }
}

async function fetchJson<T>(origin: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${origin}${path}`, { headers: { accept: 'application/json' } })
    if (!res.ok) {
      console.error(`[chat] ${path} returned ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (error) {
    console.error(`[chat] failed to fetch ${path}:`, error)
    return null
  }
}

// =============================================================================
// SOCIAL MEDIA CONTEXT (@samsunggulf brand accounts — live Supabase data)
// =============================================================================

const issuePatterns: { pattern: RegExp; issue: string }[] = [
  { pattern: /battery|drain|dies|charge/i, issue: 'Battery' },
  { pattern: /price|expensive|cost|cheap/i, issue: 'Price' },
  { pattern: /update|software|bug|glitch|laggy|slow|freez/i, issue: 'Software' },
  { pattern: /camera|photo|picture/i, issue: 'Camera' },
  { pattern: /heat|overheat|hot/i, issue: 'Heating' },
  { pattern: /service|support|repair|center/i, issue: 'Service' },
  { pattern: /screen|display|crack/i, issue: 'Display' },
]

const praisePatterns: { pattern: RegExp; praise: string }[] = [
  { pattern: /camera|photo|picture/i, praise: 'Camera' },
  { pattern: /battery/i, praise: 'Battery Life' },
  { pattern: /design|beautiful|look/i, praise: 'Design' },
  { pattern: /screen|display/i, praise: 'Display' },
  { pattern: /performance|fast|speed/i, praise: 'Performance' },
  { pattern: /innovation|innovative/i, praise: 'Innovation' },
]

function formatLiveComments(comments: LiveComment[], withLikes = false): string {
  return comments
    .map(c => {
      const text = `"${c.text.slice(0, 200)}${c.text.length > 200 ? '...' : ''}"`
      const meta = `(@${c.username}, ${c.platform}${c.productModel ? `, ${c.productModel}` : ''}, ${c.sentiment})`
      return withLikes ? `  - [${c.likes} likes] ${text} ${meta}` : `  - ${text} ${meta}`
    })
    .join('\n')
}

function generateSocialContext(payload: CommentsPayload | null): string {
  if (!payload) {
    return '\n=== SOCIAL MEDIA DATA UNAVAILABLE ===\nThe live social media data could not be loaded for this request. Tell the user social media stats are temporarily unavailable rather than guessing.\n'
  }

  const { posts, comments } = payload
  const postById = new Map(posts.map(p => [p.id, p]))

  // Sentiment distribution
  let positive = 0
  let negative = 0
  let neutral = 0
  const issueCount: Record<string, number> = {}
  const praiseCount: Record<string, number> = {}
  const byProduct: Record<string, { total: number; positive: number; negative: number; neutral: number }> = {}
  const byPlatform: Record<string, { posts: number; comments: number; positive: number; negative: number }> = {}
  let latestComment = ''

  for (const p of posts) {
    byPlatform[p.platform] = byPlatform[p.platform] || { posts: 0, comments: 0, positive: 0, negative: 0 }
    byPlatform[p.platform].posts++
  }

  for (const c of comments) {
    if (c.sentiment === 'positive') positive++
    else if (c.sentiment === 'negative') negative++
    else neutral++

    if (c.createdAt && c.createdAt > latestComment) latestComment = c.createdAt

    const plat = (byPlatform[c.platform] = byPlatform[c.platform] || { posts: 0, comments: 0, positive: 0, negative: 0 })
    plat.comments++
    if (c.sentiment === 'positive') plat.positive++
    if (c.sentiment === 'negative') plat.negative++

    // Product attribution: the comment's own classification first, else the
    // parent post's.
    const model = c.productModel || postById.get(c.postId)?.productModel || 'General'
    const prod = (byProduct[model] = byProduct[model] || { total: 0, positive: 0, negative: 0, neutral: 0 })
    prod.total++
    prod[c.sentiment]++

    if (c.sentiment === 'negative') {
      for (const { pattern, issue } of issuePatterns) {
        if (pattern.test(c.text)) issueCount[issue] = (issueCount[issue] || 0) + 1
      }
    } else if (c.sentiment === 'positive') {
      for (const { pattern, praise } of praisePatterns) {
        if (pattern.test(c.text)) praiseCount[praise] = (praiseCount[praise] || 0) + 1
      }
    }
  }

  const total = comments.length
  const pct = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(1) : '0.0')

  const topIssues = Object.entries(issueCount).sort((a, b) => b[1] - a[1]).slice(0, 7)
  const topPraise = Object.entries(praiseCount).sort((a, b) => b[1] - a[1]).slice(0, 7)

  const productSummary = Object.entries(byProduct)
    .filter(([, d]) => d.total >= 5)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 25)
    .map(([model, d]) => {
      const posRate = Math.round((d.positive / d.total) * 100)
      const negRate = Math.round((d.negative / d.total) * 100)
      return `- ${model}: ${d.total} comments, ${posRate}% positive, ${negRate}% negative`
    })
    .join('\n')

  const sortedByLikes = [...comments].sort((a, b) => b.likes - a.likes)
  const topComments = sortedByLikes.slice(0, 15)
  const topPositive = sortedByLikes.filter(c => c.sentiment === 'positive').slice(0, 10)
  const topNegative = sortedByLikes.filter(c => c.sentiment === 'negative').slice(0, 10)

  const totalPostLikes = posts.reduce((s, p) => s + (p.likes || 0), 0)
  const totalPostViews = posts.reduce((s, p) => s + (p.views || 0), 0)

  const platformLines = Object.entries(byPlatform)
    .sort((a, b) => b[1].comments - a[1].comments)
    .map(([platform, d]) => `- ${platform}: ${d.posts} posts, ${d.comments} comments (${d.positive} positive / ${d.negative} negative)`)
    .join('\n')

  return `
=== SOCIAL MEDIA DATA FROM SAMSUNG GULF (@samsunggulf) — LIVE ===

OVERVIEW:
- Total Posts Analyzed: ${posts.length}
- Total Comments Analyzed: ${total} (${payload.meta.analyzedComments} scored by the LLM sentiment pipeline)
- Platforms: Instagram, TikTok, Facebook, X/Twitter
- Most Recent Comment In Data: ${latestComment ? latestComment.slice(0, 10) : 'unknown'}

SENTIMENT DISTRIBUTION (all comments):
- Positive: ${pct(positive)}% (${positive} comments)
- Negative: ${pct(negative)}% (${negative} comments)
- Neutral: ${pct(neutral)}% (${neutral} comments)

ENGAGEMENT ON BRAND POSTS:
- Total Post Likes: ${totalPostLikes.toLocaleString()}
- Total Post Views: ${totalPostViews.toLocaleString()}

PLATFORM BREAKDOWN:
${platformLines}

SENTIMENT BY PRODUCT (top products by comment volume):
${productSummary || 'No product-specific data available'}

TOP ISSUES MENTIONED (in negative comments):
${topIssues.map(([issue, count]) => `- ${issue}: ${count} mentions`).join('\n') || 'No major issues detected'}

TOP PRAISE TOPICS (in positive comments):
${topPraise.map(([praise, count]) => `- ${praise}: ${count} mentions`).join('\n') || 'No specific praise topics detected'}

TOP OVERALL COMMENTS (Most Liked):
${formatLiveComments(topComments, true)}

TOP POSITIVE COMMENTS (Most Liked):
${formatLiveComments(topPositive, true)}

TOP NEGATIVE COMMENTS (Most Liked — Important Issues):
${formatLiveComments(topNegative, true)}

=== END OF SOCIAL MEDIA DATA ===
`
}

// =============================================================================
// GALAXY UNPACKED CAMPAIGN CONTEXT (influencer launch campaign — live data)
// =============================================================================

function formatUnpackedComments(comments: (UnpackedComment & { influencer?: string })[]): string {
  return comments
    .map(c => `  - [${c.likes} likes] "${c.text.slice(0, 180)}${c.text.length > 180 ? '...' : ''}" (@${c.username}${c.influencer ? ` on ${c.influencer}'s video` : ''}, ${c.sentiment})`)
    .join('\n')
}

function generateUnpackedContext(payload: UnpackedPayload | null): string {
  if (!payload) {
    return '\n=== GALAXY UNPACKED CAMPAIGN DATA UNAVAILABLE ===\nTell the user Unpacked campaign stats are temporarily unavailable rather than guessing.\n'
  }

  const { videos, totals, meta } = payload
  const sTotal = totals.sentiment.positive + totals.sentiment.neutral + totals.sentiment.negative
  const sPct = (n: number) => (sTotal > 0 ? ((n / sTotal) * 100).toFixed(1) : '0.0')

  const videoLines = [...videos]
    .sort((a, b) => b.views - a.views)
    .slice(0, 25)
    .map(v => {
      const pos = videoPositivePercent(v)
      return `- ${v.influencer.displayName || v.influencer.username} (@${v.influencer.username}, ${v.platform}): ${v.views.toLocaleString()} views, ${v.likes.toLocaleString()} likes, ${v.commentsCount.toLocaleString()} comments${pos != null ? `, ${pos}% positive` : ''}`
    })
    .join('\n')

  const allComments = videos.flatMap(v =>
    v.comments.map(c => ({ ...c, influencer: v.influencer.displayName || v.influencer.username }))
  )
  const topCampaignComments = allComments.sort((a, b) => b.likes - a.likes).slice(0, 12)
  const topNegativeCampaign = allComments.filter(c => c.sentiment === 'negative').sort((a, b) => b.likes - a.likes).slice(0, 8)

  return `
=== GALAXY UNPACKED LAUNCH CAMPAIGN (influencer videos) — LIVE ===
Campaign tracking window ended: ${meta.campaignEndsAt.slice(0, 10)} (${meta.campaignEnded ? 'campaign has ended — these are final numbers' : 'campaign is still running'})

CAMPAIGN TOTALS:
- Videos Tracked: ${totals.videos} from ${totals.influencers} influencers (Instagram, TikTok, YouTube)
- Total Views: ${totals.views.toLocaleString()}
- Total Likes: ${totals.likes.toLocaleString()}
- Total Comments (platform-reported): ${totals.comments.toLocaleString()}
- Total Shares: ${totals.shares.toLocaleString()}
- Engagement Rate: ${totals.engagementRate != null ? totals.engagementRate + '%' : 'n/a'}
- Comments Scraped & Analyzed: ${totals.scrapedComments.toLocaleString()} scraped, ${totals.analyzedComments.toLocaleString()} analyzed

CAMPAIGN COMMENT SENTIMENT:
- Positive: ${sPct(totals.sentiment.positive)}% (${totals.sentiment.positive})
- Neutral: ${sPct(totals.sentiment.neutral)}% (${totals.sentiment.neutral})
- Negative: ${sPct(totals.sentiment.negative)}% (${totals.sentiment.negative})

TOP CAMPAIGN VIDEOS (by views):
${videoLines}

TOP CAMPAIGN COMMENTS (Most Liked):
${formatUnpackedComments(topCampaignComments)}

TOP NEGATIVE CAMPAIGN COMMENTS:
${formatUnpackedComments(topNegativeCampaign) || '  (none)'}

=== END OF GALAXY UNPACKED CAMPAIGN DATA ===
`
}

// =============================================================================
// FF8 INFLUENCER ROSTER CONTEXT (live data)
// =============================================================================

function generateRosterContext(payload: RosterPayload | null): string {
  if (!payload) {
    return '\n=== FF8 INFLUENCER ROSTER DATA UNAVAILABLE ===\nTell the user FF8 roster stats are temporarily unavailable rather than guessing.\n'
  }

  const { videos, roster, f7Comments } = payload

  // Aggregate per influencer
  const byInfluencer = new Map<string, { name: string; category: string; videos: number; views: number; likes: number; comments: number; positive: number; negative: number; neutral: number }>()
  for (const v of videos) {
    const key = v.rosterId
    const agg = byInfluencer.get(key) || {
      name: v.rosterName,
      category: v.category,
      videos: 0, views: 0, likes: 0, comments: 0, positive: 0, negative: 0, neutral: 0,
    }
    agg.videos++
    agg.views += v.views
    agg.likes += v.likes
    agg.comments += v.commentsCount
    agg.positive += v.sentiment.positive
    agg.negative += v.sentiment.negative
    agg.neutral += v.sentiment.neutral
    byInfluencer.set(key, agg)
  }

  const influencerLines = [...byInfluencer.values()]
    .sort((a, b) => b.views - a.views)
    .map(a => {
      const s = a.positive + a.neutral + a.negative
      const pos = s > 0 ? ` ${Math.round((a.positive / s) * 100)}% positive` : ''
      return `- ${a.name} (${a.category}): ${a.videos} video(s), ${a.views.toLocaleString()} views, ${a.likes.toLocaleString()} likes, ${a.comments.toLocaleString()} comments${pos}`
    })
    .join('\n')

  const totalViews = videos.reduce((s, v) => s + v.views, 0)
  const totalLikes = videos.reduce((s, v) => s + v.likes, 0)
  const totalComments = videos.reduce((s, v) => s + v.commentsCount, 0)

  return `
=== FF8 INFLUENCER ROSTER CAMPAIGN — LIVE ===
The FF8 roster is a marketing-team list of ${roster.length} influencers (Team Galaxy members, Content Creators, Tech Reviewers) whose FF8-related videos are tracked.

ROSTER TOTALS:
- Influencers On Roster: ${roster.length}, with tracked videos from ${byInfluencer.size}
- Videos Tracked: ${videos.length}
- Total Views: ${totalViews.toLocaleString()}
- Total Likes: ${totalLikes.toLocaleString()}
- Total Comments: ${totalComments.toLocaleString()}
- F7 (July 2025) historical comments also tracked for comparison: ${f7Comments.length}

PER-INFLUENCER PERFORMANCE (by views):
${influencerLines || 'No tracked videos yet'}

=== END OF FF8 ROSTER DATA ===
`
}

// =============================================================================
// S.COM REVIEWS CONTEXT (Samsung.com product reviews — static export)
// =============================================================================

function generateScomReviewsContext() {
  const allReviews = getAnalyzedReviews()
  const metrics = calculateSentimentMetrics(allReviews)
  const themes = analyzeThemes(allReviews)
  const productLines = getProductLines(allReviews)

  // S26 vs S25 comparison
  const s26Reviews = allReviews.filter(r => r.productLine.includes("S26"))
  const s25Reviews = allReviews.filter(r => r.productLine.includes("S25"))
  const s26Metrics = calculateSentimentMetrics(s26Reviews)
  const s25Metrics = calculateSentimentMetrics(s25Reviews)

  // By product line metrics
  const productMetrics = productLines.map(line => {
    const lineReviews = allReviews.filter(r => r.productLine === line)
    const lineMetrics = calculateSentimentMetrics(lineReviews)
    return {
      product: line,
      total: lineMetrics.total,
      positivePercent: lineMetrics.positivePercent.toFixed(1),
      negativePercent: lineMetrics.negativePercent.toFixed(1),
      avgRating: lineMetrics.averageRating.toFixed(2),
      brandHealth: lineMetrics.brandHealthScore
    }
  }).sort((a, b) => b.total - a.total)

  // Month over month comparison (S26 2026 vs S25 2025 for same months)
  const monthComparisons = getMonthVsLastYearComparison(allReviews)

  // Quarter comparisons
  const quarterComparisons = getQuarterVsLastYearComparison(allReviews)

  // Top positive and negative reviews
  const topPositive = getTopReviews(allReviews, "positive", 10)
  const topNegative = getTopReviews(allReviews, "negative", 10)

  // Format reviews for context
  const formatReviews = (reviews: AnalyzedReview[]) =>
    reviews.map(r =>
      `  - [${r["Overall Rating"]} stars] "${r["Review Title"]}" - "${r["Review Text"].slice(0, 200)}${r["Review Text"].length > 200 ? '...' : ''}" (${r.productLine}, ${r["Reviewer Nickname"] || 'Anonymous'}, ${r.themes.join(', ')})`
    ).join('\n')

  return `
=== SAMSUNG.COM PRODUCT REVIEWS DATA ===

OVERVIEW:
- Total Reviews Analyzed: ${metrics.total}
- Average Rating: ${metrics.averageRating.toFixed(2)} / 5.0
- Brand Health Score: ${metrics.brandHealthScore}/100
- Products Covered: ${productLines.join(', ')}

OVERALL SENTIMENT DISTRIBUTION:
- Positive: ${metrics.positivePercent.toFixed(1)}% (${metrics.positive} reviews)
- Neutral: ${metrics.neutralPercent.toFixed(1)}% (${metrics.neutral} reviews)
- Negative: ${metrics.negativePercent.toFixed(1)}% (${metrics.negative} reviews)

=== S26 vs S25 YEAR-OVER-YEAR COMPARISON ===

S26 Series (2026):
- Total Reviews: ${s26Metrics.total}
- Positive: ${s26Metrics.positivePercent.toFixed(1)}%
- Negative: ${s26Metrics.negativePercent.toFixed(1)}%
- Average Rating: ${s26Metrics.averageRating.toFixed(2)}
- Brand Health: ${s26Metrics.brandHealthScore}

S25 Series (2025):
- Total Reviews: ${s25Metrics.total}
- Positive: ${s25Metrics.positivePercent.toFixed(1)}%
- Negative: ${s25Metrics.negativePercent.toFixed(1)}%
- Average Rating: ${s25Metrics.averageRating.toFixed(2)}
- Brand Health: ${s25Metrics.brandHealthScore}

YoY Change:
- Positive Sentiment: ${(s26Metrics.positivePercent - s25Metrics.positivePercent).toFixed(1)}pp
- Negative Sentiment: ${(s26Metrics.negativePercent - s25Metrics.negativePercent).toFixed(1)}pp
- Brand Health: ${s26Metrics.brandHealthScore - s25Metrics.brandHealthScore} points

=== SENTIMENT BY PRODUCT LINE ===
${productMetrics.map(p =>
  `- ${p.product}: ${p.total} reviews, ${p.positivePercent}% positive, ${p.negativePercent}% negative, ${p.avgRating} avg rating, Brand Health: ${p.brandHealth}`
).join('\n')}

=== MONTH-OVER-MONTH COMPARISON (S26 2026 vs S25 2025) ===
${monthComparisons.map(m =>
  `- ${m.monthName}: S26 (${m.s26.total} reviews, ${m.s26.positivePercent.toFixed(1)}% positive) vs S25 (${m.s25.total} reviews, ${m.s25.positivePercent.toFixed(1)}% positive) | Change: ${m.change.positive > 0 ? '+' : ''}${m.change.positive.toFixed(1)}pp positive`
).join('\n') || 'No month-over-month data available yet'}

=== QUARTER-OVER-QUARTER COMPARISON (S26 vs S25) ===
${quarterComparisons.map(q =>
  `- ${q.quarterName}: S26 (${q.s26.total} reviews, ${q.s26.positivePercent.toFixed(1)}% positive, Health: ${q.s26.brandHealthScore}) vs S25 (${q.s25.total} reviews, ${q.s25.positivePercent.toFixed(1)}% positive, Health: ${q.s25.brandHealthScore}) | Change: ${q.change.brandHealth > 0 ? '+' : ''}${q.change.brandHealth} health points`
).join('\n') || 'No quarterly data available yet'}

=== TOP THEMES IN REVIEWS ===
${themes.slice(0, 10).map(t =>
  `- ${t.theme}: ${t.count} mentions (${t.positive} positive, ${t.neutral} neutral, ${t.negative} negative) - Overall: ${t.sentiment}`
).join('\n')}

=== TOP POSITIVE REVIEWS (Detailed Feedback) ===
${formatReviews(topPositive)}

=== TOP NEGATIVE REVIEWS (Areas for Improvement) ===
${formatReviews(topNegative)}

=== END OF S.COM REVIEWS DATA ===
`
}

// =============================================================================
// CONTEXT ASSEMBLY — cached so consecutive chat messages don't refetch the
// full dashboard payloads (data only changes on scheduled syncs anyway).
// =============================================================================

const CONTEXT_TTL_MS = 5 * 60 * 1000
// Leave headroom under maxDuration for the LLM stream itself; past this
// budget we answer with a degraded context instead of letting Vercel 504.
const CONTEXT_BUDGET_MS = 240 * 1000

let contextCache: { context: string; builtAt: number } | null = null
// Concurrent chats share one build — a cold /api/comments rebuild takes ~90s
// and every extra caller would start another one.
let inflightBuild: Promise<string> | null = null

async function runBuild(origin: string): Promise<string> {
  const [commentsPayload, unpackedPayload, rosterPayload] = await Promise.all([
    fetchJson<CommentsPayload>(origin, '/api/comments'),
    fetchJson<UnpackedPayload>(origin, '/api/unpacked'),
    fetchJson<RosterPayload>(origin, '/api/roster'),
  ])

  const context =
    `\nDATA SNAPSHOT GENERATED: ${new Date().toISOString()}\n` +
    generateSocialContext(commentsPayload) +
    generateUnpackedContext(unpackedPayload) +
    generateRosterContext(rosterPayload) +
    generateScomReviewsContext()

  // Only cache complete builds — a failed fetch should be retried on the next
  // message, not remembered for 5 minutes.
  if (commentsPayload && unpackedPayload && rosterPayload) {
    contextCache = { context, builtAt: Date.now() }
  }
  return context
}

async function buildDataContext(origin: string): Promise<string> {
  if (contextCache && Date.now() - contextCache.builtAt < CONTEXT_TTL_MS) {
    return contextCache.context
  }

  if (!inflightBuild) {
    inflightBuild = runBuild(origin).finally(() => {
      inflightBuild = null
    })
  }

  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), CONTEXT_BUDGET_MS))
  const built = await Promise.race([inflightBuild, timeout])
  if (built) return built

  // Over budget: answer from whatever we have (stale cache beats nothing,
  // then S.com reviews alone). The in-flight build keeps running and will
  // serve the next message.
  if (contextCache) return contextCache.context
  return (
    `\nDATA SNAPSHOT GENERATED: ${new Date().toISOString()}\n` +
    generateSocialContext(null) +
    generateUnpackedContext(null) +
    generateRosterContext(null) +
    generateScomReviewsContext()
  )
}

const BASE_SYSTEM_PROMPT = `You are Samsung Gulf's AI Customer Sentiment Intelligence Assistant, specialized in analyzing customer sentiment for Samsung products in the GCC markets.

You have access to FOUR live data sources (refreshed from the dashboard's database on every conversation):
1. SOCIAL MEDIA DATA: Scraped comments from Samsung Gulf's official accounts (@samsunggulf) on Instagram, TikTok, Facebook, and X/Twitter, with LLM-scored sentiment
2. GALAXY UNPACKED CAMPAIGN: Influencer launch-campaign videos (Instagram, TikTok, YouTube) with views, engagement, and comment sentiment
3. FF8 INFLUENCER ROSTER: The marketing team's tracked influencer roster (Team Galaxy / Content Creators / Tech Reviewers) and their FF8 video performance
4. SAMSUNG.COM REVIEWS: Official product reviews from Samsung.com with detailed ratings and feedback

IMPORTANT INSTRUCTIONS:
1. Base ALL your responses on the actual data provided below
2. When asked about sentiment, use the exact percentages from the data
3. When discussing reviews or comments, quote actual examples from the data
4. When discussing products, reference the actual sentiment breakdown by product
5. Be honest if data for a specific query is not available or marked unavailable
6. Never make up statistics - only use what's in the data
7. For S.com reviews questions, use the SAMSUNG.COM PRODUCT REVIEWS section
8. For brand social media questions, use the SOCIAL MEDIA DATA section
9. For Galaxy Unpacked / launch campaign questions, use the GALAXY UNPACKED section
10. For influencer questions, use the FF8 ROSTER and GALAXY UNPACKED sections
11. For S26 vs S25 comparisons, use the Year-over-Year, Month-over-Month, or Quarter-over-Quarter comparison data
12. For theme/topic analysis, reference the TOP THEMES / TOP ISSUES / TOP PRAISE sections

When responding:
- Use specific numbers and percentages from the data
- Quote actual user reviews/comments to support your analysis
- Be transparent about which data source you are using
- Provide actionable insights based on the real sentiment data
- Format responses with clear headers, bullet points, and structured data

Key product lines in the data:
- Galaxy S26 Ultra, S26+, S26 (2026)
- Galaxy S25 Ultra, S25+, S25 (2025)
- Galaxy Z Fold, Z Flip
- Galaxy A Series
- Galaxy Watch, Galaxy Buds, Galaxy Ring, Galaxy Tab
- TVs (Neo QLED, The Frame), Bespoke home appliances

SOURCE CITATIONS (REQUIRED):
At the end of EVERY response, include:
**Data Sources:**
- List only the sources you actually used (Social Media @samsunggulf / Galaxy Unpacked campaign / FF8 roster / Samsung.com reviews)
- Date: use the DATA SNAPSHOT GENERATED timestamp below

`

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  // Live data context, rebuilt from the dashboard APIs (edge-cached) at most
  // every few minutes.
  const origin = new URL(req.url).origin
  const dataContext = await buildDataContext(origin)
  const systemPrompt = BASE_SYSTEM_PROMPT + dataContext

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
