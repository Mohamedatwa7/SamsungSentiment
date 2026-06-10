import { getProcessedDashboardData, type Platform } from "./social-data"
import { getCommentMetrics, getCommentsByProduct, type CommentPlatform } from "./comments-data"
import { getAnalyzedReviews, getProductLines, type AnalyzedReview } from "./reviews-data"

// Helper to convert platform filter
function getCommentFilter(platformFilter?: Platform[]): CommentPlatform[] | undefined {
  return platformFilter?.filter(
    (p): p is CommentPlatform => p === "instagram" || p === "tiktok" || p === "facebook"
  )
}

// CSV helper: escape values for CSV format
function escapeCSV(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return ""
  const str = String(value)
  // If contains comma, newline, or quote, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Convert 2D array to CSV string
function arrayToCSV(data: (string | number | boolean | undefined | null)[][]): string {
  return data.map(row => row.map(escapeCSV).join(",")).join("\n")
}

// Download helper
function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

// Export Dashboard Analytics Data
export function exportDashboardToExcel(
  platformFilter?: Platform[], 
  exportType: "full" | "kpis" | "sentiment" | "platform" | "comments" = "full"
) {
  const commentPlatformFilter = getCommentFilter(platformFilter)
  
  // Get data
  const dashboardData = getProcessedDashboardData(platformFilter)
  const commentMetrics = getCommentMetrics(commentPlatformFilter)
  const commentsByProduct = getCommentsByProduct(commentPlatformFilter)
  
  // Determine which sections to include based on export type
  const includeKPIs = exportType === "full" || exportType === "kpis"
  const includeSentiment = exportType === "full" || exportType === "sentiment"
  const includePlatform = exportType === "full" || exportType === "platform"
  const includeComments = exportType === "full" || exportType === "comments"
  
  const sections: string[] = []
  
  // 1. KPI Summary Section
  if (includeKPIs) {
    const kpiData = [
      ["=== KPI SUMMARY ===", ""],
      ["Metric", "Value"],
      ["Total Posts", dashboardData.kpiMetrics.totalPosts],
      ["Total Likes", dashboardData.kpiMetrics.totalLikes],
      ["Total Comments", dashboardData.kpiMetrics.totalComments],
      ["Total Shares", dashboardData.kpiMetrics.totalShares],
      ["Total Views", dashboardData.kpiMetrics.totalViews],
      ["Total Engagement", dashboardData.kpiMetrics.totalEngagement],
      ["Avg Likes Per Post", dashboardData.kpiMetrics.avgLikesPerPost],
      ["", ""],
      ["Comments Analyzed", commentMetrics.totalComments],
      ["Positive Comments", commentMetrics.positiveCount],
      ["Neutral Comments", commentMetrics.neutralCount],
      ["Negative Comments", commentMetrics.negativeCount],
      ["Positive %", `${commentMetrics.positivePercentage}%`],
      ["Neutral %", `${commentMetrics.neutralPercentage}%`],
      ["Negative %", `${commentMetrics.negativePercentage}%`],
    ]
    sections.push(arrayToCSV(kpiData))
  }
  
  // 2. Platform Metrics Section
  if (includePlatform) {
    const platformData = [
      ["", ""],
      ["=== PLATFORM METRICS ===", ""],
      ["Platform", "Posts", "Likes", "Comments", "Shares", "Views", "Engagement Rate"],
      ...dashboardData.platformMetrics.map(p => [
        p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
        p.totalPosts,
        p.totalLikes,
        p.totalComments,
        p.totalShares,
        p.totalViews,
        `${Math.round((p.totalLikes + p.totalComments + p.totalShares) / Math.max(p.totalPosts, 1))} avg`
      ])
    ]
    sections.push(arrayToCSV(platformData))
  }
  
  // 3. Product Engagement Section
  if (includePlatform) {
    const productData = [
      ["", ""],
      ["=== PRODUCT ENGAGEMENT ===", ""],
      ["Product", "Posts", "Total Likes", "Total Comments", "Total Shares"],
      ...dashboardData.productMetrics.map(p => [
        p.product,
        p.posts,
        p.likes,
        p.comments,
        p.shares
      ])
    ]
    sections.push(arrayToCSV(productData))
  }
  
  // 4. Sentiment by Product Section
  if (includeSentiment) {
    const sentimentData = [
      ["", ""],
      ["=== SENTIMENT BY PRODUCT ===", ""],
      ["Product", "Total Comments", "Positive", "Neutral", "Negative", "Positive %"],
      ...Object.entries(commentsByProduct).map(([product, data]) => {
        const total = data.positive + data.neutral + data.negative
        const positiveRate = total > 0 ? Math.round((data.positive / total) * 100) : 0
        return [product, total, data.positive, data.neutral, data.negative, `${positiveRate}%`]
      })
    ]
    sections.push(arrayToCSV(sentimentData))
  }
  
  // 5. Top Issues Section
  if (includeComments && commentMetrics.topIssues.length > 0) {
    const issuesData = [
      ["", ""],
      ["=== TOP ISSUES ===", ""],
      ["Issue", "Count"],
      ...commentMetrics.topIssues.map(i => [i.issue, i.count])
    ]
    sections.push(arrayToCSV(issuesData))
  }
  
  // 6. Top Posts Section
  if (includePlatform) {
    const postsData = [
      ["", ""],
      ["=== TOP POSTS ===", ""],
      ["Platform", "Date", "Likes", "Comments", "Shares", "Product", "Caption"],
      ...dashboardData.topPosts.map(p => [
        p.platform,
        new Date(p.timestamp).toLocaleDateString(),
        p.likes,
        p.comments,
        p.shares,
        p.product,
        (p.caption || "").slice(0, 200)
      ])
    ]
    sections.push(arrayToCSV(postsData))
  }
  
  // Combine all sections and download
  const csvContent = sections.join("\n")
  const fileName = `Dashboard_Analytics_${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(csvContent, fileName)
}

// Export S.com Reviews Data
export function exportReviewsToExcel(
  reviews: AnalyzedReview[], 
  selectedProducts?: string[],
  exportType: "full" | "summary" | "products" | "trends" = "full"
) {
  // Determine which sections to include
  const includeSummary = exportType === "full" || exportType === "summary"
  const includeProducts = exportType === "full" || exportType === "products"
  const includeTrends = exportType === "full" || exportType === "trends"
  const includeAllReviews = exportType === "full"
  
  // Filter reviews if products selected
  const filteredReviews = selectedProducts && selectedProducts.length > 0
    ? reviews.filter(r => selectedProducts.includes(r.productLine))
    : reviews
  
  const sections: string[] = []
  
  // 1. Summary Section
  if (includeSummary) {
    const totalReviews = filteredReviews.length
    const avgRating = filteredReviews.length > 0 
      ? (filteredReviews.reduce((sum, r) => sum + r.ratingNum, 0) / filteredReviews.length).toFixed(2)
      : "0"
    const positiveReviews = filteredReviews.filter(r => r.sentiment === "positive").length
    const negativeReviews = filteredReviews.filter(r => r.sentiment === "negative").length
    const neutralReviews = filteredReviews.filter(r => r.sentiment === "neutral").length
    
    const summaryData = [
      ["=== S.COM REVIEWS SUMMARY ===", ""],
      ["", ""],
      ["Total Reviews", totalReviews],
      ["Average Rating", avgRating],
      ["", ""],
      ["Positive Reviews", positiveReviews],
      ["Neutral Reviews", neutralReviews],
      ["Negative Reviews", negativeReviews],
      ["Positive %", `${totalReviews > 0 ? Math.round((positiveReviews / totalReviews) * 100) : 0}%`],
      ["Negative %", `${totalReviews > 0 ? Math.round((negativeReviews / totalReviews) * 100) : 0}%`],
    ]
    sections.push(arrayToCSV(summaryData))
  }
  
  const totalReviewsAll = filteredReviews.length
  
  // 2. Reviews by Product Section
  if (includeProducts) {
    const productLines = getProductLines(filteredReviews)
    const productData = [
      ["", ""],
      ["=== REVIEWS BY PRODUCT ===", ""],
      ["Product", "Total Reviews", "Avg Rating", "Positive", "Neutral", "Negative", "Positive %"],
      ...productLines.map(product => {
        const productReviews = filteredReviews.filter(r => r.productLine === product)
        const total = productReviews.length
        const avg = total > 0 ? (productReviews.reduce((sum, r) => sum + r.ratingNum, 0) / total).toFixed(2) : "N/A"
        const pos = productReviews.filter(r => r.sentiment === "positive").length
        const neu = productReviews.filter(r => r.sentiment === "neutral").length
        const neg = productReviews.filter(r => r.sentiment === "negative").length
        const posRate = total > 0 ? `${Math.round((pos / total) * 100)}%` : "N/A"
        return [product, total, avg, pos, neu, neg, posRate]
      }).filter(row => row[1] > 0)
    ]
    sections.push(arrayToCSV(productData))
  }
  
  // 3. Rating Distribution Section
  if (includeProducts) {
    const ratingData = [
      ["", ""],
      ["=== RATING DISTRIBUTION ===", ""],
      ["Rating", "Count", "Percentage"],
      ...[1, 2, 3, 4, 5].map(rating => {
        const count = filteredReviews.filter(r => r.ratingNum === rating).length
        return [rating, count, `${totalReviewsAll > 0 ? Math.round((count / totalReviewsAll) * 100) : 0}%`]
      })
    ]
    sections.push(arrayToCSV(ratingData))
  }
  
  // 4. Monthly Trend Section
  if (includeTrends) {
    const monthlyData = new Map<string, { count: number; positive: number; negative: number; totalRating: number }>()
    filteredReviews.forEach(r => {
      const dateStr = r.reviewDate || ""
      const month = dateStr.slice(0, 7) // YYYY-MM or similar
      if (!month || !monthlyData.has(month)) {
        if (month) monthlyData.set(month, { count: 0, positive: 0, negative: 0, totalRating: 0 })
        else return
      }
      const data = monthlyData.get(month)!
      data.count++
      data.totalRating += r.ratingNum
      if (r.sentiment === "positive") data.positive++
      if (r.sentiment === "negative") data.negative++
    })
    
    const trendData = [
      ["", ""],
      ["=== MONTHLY TREND ===", ""],
      ["Month", "Reviews", "Avg Rating", "Positive", "Negative", "Positive %"],
      ...Array.from(monthlyData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => [
          month,
          data.count,
          (data.totalRating / data.count).toFixed(2),
          data.positive,
          data.negative,
          `${Math.round((data.positive / data.count) * 100)}%`
        ])
    ]
    sections.push(arrayToCSV(trendData))
  }
  
  // 5. All Reviews Section (detailed)
  if (includeAllReviews) {
    const reviewData = [
      ["", ""],
      ["=== ALL REVIEWS ===", ""],
      ["Date", "Product", "Rating", "Sentiment", "Title", "Review Text", "Author", "Verified"],
      ...filteredReviews
        .sort((a, b) => new Date(b.parsedDate).getTime() - new Date(a.parsedDate).getTime())
        .slice(0, 1000) // Limit to 1000 for performance
        .map(r => [
          r.reviewDate,
          r.productLine,
          r.ratingNum,
          r.sentiment,
          r.title,
          r.text.slice(0, 500),
          r.reviewer,
          "N/A"
        ])
    ]
    sections.push(arrayToCSV(reviewData))
  }
  
  // Combine all sections and download
  const csvContent = sections.join("\n")
  const fileName = `Scom_Reviews_${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(csvContent, fileName)
}
