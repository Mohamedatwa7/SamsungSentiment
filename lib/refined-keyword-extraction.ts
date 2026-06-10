import type { AnalyzedReview, Sentiment } from "./reviews-data"

// Keyword types based on commercial and product relevance
export type KeywordType = 
  | "feature"         // Product feature or capability
  | "pain_point"      // Issue, problem, or negative experience
  | "comparison"      // Comparison to competitors or previous models
  | "purchase_intent" // Buying decision language, value assessment
  | "use_case"        // How customers use the product
  | "perception"      // Brand/product perception and sentiment

// Canonical keyword with grouped variants
export interface CanonicalKeyword {
  canonical: string           // The main/canonical keyword
  variants: string[]          // All phrases grouped under this keyword
  type: KeywordType           // Classification type
  relevanceReason: string     // Why this keyword is relevant
  totalMentions: number       // Sum of all variant mentions
  sentiment: Sentiment        // Overall sentiment
  sentimentScore: number      // -1 to 1
  positivePercentage: number  // Percentage of positive reviews
  sampleContexts: string[]    // Sample review excerpts (up to 3)
  aspectCategory: string      // Product aspect (camera, battery, etc.)
}

// Rejection record for transparency
export interface RejectedPhrase {
  phrase: string
  reason: string
}

// Result structure
export interface RefinedKeywordResult {
  acceptedKeywords: CanonicalKeyword[]
  rejectedPhrases: RejectedPhrase[]
  summary: {
    totalAccepted: number
    totalRejected: number
    byType: Record<KeywordType, number>
  }
}

