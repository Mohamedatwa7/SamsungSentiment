import reviewsData from "@/data/samsung-reviews.json"

export interface Review {
  "Review ID": string
  "Review Submission Date": string
  "Review Display Locale": string
  "Campaign ID": string
  "Moderation Status": string
  "Moderation Codes": string
  "Ratings-only (Y/N)": string
  "Overall Rating": string
  "Review Title": string
  "Review Text": string
  "Product ID": string
  "Product Name": string
  "Product Page URL": string
  "Brand": string
  "Category Hierarchy": string
  "Reviewer ID": string
  "Reviewer Display Name": string
  "Product Family": string
  "Age (CDV)": string
  "Gender (CDV)": string
  "Reviewer Nickname": string
  "Reviewer Email Address": string
  "Reviewer Location": string
  "Category": string
  "Category ID": string
  "Review Language": string
}

export type Sentiment = "positive" | "neutral" | "negative"
export type Region = "local"  // All S.com reviews are local (Gulf countries excluding Saudi)

// All S.com reviews are local (Gulf countries excluding Saudi)
// No region detection needed - all reviews are treated as local
export function detectRegionFromLocation(_location: string): Region {
  return "local"
}

export interface AnalyzedReview extends Review {
  sentiment: Sentiment
  parsedDate: Date
  year: number
  month: number
  quarter: number
  productLine: string
  themes: string[]
  region: Region
}

// Common positive keywords
const positiveKeywords = [
  "amazing", "excellent", "great", "love", "best", "awesome", "fantastic", 
  "perfect", "wonderful", "outstanding", "superb", "brilliant", "incredible",
  "impressed", "happy", "satisfied", "recommend", "smooth", "fast", "beautiful",
  "stunning", "crisp", "clear", "sharp", "powerful", "reliable", "solid",
  "premium", "quality", "worth", "upgrade", "better", "improved", "innovation"
]

// Common negative keywords
const negativeKeywords = [
  "bad", "terrible", "awful", "hate", "worst", "disappointing", "poor",
  "broken", "defective", "issue", "problem", "bug", "slow", "laggy", "crash",
  "expensive", "overpriced", "waste", "regret", "return", "refund", "fail",
  "frustrating", "annoying", "useless", "cheap", "mistake", "error", "glitch"
]

// Feature themes to detect
const themeKeywords: Record<string, string[]> = {
  "Camera": ["camera", "photo", "picture", "zoom", "lens", "portrait", "night mode", "video", "recording", "200mp", "megapixel"],
  "Display": ["display", "screen", "amoled", "oled", "bright", "resolution", "viewing"],
  "Battery": ["battery", "charge", "charging", "power", "last", "drain", "mah"],
  "Performance": ["fast", "smooth", "performance", "speed", "snapdragon", "processor", "ram", "lag", "multitask"],
  "AI Features": ["ai", "galaxy ai", "gemini", "smart", "assistant", "intelligent", "feature"],
  "Design": ["design", "build", "premium", "look", "feel", "thin", "light", "weight", "color", "titanium"],
  "S Pen": ["s pen", "stylus", "pen", "note", "draw", "write"],
  "Software": ["software", "one ui", "update", "android", "app", "interface"],
  "Value": ["price", "value", "worth", "expensive", "cheap", "money", "cost", "afford"],
  "Audio": ["sound", "speaker", "audio", "music", "call", "mic", "buds"],
}

// S26 Key Features to track
const s26FeatureKeywords: Record<string, string[]> = {
  "Privacy Display": ["privacy display", "privacy screen", "anti-peep", "viewing angle", "private viewing", "privacy mode"],
  "Nightography": ["nightography", "night mode", "night photo", "low light", "night camera", "night shot", "dark photo"],
  "Horizontal Lock": ["horizontal lock", "landscape lock", "rotation lock", "screen rotation", "auto rotate"],
}

function parseDate(dateStr: string): Date {
  // Format: "4/6/26 22:06" or "5/3/2026 10:30" -> MM/DD/YY(YY) HH:MM
  const parts = dateStr.split(" ")
  const dateParts = parts[0].split("/")
  const month = parseInt(dateParts[0]) - 1
  const day = parseInt(dateParts[1])
  let year = parseInt(dateParts[2])
  // Handle 2-digit or 4-digit year
  if (year < 100) {
    year = year < 50 ? 2000 + year : 1900 + year
  }
  
  const timeParts = parts[1]?.split(":") || ["0", "0"]
  const hours = parseInt(timeParts[0])
  const minutes = parseInt(timeParts[1])
  
  return new Date(year, month, day, hours, minutes)
}

