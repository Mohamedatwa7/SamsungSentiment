// Marketplace Reviews Data (Amazon, Noon)
// Mock data structure following similar patterns to social reviews

import { type DateRange, isWithinDateRange } from "@/components/dashboard/date-filter"

export type Marketplace = "amazon" | "noon"
export type Sentiment = "positive" | "negative" | "neutral"

export interface MarketplaceReview {
  id: string
  marketplace: Marketplace
  productName: string
  productLine: string // S26 Ultra, S26+, S26, etc.
  rating: 1 | 2 | 3 | 4 | 5
  title: string
  text: string
  sentiment: Sentiment
  verifiedPurchase: boolean
  helpfulVotes: number
  date: string
  reviewerName: string
  features: string[] // Features mentioned in review
  competitorMentions: string[] // Competitors mentioned (iPhone, Pixel, etc.)
  priceValueMention: boolean // Does the review mention price/value
}

// Generate mock marketplace reviews
function generateMockReviews(): MarketplaceReview[] {
  const products = [
    { name: "Samsung Galaxy S26 Ultra 512GB", line: "S26 Ultra" },
    { name: "Samsung Galaxy S26 Ultra 256GB", line: "S26 Ultra" },
    { name: "Samsung Galaxy S26+ 256GB", line: "S26+" },
    { name: "Samsung Galaxy S26 128GB", line: "S26" },
    { name: "Samsung Galaxy S26 256GB", line: "S26" },
  ]
  
  const features = ["camera", "battery", "display", "performance", "design", "AI features", "S Pen", "zoom", "night mode", "charging"]
  const competitors = ["iPhone", "Pixel", "OnePlus", "Xiaomi", "Huawei"]
  
  const positiveReviews = [
    { title: "Best phone I've ever owned!", text: "The camera quality is absolutely stunning. The 200MP sensor captures incredible detail. Battery lasts all day even with heavy use." },
    { title: "Amazing camera system", text: "The zoom capabilities are unmatched. I can take photos of the moon! The AI features are also very helpful for photo editing." },
    { title: "Worth every dirham", text: "Upgraded from the S24 and the difference is noticeable. The display is gorgeous and performance is blazing fast." },
    { title: "Premium build quality", text: "Feels premium in hand. The titanium frame is a nice touch. Display brightness is excellent outdoors." },
    { title: "AI features are game-changing", text: "Galaxy AI is incredible. Circle to Search, Live Translate, and Photo Assist make this phone truly smart." },
    { title: "Great for productivity", text: "The S Pen integration is seamless. Perfect for taking notes and signing documents on the go." },
    { title: "Excellent battery life", text: "Coming from iPhone, I'm impressed. Easily gets me through a full day with 30% left. Fast charging is a plus." },
    { title: "Beautiful display", text: "The AMOLED screen is stunning. Colors are vibrant and the 120Hz refresh rate makes everything smooth." },
  ]
  
  const negativeReviews = [
    { title: "Overheating issues", text: "Phone gets very hot during gaming or camera use. Had to stop recording video because it overheated." },
    { title: "Battery drains too fast", text: "Expected better battery life at this price point. Barely lasting half a day with normal use." },
    { title: "Too expensive", text: "The phone is good but not worth the premium price. Similar features available for much less from competitors." },
    { title: "Software bugs", text: "Experiencing random crashes and app freezes. One UI needs optimization. Expected better from Samsung." },
    { title: "Camera app is slow", text: "The camera takes too long to process photos. Missed several moments because of the shutter lag." },
    { title: "Disappointed with zoom quality", text: "100x zoom is just a gimmick. Photos at high zoom are blurry and unusable. Marketing is misleading." },
  ]
  
  const neutralReviews = [
    { title: "Good phone, nothing special", text: "It's a solid phone but doesn't feel like a big upgrade from last year. Camera is good, battery is okay." },
    { title: "Decent for the price", text: "Does what it's supposed to do. Nothing extraordinary but no major complaints either." },
    { title: "Average experience", text: "Some features are great, others need work. The AI features are hit or miss. Camera is good in daylight." },
  ]
  
  const reviews: MarketplaceReview[] = []
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 90) // 90 days of data
  
  // Generate 500 reviews
  for (let i = 0; i < 500; i++) {
    const marketplace: Marketplace = Math.random() > 0.4 ? "amazon" : "noon"
    const product = products[Math.floor(Math.random() * products.length)]
    
    // Weighted sentiment distribution: 55% positive, 25% negative, 20% neutral
    const sentimentRoll = Math.random()
    let sentiment: Sentiment
    let rating: 1 | 2 | 3 | 4 | 5
    let reviewData: { title: string; text: string }
    
    if (sentimentRoll < 0.55) {
      sentiment = "positive"
      rating = Math.random() > 0.3 ? 5 : 4
      reviewData = positiveReviews[Math.floor(Math.random() * positiveReviews.length)]
    } else if (sentimentRoll < 0.80) {
      sentiment = "negative"
      rating = Math.random() > 0.5 ? 2 : 1
      reviewData = negativeReviews[Math.floor(Math.random() * negativeReviews.length)]
    } else {
      sentiment = "neutral"
      rating = 3
      reviewData = neutralReviews[Math.floor(Math.random() * neutralReviews.length)]
    }
    
    // Random date within range
    const reviewDate = new Date(startDate)
    reviewDate.setDate(reviewDate.getDate() + Math.floor(Math.random() * 90))
    
    // Random features mentioned (1-3)
    const numFeatures = Math.floor(Math.random() * 3) + 1
    const reviewFeatures: string[] = []
    for (let j = 0; j < numFeatures; j++) {
      const feature = features[Math.floor(Math.random() * features.length)]
      if (!reviewFeatures.includes(feature)) reviewFeatures.push(feature)
    }
    
    // Competitor mentions (20% chance)
    const competitorMentions: string[] = []
    if (Math.random() < 0.2) {
      competitorMentions.push(competitors[Math.floor(Math.random() * competitors.length)])
    }
    
    reviews.push({
      id: `mp-${i}`,
      marketplace,
      productName: product.name,
      productLine: product.line,
      rating,
      title: reviewData.title,
      text: reviewData.text,
      sentiment,
      verifiedPurchase: Math.random() > 0.15, // 85% verified
      helpfulVotes: Math.floor(Math.random() * 50),
      date: reviewDate.toISOString(),
      reviewerName: `User${Math.floor(Math.random() * 10000)}`,
      features: reviewFeatures,
      competitorMentions,
      priceValueMention: Math.random() < 0.3, // 30% mention price
    })
  }
  
  return reviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