// Keyword groupings - canonical keyword and its variants
const keywordGroupings: Record<string, { variants: string[], type: KeywordType, reason: string, aspect: string }> = {
  // Camera Features
  "camera quality": {
    variants: ["camera quality", "camera is good", "camera is great", "camera is amazing", "photo quality", "picture quality", "image quality", "camera performance"],
    type: "feature",
    reason: "Core product capability - primary purchase driver for flagship phones",
    aspect: "camera"
  },
  "zoom capability": {
    variants: ["zoom", "optical zoom", "space zoom", "10x zoom", "100x zoom", "telephoto", "zoom lens", "zoom quality", "zoom camera"],
    type: "feature",
    reason: "Differentiating camera feature unique to Samsung flagships",
    aspect: "camera"
  },
  "night photography": {
    variants: ["night mode", "nightography", "low light", "night photos", "dark mode camera", "night photography", "night shots"],
    type: "feature",
    reason: "Key camera capability for low-light scenarios",
    aspect: "camera"
  },
  "video recording": {
    variants: ["video quality", "video recording", "4k video", "8k video", "video camera", "filming", "video mode"],
    type: "feature",
    reason: "Important media creation capability",
    aspect: "camera"
  },
  "portrait mode": {
    variants: ["portrait mode", "portrait", "bokeh", "background blur", "portrait photos"],
    type: "feature",
    reason: "Popular photography feature for professional-looking photos",
    aspect: "camera"
  },
  
  // Display Features
  "display quality": {
    variants: ["display quality", "screen quality", "display is great", "screen is amazing", "beautiful display", "gorgeous screen", "display is beautiful"],
    type: "feature",
    reason: "Core hardware feature affecting daily user experience",
    aspect: "display"
  },
  "screen brightness": {
    variants: ["brightness", "bright screen", "outdoor visibility", "sunlight readability", "bright display", "screen brightness"],
    type: "feature",
    reason: "Practical usability concern for outdoor use",
    aspect: "display"
  },
  "refresh rate": {
    variants: ["refresh rate", "120hz", "smooth scrolling", "smoothness", "smooth display", "adaptive refresh"],
    type: "feature",
    reason: "Premium display feature affecting perceived performance",
    aspect: "display"
  },
  
  // Battery Features
  "battery life": {
    variants: ["battery life", "battery backup", "battery performance", "battery lasts", "all day battery", "battery duration", "how long battery lasts"],
    type: "feature",
    reason: "Critical daily usability factor",
    aspect: "battery"
  },
  "battery drain": {
    variants: ["battery drain", "battery drains", "draining fast", "battery draining", "loses charge", "battery consumption"],
    type: "pain_point",
    reason: "Common user complaint affecting device utility",
    aspect: "battery"
  },
  "fast charging": {
    variants: ["fast charging", "quick charge", "charging speed", "charges fast", "45w charging", "super fast charging"],
    type: "feature",
    reason: "Convenience feature reducing downtime",
    aspect: "battery"
  },
  "wireless charging": {
    variants: ["wireless charging", "wireless charger", "qi charging", "reverse wireless charging", "powershare"],
    type: "feature",
    reason: "Premium convenience feature",
    aspect: "battery"
  },
  
  // Performance
  "overall performance": {
    variants: ["performance", "fast performance", "smooth performance", "powerful", "performs well", "performs great"],
    type: "feature",
    reason: "Core product capability affecting all operations",
    aspect: "performance"
  },
  "gaming performance": {
    variants: ["gaming", "games", "gaming performance", "play games", "mobile gaming", "game mode"],
    type: "use_case",
    reason: "Important use case for performance-focused buyers",
    aspect: "performance"
  },
  "lag issues": {
    variants: ["lag", "laggy", "slow", "stutter", "stuttering", "freezes", "hanging"],
    type: "pain_point",
    reason: "Performance issue directly impacting user experience",
    aspect: "performance"
  },
  "heating issues": {
    variants: ["heating", "overheating", "gets hot", "heats up", "thermal", "heat issue", "phone gets warm"],
    type: "pain_point",
    reason: "Hardware concern affecting usability and longevity",
    aspect: "performance"
  },
  
  // Design
  "build quality": {
    variants: ["build quality", "premium build", "solid build", "well built", "construction quality", "feels premium"],
    type: "feature",
    reason: "Quality perception affecting purchase justification",
    aspect: "design"
  },
  "design aesthetic": {
    variants: ["design", "looks great", "beautiful design", "aesthetic", "gorgeous", "sleek design", "stylish"],
    type: "perception",
    reason: "Visual appeal influencing purchase decision",
    aspect: "design"
  },
  "weight and size": {
    variants: ["weight", "heavy", "lightweight", "bulky", "thin", "slim", "portable", "pocketable", "too big", "too heavy"],
    type: "feature",
    reason: "Ergonomic consideration for daily use",
    aspect: "design"
  },
  
  // Software
  "one ui experience": {
    variants: ["one ui", "oneui", "samsung ui", "software experience", "user interface", "ui experience"],
    type: "feature",
    reason: "Software experience differentiator",
    aspect: "software"
  },
  "software bugs": {
    variants: ["bugs", "buggy", "glitches", "software issues", "crashes", "app crashes", "freezing"],
    type: "pain_point",
    reason: "Quality issue affecting reliability",
    aspect: "software"
  },
  "software updates": {
    variants: ["updates", "software updates", "android updates", "update support", "update policy", "years of updates"],
    type: "feature",
    reason: "Long-term value proposition",
    aspect: "software"
  },
  
  // AI Features
  "galaxy ai": {
    variants: ["galaxy ai", "samsung ai", "ai features", "artificial intelligence", "ai capabilities"],
    type: "feature",
    reason: "Key differentiating feature for latest models",
    aspect: "ai"
  },
  "circle to search": {
    variants: ["circle to search", "circle search", "search feature"],
    type: "feature",
    reason: "Unique AI-powered search capability",
    aspect: "ai"
  },
  "ai photo editing": {
    variants: ["ai editing", "photo editing ai", "ai photo", "generative edit", "magic eraser", "object eraser"],
    type: "feature",
    reason: "AI-enhanced creative capability",
    aspect: "ai"
  },
  "live translate": {
    variants: ["live translate", "translation", "real-time translation", "call translation", "interpreter"],
    type: "feature",
    reason: "AI communication feature for international users",
    aspect: "ai"
  },
  
  // Price/Value
  "value for money": {
    variants: ["value for money", "worth the price", "worth it", "good value", "great value", "value proposition"],
    type: "purchase_intent",
    reason: "Purchase justification metric",
    aspect: "price"
  },
  "expensive": {
    variants: ["expensive", "overpriced", "too expensive", "pricey", "costs too much", "high price"],
    type: "pain_point",
    reason: "Price objection affecting purchase decision",
    aspect: "price"
  },
  "affordable": {
    variants: ["affordable", "good price", "reasonable price", "budget friendly", "fair price"],
    type: "purchase_intent",
    reason: "Positive price perception",
    aspect: "price"
  },
  
  // Comparisons
  "vs iphone": {
    variants: ["iphone", "compared to iphone", "better than iphone", "vs iphone", "apple", "ios"],
    type: "comparison",
    reason: "Direct competitor comparison influencing brand switching",
    aspect: "comparison"
  },
  "vs previous model": {
    variants: ["upgrade", "upgraded from", "previous model", "old phone", "s25", "s24", "s23", "compared to s25", "better than s25"],
    type: "comparison",
    reason: "Upgrade decision factor for existing Samsung users",
    aspect: "comparison"
  },
  "vs pixel": {
    variants: ["pixel", "google pixel", "vs pixel", "compared to pixel"],
    type: "comparison",
    reason: "Competitor comparison in Android ecosystem",
    aspect: "comparison"
  },
  
  // Use Cases
  "daily use": {
    variants: ["daily use", "everyday use", "daily driver", "regular use", "using daily", "day to day"],
    type: "use_case",
    reason: "Real-world usage context",
    aspect: "general"
  },
  "business use": {
    variants: ["business", "work phone", "professional use", "productivity", "work use", "office use"],
    type: "use_case",
    reason: "Professional use case segment",
    aspect: "general"
  },
  "content creation": {
    variants: ["content creation", "vlogging", "social media", "youtube", "instagram", "tiktok", "influencer"],
    type: "use_case",
    reason: "Creator use case segment",
    aspect: "general"
  },
  
  // Perceptions
  "highly recommended": {
    variants: ["highly recommend", "recommended", "must buy", "definitely recommend", "would recommend", "recommend this"],
    type: "perception",
    reason: "Advocacy indicator for word-of-mouth marketing",
    aspect: "general"
  },
  "best phone": {
    variants: ["best phone", "best smartphone", "best android", "best samsung", "top phone", "flagship"],
    type: "perception",
    reason: "Category leadership perception",
    aspect: "general"
  },
  "disappointed": {
    variants: ["disappointed", "disappointing", "let down", "not impressed", "expected more", "underwhelming"],
    type: "perception",
    reason: "Negative sentiment indicating unmet expectations",
    aspect: "general"
  },
  "satisfied": {
    variants: ["satisfied", "happy with", "pleased with", "love this phone", "love it", "very happy"],
    type: "perception",
    reason: "Customer satisfaction indicator",
    aspect: "general"
  },
  
  // Durability
  "water resistance": {
    variants: ["water resistant", "waterproof", "ip68", "ip67", "water damage", "splash proof"],
    type: "feature",
    reason: "Durability feature for peace of mind",
    aspect: "durability"
  },
  "screen durability": {
    variants: ["screen crack", "cracked screen", "gorilla glass", "screen protection", "screen scratch", "scratches easily"],
    type: "feature",
    reason: "Longevity concern affecting total cost of ownership",
    aspect: "durability"
  },
  
  // Connectivity
  "5g connectivity": {
    variants: ["5g", "5g speed", "5g network", "5g connectivity", "5g support"],
    type: "feature",
    reason: "Future-proofing connectivity feature",
    aspect: "connectivity"
  },
  "signal reception": {
    variants: ["signal", "reception", "network signal", "call quality", "signal strength", "network reception"],
    type: "feature",
    reason: "Core phone functionality",
    aspect: "connectivity"
  },
  
  // Storage
  "storage capacity": {
    variants: ["storage", "storage space", "256gb", "512gb", "1tb", "internal storage", "memory space"],
    type: "feature",
    reason: "Capacity consideration for media-heavy users",
    aspect: "storage"
  },
  "no sd card": {
    variants: ["sd card", "micro sd", "expandable storage", "no sd card slot", "card slot"],
    type: "pain_point",
    reason: "Missing feature complaint for storage-conscious users",
    aspect: "storage"
  },
  
  // Audio
  "speaker quality": {
    variants: ["speaker", "speakers", "speaker quality", "sound quality", "audio quality", "stereo speakers"],
    type: "feature",
    reason: "Media consumption experience",
    aspect: "audio"
  },
  "call quality": {
    variants: ["call quality", "voice quality", "clear calls", "call clarity", "phone calls"],
    type: "feature",
    reason: "Core communication functionality",
    aspect: "audio"
  },
  
  // S Pen (for Ultra)
  "s pen": {
    variants: ["s pen", "stylus", "pen", "s-pen", "writing", "note taking"],
    type: "feature",
    reason: "Unique differentiating feature for Ultra model",
    aspect: "s_pen"
  },
}