function getQuarter(month: number): number {
  return Math.floor(month / 3) + 1
}

function detectSentiment(rating: string, title: string, text: string): Sentiment {
  const ratingNum = parseInt(rating)
  const content = `${title} ${text}`.toLowerCase()
  
  // Rating-based initial sentiment
  if (ratingNum >= 4) {
    // Check for negative content despite high rating
    const negCount = negativeKeywords.filter(k => content.includes(k)).length
    if (negCount >= 3) return "neutral"
    return "positive"
  } else if (ratingNum === 3) {
    return "neutral"
  } else {
    // Check for positive content despite low rating
    const posCount = positiveKeywords.filter(k => content.includes(k)).length
    if (posCount >= 3) return "neutral"
    return "negative"
  }
}

function detectThemes(title: string, text: string): string[] {
  const content = `${title} ${text}`.toLowerCase()
  const detectedThemes: string[] = []
  
  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    if (keywords.some(keyword => content.includes(keyword))) {
      detectedThemes.push(theme)
    }
  }
  
  return detectedThemes.length > 0 ? detectedThemes : ["General"]
}

function extractProductLine(productName: string): string {
  if (productName.includes("S26 Ultra")) return "S26 Ultra"
  if (productName.includes("S26+")) return "S26+"
  if (productName.includes("S26")) return "S26"
  if (productName.includes("S25 Ultra")) return "S25 Ultra"
  if (productName.includes("S25+")) return "S25+"
  if (productName.includes("S25")) return "S25"
  if (productName.includes("S24 Ultra")) return "S24 Ultra"
  if (productName.includes("S24+")) return "S24+"
  if (productName.includes("S24")) return "S24"
  if (productName.includes("Buds")) return "Galaxy Buds"
  if (productName.includes("Watch")) return "Galaxy Watch"
  if (productName.includes("Tab")) return "Galaxy Tab"
  if (productName.includes("Fold")) return "Galaxy Fold"
  if (productName.includes("Flip")) return "Galaxy Flip"
  return "Other"
}

export function getAnalyzedReviews(): AnalyzedReview[] {
  return (reviewsData as Review[]).map(review => {
    const parsedDate = parseDate(review["Review Submission Date"])
    return {
      ...review,
      sentiment: detectSentiment(
        review["Overall Rating"],
        review["Review Title"],
        review["Review Text"]
      ),
      parsedDate,
      year: parsedDate.getFullYear(),
      month: parsedDate.getMonth() + 1,
      quarter: getQuarter(parsedDate.getMonth()),
      productLine: extractProductLine(review["Product Name"]),
      themes: detectThemes(review["Review Title"], review["Review Text"]),
      region: detectRegionFromLocation(review["Reviewer Location"])
    }
  })
}

// Region metrics removed - all S.com data is local (Gulf countries excluding Saudi)

export interface FeatureData {
  mentions: number
  positiveRate: number
}

export interface S26FeatureMetrics {
  privacyDisplay: FeatureData
  nightography: FeatureData
  horizontalLock: FeatureData
}

function calculateFeaturePositiveRate(reviews: AnalyzedReview[]): number {
  if (reviews.length === 0) return 0
  const positive = reviews.filter(r => r.sentiment === "positive").length
  return Math.round((positive / reviews.length) * 100)
}

export function getS26FeatureMetrics(reviews: AnalyzedReview[]): S26FeatureMetrics {
  const privacyDisplayReviews: AnalyzedReview[] = []
  const nightographyReviews: AnalyzedReview[] = []
  const horizontalLockReviews: AnalyzedReview[] = []
  
  for (const review of reviews) {
    const content = `${review["Review Title"]} ${review["Review Text"]}`.toLowerCase()
    
    // Check Privacy Display mentions
    if (s26FeatureKeywords["Privacy Display"].some(k => content.includes(k))) {
      privacyDisplayReviews.push(review)
    }
    
    // Check Nightography mentions
    if (s26FeatureKeywords["Nightography"].some(k => content.includes(k))) {
      nightographyReviews.push(review)
    }
    
    // Check Horizontal Lock mentions
    if (s26FeatureKeywords["Horizontal Lock"].some(k => content.includes(k))) {
      horizontalLockReviews.push(review)
    }
  }
  
  return {
    privacyDisplay: {
      mentions: privacyDisplayReviews.length,
      positiveRate: calculateFeaturePositiveRate(privacyDisplayReviews)
    },
    nightography: {
      mentions: nightographyReviews.length,
      positiveRate: calculateFeaturePositiveRate(nightographyReviews)
    },
    horizontalLock: {
      mentions: horizontalLockReviews.length,
      positiveRate: calculateFeaturePositiveRate(horizontalLockReviews)
    }
  }
}

