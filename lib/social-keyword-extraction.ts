import type { Comment, Sentiment } from "./comments-data"

// Keyword types based on commercial and product relevance
export type KeywordType = 
  | "feature"         // Product feature or capability
  | "pain_point"      // Issue, problem, or negative experience
  | "comparison"      // Comparison to competitors or previous models
  | "purchase_intent" // Buying decision language, value assessment
  | "use_case"        // How customers use the product
  | "perception"      // Brand/product perception and sentiment

// Canonical keyword with grouped variants
export interface SocialCanonicalKeyword {
  canonical: string           // The main/canonical keyword
  variants: string[]          // All phrases grouped under this keyword
  type: KeywordType           // Classification type
  relevanceReason: string     // Why this keyword is relevant
  totalMentions: number       // Sum of all variant mentions
  sentiment: Sentiment        // Overall sentiment
  sentimentScore: number      // -1 to 1
  positivePercentage: number  // Percentage of positive comments
  sampleContexts: string[]    // Sample comment excerpts (up to 3)
  aspectCategory: string      // Product aspect (camera, battery, etc.)
}

// Rejection record for transparency
export interface RejectedPhrase {
  phrase: string
  reason: string
}

// Result structure
export interface SocialKeywordResult {
  acceptedKeywords: SocialCanonicalKeyword[]
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
    variants: ["camera quality", "camera is good", "camera is great", "camera is amazing", "photo quality", "picture quality", "image quality", "camera performance", "كاميرا", "الكاميرا", "تصوير"],
    type: "feature",
    reason: "Core product capability - primary purchase driver for flagship phones",
    aspect: "camera"
  },
  "zoom capability": {
    variants: ["zoom", "optical zoom", "space zoom", "10x zoom", "100x zoom", "telephoto", "zoom lens", "zoom quality", "zoom camera", "زوم"],
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
    variants: ["video quality", "video recording", "4k video", "8k video", "video camera", "filming", "video mode", "فيديو"],
    type: "feature",
    reason: "Important media creation capability",
    aspect: "camera"
  },
  
  // Display Features
  "display quality": {
    variants: ["display", "screen", "display quality", "screen quality", "beautiful display", "gorgeous screen", "شاشة", "الشاشة"],
    type: "feature",
    reason: "Core hardware feature affecting daily user experience",
    aspect: "display"
  },
  
  // Battery Features
  "battery life": {
    variants: ["battery", "battery life", "battery backup", "battery performance", "charging", "بطارية", "الشحن"],
    type: "feature",
    reason: "Critical daily usability factor",
    aspect: "battery"
  },
  "fast charging": {
    variants: ["fast charging", "quick charge", "45w charging", "super fast", "charging speed"],
    type: "feature",
    reason: "Premium feature addressing battery anxiety",
    aspect: "battery"
  },
  
  // Performance
  "performance": {
    variants: ["performance", "speed", "fast", "smooth", "snapdragon", "processor", "سرعة", "سريع"],
    type: "feature",
    reason: "Core device capability affecting user experience",
    aspect: "performance"
  },
  "gaming": {
    variants: ["gaming", "games", "pubg", "call of duty", "fortnite", "ألعاب"],
    type: "use_case",
    reason: "Key use case for flagship devices",
    aspect: "performance"
  },
  
  // AI Features
  "galaxy ai": {
    variants: ["galaxy ai", "ai features", "circle to search", "live translate", "photo assist", "ai", "ذكاء اصطناعي"],
    type: "feature",
    reason: "New differentiating feature set for S24/S25/S26 series",
    aspect: "ai"
  },
  
  // Design
  "design": {
    variants: ["design", "look", "color", "beautiful", "premium", "تصميم", "لون", "شكل"],
    type: "feature",
    reason: "Important aesthetic and brand perception factor",
    aspect: "design"
  },
  "titanium frame": {
    variants: ["titanium", "titanium frame", "build quality", "premium build"],
    type: "feature",
    reason: "Premium material differentiator",
    aspect: "design"
  },
  
  // S Pen
  "s pen": {
    variants: ["s pen", "stylus", "s-pen", "pen", "قلم"],
    type: "feature",
    reason: "Unique differentiating feature for Ultra models",
    aspect: "s_pen"
  },
  
  // Price/Value
  "price": {
    variants: ["price", "expensive", "cost", "value", "worth", "money", "afford", "سعر", "غالي", "ثمن"],
    type: "purchase_intent",
    reason: "Direct purchase decision factor",
    aspect: "price"
  },
  
  // Comparisons
  "iphone comparison": {
    variants: ["iphone", "apple", "ios", "ايفون", "آيفون"],
    type: "comparison",
    reason: "Primary competitor comparison",
    aspect: "comparison"
  },
  "upgrade": {
    variants: ["upgrade", "switch", "trade", "new phone", "ترقية"],
    type: "purchase_intent",
    reason: "Purchase intent signal",
    aspect: "general"
  },
  
  // Pain Points
  "overheating": {
    variants: ["hot", "heat", "overheating", "warm", "temperature", "حرارة", "سخونة"],
    type: "pain_point",
    reason: "Common issue affecting user experience",
    aspect: "performance"
  },
  "software issues": {
    variants: ["bug", "bugs", "crash", "lag", "slow", "glitch", "one ui", "مشكلة"],
    type: "pain_point",
    reason: "Software quality concern",
    aspect: "software"
  },
  
  // Perception
  "samsung brand": {
    variants: ["samsung", "galaxy", "سامسونج", "جالكسي"],
    type: "perception",
    reason: "Brand perception and loyalty indicator",
    aspect: "general"
  },
  "best phone": {
    variants: ["best phone", "best device", "number one", "top", "افضل", "أفضل"],
    type: "perception",
    reason: "Overall product perception",
    aspect: "general"
  }
}