// Rejection patterns - phrases that should never be accepted
const rejectionPatterns = [
  // Too generic
  { pattern: /^(the|this|my|a|an)\s+(phone|device|product|samsung|galaxy)$/i, reason: "Too generic - no specific insight" },
  { pattern: /^(very|really|so|quite|pretty)\s+(good|nice|great|bad)$/i, reason: "Purely emotional without product context" },
  { pattern: /^(i|we|you)\s+(think|feel|believe|guess)$/i, reason: "Conversational filler" },
  { pattern: /^(it|this|that)\s+(is|was|has|have)$/i, reason: "Too generic - sentence fragment" },
  
  // Conversational
  { pattern: /^(thank|thanks|please|sorry|hello|hi|hey)(\s|$)/i, reason: "Conversational greeting/courtesy" },
  { pattern: /^(yes|no|ok|okay|sure|maybe|perhaps)$/i, reason: "Conversational response" },
  
  // Time expressions
  { pattern: /^(after|before|since|during)\s+\d+\s+(day|week|month|year)/i, reason: "Time expression without product insight" },
  { pattern: /^(so far|at first|in the end|at the moment)$/i, reason: "Time qualifier without content" },
  
  // Pronouns and articles
  { pattern: /^(i|we|he|she|it|they|you|my|your|his|her|their)\s/i, reason: "Starts with pronoun - likely fragment" },
  
  // Filler phrases
  { pattern: /^(in my opinion|to be honest|honestly|actually|basically)$/i, reason: "Filler phrase without insight" },
  { pattern: /^(all in all|overall|in general|generally speaking)$/i, reason: "Summary phrase without specific insight" },
]