export interface SentimentMetrics {
  total: number
  positive: number
  neutral: number
  negative: number
  positivePercent: number
  neutralPercent: number
  negativePercent: number
  averageRating: number
  brandHealthScore: number
}

export function calculateSentimentMetrics(reviews: AnalyzedReview[]): SentimentMetrics {
  const total = reviews.length
  if (total === 0) {
    return {
      total: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      positivePercent: 0,
      neutralPercent: 0,
      negativePercent: 0,
      averageRating: 0,
      brandHealthScore: 0
    }
  }
  
  const positive = reviews.filter(r => r.sentiment === "positive").length
  const neutral = reviews.filter(r => r.sentiment === "neutral").length
  const negative = reviews.filter(r => r.sentiment === "negative").length
  
  const positivePercent = (positive / total) * 100
  const neutralPercent = (neutral / total) * 100
  const negativePercent = (negative / total) * 100
  
  const validRatings = reviews
    .map(r => parseInt(r["Overall Rating"]))
    .filter(rating => !isNaN(rating) && rating >= 1 && rating <= 5)
  const totalRating = validRatings.reduce((sum, r) => sum + r, 0)
  const averageRating = validRatings.length > 0 ? totalRating / validRatings.length : 0
  
  // Brand health score formula
  const brandHealthScore = Math.round(
    (positivePercent * 1.0) + (neutralPercent * 0.5) + (negativePercent * 0.0)
  )
  
  return {
    total,
    positive,
    neutral,
    negative,
    positivePercent,
    neutralPercent,
    negativePercent,
    averageRating,
    brandHealthScore
  }
}

export interface ThemeAnalysis {
  theme: string
  count: number
  positive: number
  neutral: number
  negative: number
  sentiment: Sentiment
}

export function analyzeThemes(reviews: AnalyzedReview[]): ThemeAnalysis[] {
  const themeMap: Record<string, { count: number; positive: number; neutral: number; negative: number }> = {}
  
  reviews.forEach(review => {
    review.themes.forEach(theme => {
      if (!themeMap[theme]) {
        themeMap[theme] = { count: 0, positive: 0, neutral: 0, negative: 0 }
      }
      themeMap[theme].count++
      themeMap[theme][review.sentiment]++
    })
  })
  
  return Object.entries(themeMap)
    .map(([theme, data]) => {
      const dominantSentiment: Sentiment = 
        data.positive >= data.neutral && data.positive >= data.negative ? "positive" :
        data.negative >= data.neutral ? "negative" : "neutral"
      
      return {
        theme,
        ...data,
        sentiment: dominantSentiment
      }
    })
    .sort((a, b) => b.count - a.count)
}

export interface TimeComparison {
  period: string
  current: SentimentMetrics
  previous: SentimentMetrics
  change: {
    positive: number
    neutral: number
    negative: number
    brandHealth: number
    avgRating: number
  }
}

export function getYearOverYearComparison(reviews: AnalyzedReview[], currentYear: number = 2026): TimeComparison {
  const currentYearReviews = reviews.filter(r => r.year === currentYear)
  const previousYearReviews = reviews.filter(r => r.year === currentYear - 1)
  
  const current = calculateSentimentMetrics(currentYearReviews)
  const previous = calculateSentimentMetrics(previousYearReviews)
  
  return {
    period: `${currentYear} vs ${currentYear - 1}`,
    current,
    previous,
    change: {
      positive: current.positivePercent - previous.positivePercent,
      neutral: current.neutralPercent - previous.neutralPercent,
      negative: current.negativePercent - previous.negativePercent,
      brandHealth: current.brandHealthScore - previous.brandHealthScore,
      avgRating: current.averageRating - previous.averageRating
    }
  }
}