const allReviews = generateMockReviews()

// Get all reviews with optional filters
export function getMarketplaceReviews(
  marketplaceFilter?: Marketplace[],
  dateRange?: DateRange
): MarketplaceReview[] {
  let reviews = allReviews
  
  if (marketplaceFilter && marketplaceFilter.length > 0) {
    reviews = reviews.filter(r => marketplaceFilter.includes(r.marketplace))
  }
  
  if (dateRange) {
    reviews = reviews.filter(r => isWithinDateRange(r.date, dateRange))
  }
  
  return reviews
}

// KPI Metrics
export interface MarketplaceKPIs {
  totalReviews: number
  averageRating: number
  verifiedPurchaseRate: number
  positivePercentage: number
  negativePercentage: number
  neutralPercentage: number
  reviewsThisWeek: number
  reviewsLastWeek: number
  weekOverWeekChange: number
}

export function getMarketplaceKPIs(
  marketplaceFilter?: Marketplace[],
  dateRange?: DateRange
): MarketplaceKPIs {
  const reviews = getMarketplaceReviews(marketplaceFilter, dateRange)
  
  const totalReviews = reviews.length
  const averageRating = totalReviews > 0 
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
    : 0
  
  const verifiedCount = reviews.filter(r => r.verifiedPurchase).length
  const positiveCount = reviews.filter(r => r.sentiment === "positive").length
  const negativeCount = reviews.filter(r => r.sentiment === "negative").length
  const neutralCount = reviews.filter(r => r.sentiment === "neutral").length
  
  // Week over week calculation
  const now = new Date()
  const oneWeekAgo = new Date(now)
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const twoWeeksAgo = new Date(now)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  
  const reviewsThisWeek = reviews.filter(r => new Date(r.date) >= oneWeekAgo).length
  const reviewsLastWeek = reviews.filter(r => {
    const d = new Date(r.date)
    return d >= twoWeeksAgo && d < oneWeekAgo
  }).length
  
  const weekOverWeekChange = reviewsLastWeek > 0 
    ? Math.round(((reviewsThisWeek - reviewsLastWeek) / reviewsLastWeek) * 100)
    : 0
  
  return {
    totalReviews,
    averageRating: Math.round(averageRating * 10) / 10,
    verifiedPurchaseRate: totalReviews > 0 ? Math.round((verifiedCount / totalReviews) * 100) : 0,
    positivePercentage: totalReviews > 0 ? Math.round((positiveCount / totalReviews) * 100) : 0,
    negativePercentage: totalReviews > 0 ? Math.round((negativeCount / totalReviews) * 100) : 0,
    neutralPercentage: totalReviews > 0 ? Math.round((neutralCount / totalReviews) * 100) : 0,
    reviewsThisWeek,
    reviewsLastWeek,
    weekOverWeekChange,
  }
}