// Check if phrase should be rejected
function shouldReject(phrase: string): { reject: boolean; reason: string } {
  const trimmed = phrase.trim().toLowerCase()
  
  // Too short
  if (trimmed.length < 4) {
    return { reject: true, reason: "Too short to be meaningful" }
  }
  
  // Check rejection patterns
  for (const { pattern, reason } of rejectionPatterns) {
    if (pattern.test(trimmed)) {
      return { reject: true, reason }
    }
  }
  
  // Check if all words are stop words
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does",
    "did", "will", "would", "could", "should", "may", "might", "can", "this", "that",
    "these", "those", "i", "you", "he", "she", "it", "we", "they", "my", "your", "his",
    "her", "its", "our", "their", "so", "very", "really", "just", "also", "now", "then",
    "not", "no", "yes", "all", "any", "some", "each", "every", "much", "many", "more"
  ])
  
  const words = trimmed.split(/\s+/)
  const meaningfulWords = words.filter(w => !stopWords.has(w))
  
  if (meaningfulWords.length === 0) {
    return { reject: true, reason: "Contains only stop words - no meaningful content" }
  }
  
  if (meaningfulWords.length < words.length * 0.4) {
    return { reject: true, reason: "Too many filler words - not actionable" }
  }
  
  return { reject: false, reason: "" }
}

// Find which canonical keyword a phrase belongs to
function findCanonicalMatch(phrase: string): { canonical: string; config: typeof keywordGroupings[string] } | null {
  const lowerPhrase = phrase.toLowerCase()
  
  for (const [canonical, config] of Object.entries(keywordGroupings)) {
    for (const variant of config.variants) {
      // Check if phrase contains the variant or variant contains the phrase
      if (lowerPhrase.includes(variant) || variant.includes(lowerPhrase)) {
        return { canonical, config }
      }
    }
  }
  
  return null
}

// Extract n-grams from text
function extractNGrams(text: string, minN: number = 2, maxN: number = 4): string[] {
  const cleanText = text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  
  const words = cleanText.split(" ").filter(w => w.length > 1)
  const ngrams: string[] = []
  
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n).join(" ")
      ngrams.push(ngram)
    }
  }
  
  return ngrams
}

// Calculate sentiment from review
function calculateSentiment(phrase: string, reviewSentiment: Sentiment): { sentiment: Sentiment; score: number } {
  const positiveIndicators = ["great", "amazing", "excellent", "love", "best", "perfect", "fantastic", "awesome", "good"]
  const negativeIndicators = ["bad", "terrible", "awful", "worst", "hate", "poor", "disappointing", "issue", "problem"]
  
  const lowerPhrase = phrase.toLowerCase()
  let score = reviewSentiment === "positive" ? 0.5 : reviewSentiment === "negative" ? -0.5 : 0
  
  for (const word of positiveIndicators) {
    if (lowerPhrase.includes(word)) score += 0.2
  }
  for (const word of negativeIndicators) {
    if (lowerPhrase.includes(word)) score -= 0.2
  }
  
  score = Math.max(-1, Math.min(1, score))
  const sentiment: Sentiment = score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral"
  
  return { sentiment, score }
}