export function getProductComparison(reviews: AnalyzedReview[], product1: string, product2: string): TimeComparison {
  const product1Reviews = reviews.filter(r => r.productLine === product1)
  const product2Reviews = reviews.filter(r => r.productLine === product2)
  
  const current = calculateSentimentMetrics(product1Reviews)
  const previous = calculateSentimentMetrics(product2Reviews)
  
  return {
    period: `${product1} vs ${product2}`,
    current,
    previous,
    change: {
      positive: current.positivePercent - previous.positivePercent,
      neutral: current.neutralPercent - previous.neutralPercent,
      negative: current.negativePercent - previous.negativePercent,
      brandHealth: current.brandHealthScore - previous.brandHealthScore,
      avgRating: current.averageRating - previous.averageRating
    }
  }
}

export function getMonthlyTrends(reviews: AnalyzedReview[]): { month: string; positive: number; neutral: number; negative: number; total: number }[] {
  const monthlyData: Record<string, { positive: number; neutral: number; negative: number; total: number }> = {}
  
  reviews.forEach(review => {
    const key = `${review.year}-${String(review.month).padStart(2, '0')}`
    if (!monthlyData[key]) {
      monthlyData[key] = { positive: 0, neutral: 0, negative: 0, total: 0 }
    }
    monthlyData[key][review.sentiment]++
    monthlyData[key].total++
  })
  
  return Object.entries(monthlyData)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => ({ month, ...data }))
}

export function getQuarterlyTrends(reviews: AnalyzedReview[]): { quarter: string; positive: number; neutral: number; negative: number; total: number; positivePercent: number }[] {
  const quarterlyData: Record<string, { positive: number; neutral: number; negative: number; total: number }> = {}
  
  reviews.forEach(review => {
    const key = `${review.year} Q${review.quarter}`
    if (!quarterlyData[key]) {
      quarterlyData[key] = { positive: 0, neutral: 0, negative: 0, total: 0 }
    }
    quarterlyData[key][review.sentiment]++
    quarterlyData[key].total++
  })
  
  return Object.entries(quarterlyData)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([quarter, data]) => ({ 
      quarter, 
      ...data,
      positivePercent: data.total > 0 ? Math.round((data.positive / data.total) * 100) : 0
    }))
}

export function getProductLines(reviews: AnalyzedReview[]): string[] {
  const lines = new Set(reviews.map(r => r.productLine))
  return Array.from(lines).sort()
}