// Star Rating Distribution
export interface StarDistribution {
  rating: number
  count: number
  percentage: number
}

export function getStarDistribution(
  marketplaceFilter?: Marketplace[],
  dateRange?: DateRange
): StarDistribution[] {
  const reviews = getMarketplaceReviews(marketplaceFilter, dateRange)
  const total = reviews.length
  
  return [5, 4, 3, 2, 1].map(rating => {
    const count = reviews.filter(r => r.rating === rating).length
    return {
      rating,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }
  })
}

// Marketplace Comparison
export interface MarketplaceMetrics {
  marketplace: Marketplace
  totalReviews: number
  averageRating: number
  positiveRate: number
  verifiedRate: number
}

export function getMarketplaceComparison(dateRange?: DateRange): MarketplaceMetrics[] {
  const marketplaces: Marketplace[] = ["amazon", "noon"]
  
  return marketplaces.map(marketplace => {
    const reviews = getMarketplaceReviews([marketplace], dateRange)
    const total = reviews.length
    const positiveCount = reviews.filter(r => r.sentiment === "positive").length
    const verifiedCount = reviews.filter(r => r.verifiedPurchase).length
    const avgRating = total > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / total 
      : 0
    
    return {
      marketplace,
      totalReviews: total,
      averageRating: Math.round(avgRating * 10) / 10,
      positiveRate: total > 0 ? Math.round((positiveCount / total) * 100) : 0,
      verifiedRate: total > 0 ? Math.round((verifiedCount / total) * 100) : 0,
    }
  })
}

// Product Performance
export interface ProductPerformance {
  productLine: string
  totalReviews: number
  averageRating: number
  positiveRate: number
  topFeature: string
  topIssue: string
}

export function getProductPerformance(
  marketplaceFilter?: Marketplace[],
  dateRange?: DateRange
): ProductPerformance[] {
  const reviews = getMarketplaceReviews(marketplaceFilter, dateRange)
  const productLines = ["S26 Ultra", "S26+", "S26"]
  
  return productLines.map(productLine => {
    const productReviews = reviews.filter(r => r.productLine === productLine)
    const total = productReviews.length
    const positiveCount = productReviews.filter(r => r.sentiment === "positive").length
    const avgRating = total > 0 
      ? productReviews.reduce((sum, r) => sum + r.rating, 0) / total 
      : 0
    
    // Find top feature and issue
    const featureCounts: Record<string, number> = {}
    const positiveFeatures: Record<string, number> = {}
    const negativeFeatures: Record<string, number> = {}
    
    productReviews.forEach(r => {
      r.features.forEach(f => {
        featureCounts[f] = (featureCounts[f] || 0) + 1
        if (r.sentiment === "positive") {
          positiveFeatures[f] = (positiveFeatures[f] || 0) + 1
        } else if (r.sentiment === "negative") {
          negativeFeatures[f] = (negativeFeatures[f] || 0) + 1
        }
      })
    })
    
    const topFeature = Object.entries(positiveFeatures)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"
    const topIssue = Object.entries(negativeFeatures)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"
    
    return {
      productLine,
      totalReviews: total,
      averageRating: Math.round(avgRating * 10) / 10,
      positiveRate: total > 0 ? Math.round((positiveCount / total) * 100) : 0,
      topFeature,
      topIssue,
    }
  })
}

// Competitor Mentions Analysis
export interface CompetitorMention {
  competitor: string
  mentions: number
  positiveContext: number // Mentions where Samsung is positive
  negativeContext: number // Mentions where Samsung is negative
}