// Main extraction function
export function extractRefinedKeywords(reviews: AnalyzedReview[]): RefinedKeywordResult {
  const keywordData = new Map<string, {
    variants: Map<string, number>
    totalMentions: number
    sentimentScores: number[]
    contexts: string[]
    config: typeof keywordGroupings[string]
  }>()
  
  const rejectedPhrases: RejectedPhrase[] = []
  const seenRejected = new Set<string>()
  
  // Process each review
  for (const review of reviews) {
    const fullText = `${review["Review Title"]} ${review["Review Text"]}`
    const ngrams = extractNGrams(fullText)
    const seenPhrasesInReview = new Set<string>()
    const seenCanonicalInReview = new Set<string>() // Track canonical keywords per review
    
    for (const phrase of ngrams) {
      // Skip if already seen this exact phrase in this review
      if (seenPhrasesInReview.has(phrase)) continue
      
      // Check for rejection
      const rejection = shouldReject(phrase)
      if (rejection.reject) {
        if (!seenRejected.has(phrase) && rejectedPhrases.length < 50) {
          rejectedPhrases.push({ phrase, reason: rejection.reason })
          seenRejected.add(phrase)
        }
        continue
      }
      
      // Try to match to canonical keyword
      const match = findCanonicalMatch(phrase)
      if (!match) continue // No match found - skip
      
      seenPhrasesInReview.add(phrase)
      
      const { canonical, config } = match
      
      if (!keywordData.has(canonical)) {
        keywordData.set(canonical, {
          variants: new Map(),
          totalMentions: 0,
          positiveCount: 0,
          sentimentScores: [],
          contexts: [],
          config
        })
      }
      
      const data = keywordData.get(canonical)!
      
      // Only count once per review per canonical keyword
      if (!seenCanonicalInReview.has(canonical)) {
        data.totalMentions++
        if (review.sentiment === "positive") {
          data.positiveCount++
        }
        seenCanonicalInReview.add(canonical)
      }
      
      // Still track all variant phrases
      data.variants.set(phrase, (data.variants.get(phrase) || 0) + 1)
      
      // Track sentiment
      const { score } = calculateSentiment(phrase, review.sentiment)
      data.sentimentScores.push(score)
      
      // Track context (sample review excerpts)
      if (data.contexts.length < 3) {
        const excerpt = review["Review Text"].slice(0, 150) + (review["Review Text"].length > 150 ? "..." : "")
        if (!data.contexts.includes(excerpt)) {
          data.contexts.push(excerpt)
        }
      }
    }
  }
  
  // Convert to result format
  const acceptedKeywords: CanonicalKeyword[] = []
  
  for (const [canonical, data] of keywordData) {
    if (data.totalMentions < 2) continue // Skip rare mentions
    
    const avgScore = data.sentimentScores.length > 0
      ? data.sentimentScores.reduce((a, b) => a + b, 0) / data.sentimentScores.length
      : 0
    
    const sentiment: Sentiment = avgScore > 0.15 ? "positive" : avgScore < -0.15 ? "negative" : "neutral"
    
    // Get variants sorted by frequency
    const variants = Array.from(data.variants.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v)
    
    acceptedKeywords.push({
      canonical,
      variants,
      type: data.config.type,
      relevanceReason: data.config.reason,
      totalMentions: data.totalMentions,
      sentiment,
      sentimentScore: avgScore,
      positivePercentage: data.totalMentions > 0 ? Math.round((data.positiveCount / data.totalMentions) * 100) : 0,
      sampleContexts: data.contexts,
      aspectCategory: data.config.aspect
    })
  }
  
  // Sort by total mentions
  acceptedKeywords.sort((a, b) => b.totalMentions - a.totalMentions)
  
  // Build summary
  const byType: Record<KeywordType, number> = {
    feature: 0,
    pain_point: 0,
    comparison: 0,
    purchase_intent: 0,
    use_case: 0,
    perception: 0
  }
  
  for (const kw of acceptedKeywords) {
    byType[kw.type]++
  }
  
  return {
    acceptedKeywords,
    rejectedPhrases: rejectedPhrases.slice(0, 20), // Limit rejected phrases shown
    summary: {
      totalAccepted: acceptedKeywords.length,
      totalRejected: rejectedPhrases.length,
      byType
    }
  }
}