export function getRatingDistribution(reviews: AnalyzedReview[]): { rating: string; count: number; percentage: number }[] {
  const distribution: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }
  
  reviews.forEach(review => {
    const rating = review["Overall Rating"]
    if (distribution[rating] !== undefined) {
      distribution[rating]++
    }
  })
  
  const total = reviews.length
  return Object.entries(distribution)
    .map(([rating, count]) => ({
      rating: `${rating} Star`,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.rating.localeCompare(a.rating))
}

export function getTopReviews(reviews: AnalyzedReview[], sentiment: Sentiment, limit: number = 5): AnalyzedReview[] {
  return reviews
    .filter(r => r.sentiment === sentiment && r["Review Text"].length > 50)
    .sort((a, b) => b["Review Text"].length - a["Review Text"].length)
    .slice(0, limit)
}

export interface MonthVsLastYearComparison {
  month: string
  monthName: string
  currentYear: number
  previousYear: number
  s26: SentimentMetrics
  s25: SentimentMetrics
  change: {
    positive: number
    neutral: number
    negative: number
    brandHealth: number
    avgRating: number
    volume: number
  }
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// Model variant pairs for filtering
export const modelVariantPairs = [
  { s26: "S26 Ultra", s25: "S25 Ultra", label: "Ultra vs Ultra" },
  { s26: "S26+", s25: "S25+", label: "+ vs +" },
  { s26: "S26", s25: "S25", label: "Base vs Base" },
]

export function getMonthVsLastYearComparison(
  reviews: AnalyzedReview[], 
  s26Model?: string, 
  s25Model?: string
): MonthVsLastYearComparison[] {
  const comparisons: MonthVsLastYearComparison[] = []
  
  // Get all S26 and S25 reviews, optionally filtered by specific models
  let s26Reviews = reviews.filter(r => r.productLine.includes("S26"))
  let s25Reviews = reviews.filter(r => r.productLine.includes("S25"))
  
  if (s26Model) {
    s26Reviews = reviews.filter(r => r.productLine === s26Model)
  }
  if (s25Model) {
    s25Reviews = reviews.filter(r => r.productLine === s25Model)
  }
  
  // Get unique months from S26 reviews (current year)
  const s26MonthsSet = new Set<number>()
  s26Reviews.forEach(r => s26MonthsSet.add(r.month))
  const s26Months = Array.from(s26MonthsSet).sort((a, b) => a - b)
  
  for (const month of s26Months) {
    const s26MonthReviews = s26Reviews.filter(r => r.month === month)
    const s25MonthReviews = s25Reviews.filter(r => r.month === month)
    
    const s26Metrics = calculateSentimentMetrics(s26MonthReviews)
    const s25Metrics = calculateSentimentMetrics(s25MonthReviews)
    
    comparisons.push({
      month: String(month).padStart(2, '0'),
      monthName: monthNames[month - 1],
      currentYear: 2026,
      previousYear: 2025,
      s26: s26Metrics,
      s25: s25Metrics,
      change: {
        positive: s26Metrics.positivePercent - s25Metrics.positivePercent,
        neutral: s26Metrics.neutralPercent - s25Metrics.neutralPercent,
        negative: s26Metrics.negativePercent - s25Metrics.negativePercent,
        brandHealth: s26Metrics.brandHealthScore - s25Metrics.brandHealthScore,
        avgRating: s26Metrics.averageRating - s25Metrics.averageRating,
        volume: s26Metrics.total - s25Metrics.total
      }
    })
  }
  
  return comparisons
}

export interface QuarterVsLastYearComparison {
  quarter: number
  quarterName: string
  s26: SentimentMetrics
  s25: SentimentMetrics
  change: {
    positive: number
    neutral: number
    negative: number
    brandHealth: number
    avgRating: number
    volume: number
  }
}

export function getQuarterVsLastYearComparison(reviews: AnalyzedReview[]): QuarterVsLastYearComparison[] {
  const comparisons: QuarterVsLastYearComparison[] = []
  
  // Get all S26 and S25 reviews
  const s26Reviews = reviews.filter(r => r.productLine.includes("S26"))
  const s25Reviews = reviews.filter(r => r.productLine.includes("S25"))
  
  // Get unique quarters from S26 reviews
  const s26QuartersSet = new Set<number>()
  s26Reviews.forEach(r => s26QuartersSet.add(r.quarter))
  const s26Quarters = Array.from(s26QuartersSet).sort((a, b) => a - b)
  
  for (const quarter of s26Quarters) {
    const s26QuarterReviews = s26Reviews.filter(r => r.quarter === quarter)
    const s25QuarterReviews = s25Reviews.filter(r => r.quarter === quarter)
    
    const s26Metrics = calculateSentimentMetrics(s26QuarterReviews)
    const s25Metrics = calculateSentimentMetrics(s25QuarterReviews)
    
    comparisons.push({
      quarter,
      quarterName: `Q${quarter}`,
      s26: s26Metrics,
      s25: s25Metrics,
      change: {
        positive: s26Metrics.positivePercent - s25Metrics.positivePercent,
        neutral: s26Metrics.neutralPercent - s25Metrics.neutralPercent,
        negative: s26Metrics.negativePercent - s25Metrics.negativePercent,
        brandHealth: s26Metrics.brandHealthScore - s25Metrics.brandHealthScore,
        avgRating: s26Metrics.averageRating - s25Metrics.averageRating,
        volume: s26Metrics.total - s25Metrics.total
      }
    })
  }
  
  return comparisons
}

export interface WeekVsLastYearComparison {
  week: number
  month: number
  monthName: string
  s26: SentimentMetrics
  s25: SentimentMetrics
  change: {
    positive: number
    negative: number
    brandHealth: number
    avgRating: number
  }
}

function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const dayOfMonth = date.getDate()
  const firstDayOfWeek = firstDay.getDay()
  return Math.ceil((dayOfMonth + firstDayOfWeek) / 7)
}

export function getWeekVsLastYearComparison(
  reviews: AnalyzedReview[],
  selectedMonths: number[],
  s26Model?: string,
  s25Model?: string
): WeekVsLastYearComparison[] {
  const comparisons: WeekVsLastYearComparison[] = []
  
  // Get S26 and S25 reviews, optionally filtered by specific models
  let s26Reviews = reviews.filter(r => r.productLine.includes("S26"))
  let s25Reviews = reviews.filter(r => r.productLine.includes("S25"))
  
  if (s26Model) {
    s26Reviews = reviews.filter(r => r.productLine === s26Model)
  }
  if (s25Model) {
    s25Reviews = reviews.filter(r => r.productLine === s25Model)
  }
  
  // Filter by selected months if any
  if (selectedMonths.length > 0) {
    s26Reviews = s26Reviews.filter(r => selectedMonths.includes(r.month))
    s25Reviews = s25Reviews.filter(r => selectedMonths.includes(r.month))
  }
  
  // Add week of month to each review
  const s26WithWeek = s26Reviews.map(r => ({
    ...r,
    weekOfMonth: getWeekOfMonth(r.parsedDate)
  }))
  
  const s25WithWeek = s25Reviews.map(r => ({
    ...r,
    weekOfMonth: getWeekOfMonth(r.parsedDate)
  }))
  
  // Get unique month-week combinations from S26
  const monthWeekSet = new Set<string>()
  s26WithWeek.forEach(r => monthWeekSet.add(`${r.month}-${r.weekOfMonth}`))
  const monthWeeks = Array.from(monthWeekSet)
    .map(mw => {
      const [month, week] = mw.split('-').map(Number)
      return { month, week }
    })
    .sort((a, b) => a.month === b.month ? a.week - b.week : a.month - b.month)
  
  for (const { month, week } of monthWeeks) {
    const s26WeekReviews = s26WithWeek.filter(r => r.month === month && r.weekOfMonth === week)
    const s25WeekReviews = s25WithWeek.filter(r => r.month === month && r.weekOfMonth === week)
    
    const s26Metrics = calculateSentimentMetrics(s26WeekReviews)
    const s25Metrics = calculateSentimentMetrics(s25WeekReviews)
    
    comparisons.push({
      week,
      month,
      monthName: monthNames[month - 1],
      s26: s26Metrics,
      s25: s25Metrics,
      change: {
        positive: s26Metrics.positivePercent - s25Metrics.positivePercent,
        negative: s26Metrics.negativePercent - s25Metrics.negativePercent,
        brandHealth: s26Metrics.brandHealthScore - s25Metrics.brandHealthScore,
        avgRating: s26Metrics.averageRating - s25Metrics.averageRating
      }
    })
  }
  
  return comparisons
}

export function getQuarterVsLastYearComparisonFiltered(
  reviews: AnalyzedReview[], 
  s26Model?: string, 
  s25Model?: string
): QuarterVsLastYearComparison[] {
  const comparisons: QuarterVsLastYearComparison[] = []
  
  // Get all S26 and S25 reviews, optionally filtered by specific models
  let s26Reviews = reviews.filter(r => r.productLine.includes("S26"))
  let s25Reviews = reviews.filter(r => r.productLine.includes("S25"))
  
  if (s26Model) {
    s26Reviews = reviews.filter(r => r.productLine === s26Model)
  }
  if (s25Model) {
    s25Reviews = reviews.filter(r => r.productLine === s25Model)
  }
  
  // Get unique quarters from S26 reviews
  const s26QuartersSet = new Set<number>()
  s26Reviews.forEach(r => s26QuartersSet.add(r.quarter))
  const s26Quarters = Array.from(s26QuartersSet).sort((a, b) => a - b)
  
  for (const quarter of s26Quarters) {
    const s26QuarterReviews = s26Reviews.filter(r => r.quarter === quarter)
    const s25QuarterReviews = s25Reviews.filter(r => r.quarter === quarter)
    
    const s26Metrics = calculateSentimentMetrics(s26QuarterReviews)
    const s25Metrics = calculateSentimentMetrics(s25QuarterReviews)
    
    comparisons.push({
      quarter,
      quarterName: `Q${quarter}`,
      s26: s26Metrics,
      s25: s25Metrics,
      change: {
        positive: s26Metrics.positivePercent - s25Metrics.positivePercent,
        neutral: s26Metrics.neutralPercent - s25Metrics.neutralPercent,
        negative: s26Metrics.negativePercent - s25Metrics.negativePercent,
        brandHealth: s26Metrics.brandHealthScore - s25Metrics.brandHealthScore,
        avgRating: s26Metrics.averageRating - s25Metrics.averageRating,
        volume: s26Metrics.total - s25Metrics.total
      }
    })
  }
  
  return comparisons
}