// Phrases to reject
const rejectionPatterns: { pattern: RegExp | string; reason: string }[] = [
  // Generic/filler
  { pattern: /^(the|a|an|this|that|it|is|are|was|were)$/i, reason: "Generic article/pronoun" },
  { pattern: /^(very|really|so|just|only|even|also|too)$/i, reason: "Generic intensifier" },
  { pattern: /^(good|bad|nice|great|wow|cool|ok|okay)$/i, reason: "Generic sentiment without context" },
  { pattern: /^(yes|no|yeah|yep|nope|sure)$/i, reason: "Conversational filler" },
  { pattern: /^(please|thanks|thank|congrats|hi|hello|hey)$/i, reason: "Social pleasantry" },
  { pattern: /^(haha|lol|lmao|😂|🔥|❤️|👍)$/i, reason: "Emoji/reaction" },
  { pattern: /^\d+$/, reason: "Pure number" },
  { pattern: /^.{1,2}$/, reason: "Too short" },
]

function shouldReject(phrase: string): { reject: boolean; reason: string } {
  const lower = phrase.toLowerCase().trim()
  
  if (lower.length < 3) {
    return { reject: true, reason: "Too short to be meaningful" }
  }
  
  for (const { pattern, reason } of rejectionPatterns) {
    if (typeof pattern === "string") {
      if (lower === pattern.toLowerCase()) {
        return { reject: true, reason }
      }
    } else if (pattern.test(lower)) {
      return { reject: true, reason }
    }
  }
  
  return { reject: false, reason: "" }
}

function findCanonicalMatch(phrase: string): { canonical: string; config: typeof keywordGroupings[string] } | null {
  const lower = phrase.toLowerCase()
  
  for (const [canonical, config] of Object.entries(keywordGroupings)) {
    for (const variant of config.variants) {
      if (lower.includes(variant.toLowerCase()) || variant.toLowerCase().includes(lower)) {
        return { canonical, config }
      }
    }
  }
  
  return null
}

function extractNGrams(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2)
  
  const ngrams: string[] = []
  
  // Unigrams
  ngrams.push(...words)
  
  // Bigrams
  for (let i = 0; i < words.length - 1; i++) {
    ngrams.push(`${words[i]} ${words[i + 1]}`)
  }
  
  // Trigrams
  for (let i = 0; i < words.length - 2; i++) {
    ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
  }
  
  return ngrams
}

function calculateSentiment(phrase: string, commentSentiment: Sentiment): { sentiment: Sentiment; score: number } {
  // Use comment-level sentiment as primary signal
  const score = commentSentiment === "positive" ? 1 : commentSentiment === "negative" ? -1 : 0
  return { sentiment: commentSentiment, score }
}

// Main extraction function
export function extractSocialKeywords(comments: Comment[], platformFilter?: ("instagram" | "tiktok")[]): SocialKeywordResult {
  // Filter by platform if specified
  const filteredComments = platformFilter && platformFilter.length > 0
    ? comments.filter(c => platformFilter.includes(c.platform))
    : comments
  
  const keywordData = new Map<string, {
    variants: Map<string, number>
    totalMentions: number
    positiveCount: number
    sentimentScores: number[]
    contexts: string[]
    config: typeof keywordGroupings[string]
  }>()
  
  const rejectedPhrases: RejectedPhrase[] = []
  const seenRejected = new Set<string>()
  
  // Process each comment
  for (const comment of filteredComments) {
    const ngrams = extractNGrams(comment.text)
    const seenPhrasesInComment = new Set<string>()
    const seenCanonicalInComment = new Set<string>()
    
    for (const phrase of ngrams) {
      if (seenPhrasesInComment.has(phrase)) continue
      
      const rejection = shouldReject(phrase)
      if (rejection.reject) {
        if (!seenRejected.has(phrase) && rejectedPhrases.length < 50) {
          rejectedPhrases.push({ phrase, reason: rejection.reason })
          seenRejected.add(phrase)
        }
        continue
      }
      
      const match = findCanonicalMatch(phrase)
      if (!match) continue
      
      seenPhrasesInComment.add(phrase)
      
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
      
      // Only count once per comment per canonical keyword
      if (!seenCanonicalInComment.has(canonical)) {
        data.totalMentions++
        if (comment.sentiment === "positive") {
          data.positiveCount++
        }
        seenCanonicalInComment.add(canonical)
      }
      
      data.variants.set(phrase, (data.variants.get(phrase) || 0) + 1)
      
      const { score } = calculateSentiment(phrase, comment.sentiment)
      data.sentimentScores.push(score)
      
      if (data.contexts.length < 3) {
        const excerpt = comment.text.slice(0, 100) + (comment.text.length > 100 ? "..." : "")
        if (!data.contexts.includes(excerpt)) {
          data.contexts.push(excerpt)
        }
      }
    }
  }
  
  // Convert to result format
  const acceptedKeywords: SocialCanonicalKeyword[] = []
  
  for (const [canonical, data] of keywordData) {
    if (data.totalMentions < 2) continue
    
    const avgScore = data.sentimentScores.length > 0
      ? data.sentimentScores.reduce((a, b) => a + b, 0) / data.sentimentScores.length
      : 0
    
    const sentiment: Sentiment = avgScore > 0.15 ? "positive" : avgScore < -0.15 ? "negative" : "neutral"
    
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
  
  acceptedKeywords.sort((a, b) => b.totalMentions - a.totalMentions)
  
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
    rejectedPhrases: rejectedPhrases.slice(0, 20),
    summary: {
      totalAccepted: acceptedKeywords.length,
      totalRejected: rejectedPhrases.length,
      byType
    }
  }
}