export function getCompetitorMentions(
  marketplaceFilter?: Marketplace[],
  dateRange?: DateRange
): CompetitorMention[] {
  const reviews = getMarketplaceReviews(marketplaceFilter, dateRange)
  
  const competitorData: Record<string, { total: number; positive: number; negative: number }> = {}
  
  reviews.forEach(r => {
    r.competitorMentions.forEach(comp => {
      if (!competitorData[comp]) {
        competitorData[comp] = { total: 0, positive: 0, negative: 0 }
      }
      competitorData[comp].total++
      if (r.sentiment === "positive") {
        competitorData[comp].positive++
      } else if (r.sentiment === "negative") {
        competitorData[comp].negative++
      }
    })
  })
  
  return Object.entries(competitorData)
    .map(([competitor, data]) => ({
      competitor,
      mentions: data.total,
      positiveContext: data.positive,
      negativeContext: data.negative,
    }))
    .sort((a, b) => b.mentions - a.mentions)
}

// Feature Sentiment Analysis
export interface FeatureSentiment {
  feature: string
  total: number
  positive: number
  negative: number
  neutral: number
  positiveRate: number
}

export function getFeatureSentiment(
  marketplaceFilter?: Marketplace[],
  dateRange?: DateRange
): FeatureSentiment[] {
  const reviews = getMarketplaceReviews(marketplaceFilter, dateRange)
  
  const featureData: Record<string, { total: number; positive: number; negative: number; neutral: number }> = {}
  
  reviews.forEach(r => {
    r.features.forEach(feature => {
      if (!featureData[feature]) {
        featureData[feature] = { total: 0, positive: 0, negative: 0, neutral: 0 }
      }
      featureData[feature].total++
      featureData[feature][r.sentiment]++
    })
  })
  
  return Object.entries(featureData)
    .map(([feature, data]) => ({
      feature,
      total: data.total,
      positive: data.positive,
      negative: data.negative,
      neutral: data.neutral,
      positiveRate: data.total > 0 ? Math.round((data.positive / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

// Price Value Perception
export interface PriceValueMetrics {
  totalPriceMentions: number
  percentageOfReviews: number
  positiveValuePerception: number
  negativeValuePerception: number
}

export function getPriceValuePerception(
  marketplaceFilter?: Marketplace[],
  dateRange?: DateRange
): PriceValueMetrics {
  const reviews = getMarketplaceReviews(marketplaceFilter, dateRange)
  const priceReviews = reviews.filter(r => r.priceValueMention)
  
  const totalPriceMentions = priceReviews.length
  const positivePrice = priceReviews.filter(r => r.sentiment === "positive").length
  const negativePrice = priceReviews.filter(r => r.sentiment === "negative").length
  
  return {
    totalPriceMentions,
    percentageOfReviews: reviews.length > 0 ? Math.round((totalPriceMentions / reviews.length) * 100) : 0,
    positiveValuePerception: totalPriceMentions > 0 ? Math.round((positivePrice / totalPriceMentions) * 100) : 0,
    negativeValuePerception: totalPriceMentions > 0 ? Math.round((negativePrice / totalPriceMentions) * 100) : 0,
  }
}

// Review Velocity (reviews over time)
export interface ReviewVelocityPoint {
  date: string
  amazon: number
  noon: number
  total: number
}

export function getReviewVelocity(dateRange?: DateRange): ReviewVelocityPoint[] {
  const reviews = getMarketplaceReviews(undefined, dateRange)
  
  // Group by date
  const dateMap: Record<string, { amazon: number; noon: number }> = {}
  
  reviews.forEach(r => {
    const dateKey = r.date.split('T')[0]
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = { amazon: 0, noon: 0 }
    }
    dateMap[dateKey][r.marketplace]++
  })
  
  return Object.entries(dateMap)
    .map(([date, data]) => ({
      date,
      amazon: data.amazon,
      noon: data.noon,
      total: data.amazon + data.noon,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Top Reviews
export function getTopReviews(
  limit: number = 10,
  marketplaceFilter?: Marketplace[],
  dateRange?: DateRange
): MarketplaceReview[] {
  const reviews = getMarketplaceReviews(marketplaceFilter, dateRange)
  return reviews
    .filter(r => r.helpfulVotes > 0)
    .sort((a, b) => b.helpfulVotes - a.helpfulVotes)
    .slice(0, limit)
}
