import { consumeStream, convertToModelMessages, streamText, type UIMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { getProcessedDashboardData } from '@/lib/social-data'
import { getComments, getCommentMetrics, getCommentsByProduct, getTopComments, getTopPositiveReviews, getTopNegativeReviews } from '@/lib/comments-data'
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

export const maxDuration = 30

// Generate S.com reviews data context
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

// Generate data context from actual dashboard data
function generateDataContext() {
  const dashboardData = getProcessedDashboardData()
  const comments = getComments()
  const metrics = getCommentMetrics()
  const productSentiment = getCommentsByProduct()

  // Get top comments by likes
  const topComments = getTopComments(15)
  const topPositiveReviews = getTopPositiveReviews(10)
  const topNegativeReviews = getTopNegativeReviews(10)
  
  // Get top comments for specific products
  const topS26Comments = getTopComments(10)
  const topS25Comments = getTopComments(10)

  // Get sample comments for each sentiment
  const positiveComments = comments.filter(c => c.sentiment === 'positive').slice(0, 10)
  const negativeComments = comments.filter(c => c.sentiment === 'negative').slice(0, 10)
  const neutralComments = comments.filter(c => c.sentiment === 'neutral').slice(0, 5)

  // Platform breakdown
  const instagramComments = comments.filter(c => c.platform === 'instagram')
  const tiktokComments = comments.filter(c => c.platform === 'tiktok')

  // Format product sentiment data
  const productSentimentSummary = Object.entries(productSentiment)
    .map(([product, data]) => {
      const total = data.positive + data.negative + data.neutral
      if (total === 0) return null
      const positiveRate = Math.round((data.positive / total) * 100)
      const negativeRate = Math.round((data.negative / total) * 100)
      return `- ${product}: ${total} mentions, ${positiveRate}% positive, ${negativeRate}% negative`
    })
    .filter(Boolean)
    .join('\n')

  // Format sample comments
  const formatComments = (commentsList: typeof comments) =>
    commentsList
      .map(c => `  - "${c.text.slice(0, 150)}${c.text.length > 150 ? '...' : ''}" (@${c.username}, ${c.platform})`)
      .join('\n')

  // Format comments with likes count
  const formatCommentsWithLikes = (commentsList: typeof comments) =>
    commentsList
      .map(c => `  - [${c.likes} likes] "${c.text.slice(0, 200)}${c.text.length > 200 ? '...' : ''}" (@${c.username}, ${c.platform}, ${c.product}, ${c.sentiment})`)
      .join('\n')

  return `
=== SOCIAL MEDIA DATA FROM SAMSUNG GULF (@samsunggulf) ===

OVERVIEW (as of ${new Date().toLocaleDateString()}):
- Total Posts Analyzed: ${dashboardData.kpiMetrics.totalPosts}
- Total Comments Analyzed: ${metrics.totalComments}
- Platforms: Instagram (${instagramComments.length} comments), TikTok (${tiktokComments.length} comments)

SENTIMENT DISTRIBUTION:
- Positive: ${metrics.positivePercentage}% (${metrics.positiveCount} comments)
- Negative: ${metrics.negativePercentage}% (${metrics.negativeCount} comments)
- Neutral: ${metrics.neutralPercentage}% (${metrics.neutralCount} comments)

ENGAGEMENT METRICS:
- Total Likes: ${dashboardData.kpiMetrics.totalLikes.toLocaleString()}
- Total Comments: ${dashboardData.kpiMetrics.totalComments.toLocaleString()}
- Total Shares: ${dashboardData.kpiMetrics.totalShares.toLocaleString()}

PLATFORM PERFORMANCE:
${dashboardData.platformMetrics.map(p => `- ${p.platform}: ${p.totalPosts} posts, ${p.totalLikes.toLocaleString()} likes, ${p.totalComments.toLocaleString()} comments`).join('\n')}

SENTIMENT BY PRODUCT:
${productSentimentSummary || 'No product-specific data available'}

TOP ISSUES MENTIONED:
${metrics.topIssues.map(i => `- ${i.issue}: ${i.count} mentions`).join('\n') || 'No major issues detected'}

TOP PRAISE TOPICS:
${metrics.topPraise.map(p => `- ${p.praise}: ${p.count} mentions`).join('\n') || 'No specific praise topics detected'}

SAMPLE POSITIVE COMMENTS:
${formatComments(positiveComments)}

SAMPLE NEGATIVE COMMENTS:
${formatComments(negativeComments)}

SAMPLE NEUTRAL COMMENTS:
${formatComments(neutralComments)}

=== TOP COMMENTS BY ENGAGEMENT (LIKES) ===

TOP OVERALL COMMENTS (Most Liked):
${formatCommentsWithLikes(topComments)}

TOP POSITIVE REVIEWS (Most Liked Positive Comments):
${formatCommentsWithLikes(topPositiveReviews)}

TOP NEGATIVE REVIEWS (Most Liked Negative Comments - Important Issues):
${formatCommentsWithLikes(topNegativeReviews)}

=== END OF SOCIAL MEDIA DATA ===
`
}

const BASE_SYSTEM_PROMPT = `You are Samsung Gulf's AI Customer Sentiment Intelligence Assistant, specialized in analyzing customer sentiment for Samsung products.

You have access to TWO data sources:
1. SOCIAL MEDIA DATA: Real scraped comments from Samsung Gulf's Instagram and TikTok (@samsunggulf)
2. SAMSUNG.COM REVIEWS: Official product reviews from Samsung.com with detailed ratings and feedback

IMPORTANT INSTRUCTIONS:
1. Base ALL your responses on the actual data provided below
2. When asked about sentiment, use the exact percentages from the data
3. When discussing reviews or comments, quote actual examples from the data
4. When discussing products, reference the actual sentiment breakdown by product
5. Be honest if data for a specific query is not available
6. Never make up statistics - only use what's in the data
7. For S.com reviews questions, use the SAMSUNG.COM PRODUCT REVIEWS section
8. For social media questions, use the SOCIAL MEDIA DATA section
9. For S26 vs S25 comparisons, use the Year-over-Year, Month-over-Month, or Quarter-over-Quarter comparison data
10. For theme/topic analysis, reference the TOP THEMES section

When responding:
- Use specific numbers and percentages from the data
- Quote actual user reviews/comments to support your analysis
- Be transparent about the data source (Social Media vs S.com Reviews)
- Provide actionable insights based on the real sentiment data
- Format responses with clear headers, bullet points, and structured data

Key product lines in the data:
- Galaxy S26 Ultra, S26+, S26 (2026)
- Galaxy S25 Ultra, S25+, S25 (2025)
- Galaxy Z Fold 6, Z Flip 6
- Galaxy A Series
- Galaxy Watch, Galaxy Buds, Galaxy Tab

SOURCE CITATIONS (REQUIRED):
At the end of EVERY response, include:
**Data Sources:**
- Social Media: Instagram, TikTok (@samsunggulf)
- Product Reviews: Samsung.com official reviews
- Date: Current data snapshot

`

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  // Generate fresh data context for each request
  const socialDataContext = generateDataContext()
  const scomReviewsContext = generateScomReviewsContext()
  const systemPrompt = BASE_SYSTEM_PROMPT + socialDataContext + scomReviewsContext

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
