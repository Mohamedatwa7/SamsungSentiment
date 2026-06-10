import type { AnalyzedReview, Sentiment } from "./reviews-data"

// Intent categories for product reviews
export type IntentCategory = 
  | "praise"           // Direct positive statement about product
  | "complaint"        // Direct negative statement  
  | "comparison"       // Comparing to other products/versions
  | "feature_request"  // Asking for features
  | "purchase_intent"  // Buying decision language
  | "recommendation"   // Recommending or not recommending
  | "question"         // Asking about product
  | "experience"       // Describing usage experience

// Product aspect categories
export type AspectCategory =
  | "camera"
  | "display"
  | "battery"
  | "performance"
  | "design"
  | "software"
  | "audio"
  | "price"
  | "durability"
  | "ai_features"
  | "connectivity"
  | "storage"
  | "general"

// Extracted keyword with context
export interface ExtractedKeyword {
  phrase: string
  count: number
  intent: IntentCategory
  aspect: AspectCategory
  sentiment: Sentiment
  sentimentScore: number // -1 to 1
  coOccurrences: string[] // Other phrases commonly appearing with this one
  sampleReviews: string[] // Up to 3 sample review IDs
  trendDirection: "rising" | "stable" | "declining" | null
}

// Intent detection patterns
const intentPatterns: Record<IntentCategory, RegExp[]> = {
  praise: [
    /love\s+(?:the|my|this)/i,
    /(?:really|absolutely|totally)\s+(?:love|like|enjoy)/i,
    /(?:best|amazing|excellent|perfect|outstanding|fantastic|incredible)\s+\w+/i,
    /impressed\s+(?:with|by)/i,
    /exceeded?\s+(?:my\s+)?expectations?/i,
  ],
  complaint: [
    /(?:hate|dislike|disappointed)\s+(?:the|with|by)/i,
    /(?:terrible|awful|horrible|worst|poor)\s+\w+/i,
    /(?:doesn't|does\s+not|didn't|won't)\s+work/i,
    /(?:issue|problem|bug|defect|broken)\s+(?:with|in)/i,
    /waste\s+of\s+(?:money|time)/i,
  ],
  comparison: [
    /(?:better|worse|same)\s+(?:than|as)\s+(?:my|the)?\s*(?:old|previous|last|iphone|pixel|s\d+)/i,
    /compared\s+to/i,
    /upgrade(?:d)?\s+from/i,
    /switch(?:ed|ing)?\s+from/i,
    /(?:vs|versus|over)\s+(?:iphone|pixel|s\d+)/i,
  ],
  feature_request: [
    /(?:wish|hope|want|need)\s+(?:it|they|samsung)\s+(?:had|would|could)/i,
    /(?:should|could)\s+(?:have|add|include)/i,
    /(?:missing|lacks?|needs?)\s+\w+/i,
    /would\s+be\s+(?:nice|great|better)\s+(?:if|to)/i,
  ],
  purchase_intent: [
    /(?:bought|purchased|ordered|got)\s+(?:this|the|my)/i,
    /(?:buying|getting|ordering)\s+(?:this|another|more)/i,
    /worth\s+(?:the|every)\s+(?:money|penny|dollar|dirham)/i,
    /(?:will|won't|would|wouldn't)\s+buy/i,
    /return(?:ed|ing)?\s+(?:it|this|the)/i,
  ],
  recommendation: [
    /(?:highly\s+)?recommend/i,
    /(?:don't|do\s+not|wouldn't)\s+recommend/i,
    /(?:must|should)\s+(?:have|get|buy)/i,
    /(?:tell|told)\s+(?:everyone|friends|family)/i,
  ],
  question: [
    /(?:does|can|will|is)\s+(?:it|this|the)\s+\w+\?/i,
    /how\s+(?:do|does|can|is)/i,
    /(?:anyone|somebody)\s+(?:know|experience)/i,
  ],
  experience: [
    /(?:been|have\s+been)\s+using/i,
    /(?:after|since)\s+\d+\s+(?:day|week|month)/i,
    /(?:daily|everyday|regular)\s+use/i,
    /(?:my|the)\s+experience/i,
  ],
}

// Aspect detection with weighted keywords
const aspectKeywords: Record<AspectCategory, { keywords: string[]; weight: number }[]> = {
  camera: [
    { keywords: ["camera", "photo", "photograph", "picture", "pic"], weight: 1 },
    { keywords: ["zoom", "telephoto", "optical", "10x", "100x", "space zoom"], weight: 1.2 },
    { keywords: ["portrait", "portrait mode", "bokeh", "blur"], weight: 1 },
    { keywords: ["night mode", "nightography", "low light", "dark"], weight: 1.2 },
    { keywords: ["video", "recording", "4k", "8k", "slow motion", "slo-mo"], weight: 1 },
    { keywords: ["selfie", "front camera", "front facing"], weight: 0.8 },
    { keywords: ["200mp", "megapixel", "sensor", "lens"], weight: 1.2 },
    { keywords: ["pro mode", "expert raw", "manual"], weight: 1 },
  ],
  display: [
    { keywords: ["display", "screen"], weight: 1 },
    { keywords: ["amoled", "oled", "dynamic amoled"], weight: 1.2 },
    { keywords: ["brightness", "bright", "outdoor", "sunlight"], weight: 1 },
    { keywords: ["resolution", "qhd", "fhd", "pixel density", "ppi"], weight: 1 },
    { keywords: ["refresh rate", "120hz", "hz", "smooth scrolling"], weight: 1.2 },
    { keywords: ["viewing angle", "anti-glare", "gorilla glass", "victus"], weight: 1 },
    { keywords: ["privacy display", "privacy screen", "anti-peep"], weight: 1.5 },
  ],
  battery: [
    { keywords: ["battery", "battery life"], weight: 1 },
    { keywords: ["charge", "charging", "charger"], weight: 1 },
    { keywords: ["fast charging", "super fast", "45w", "25w"], weight: 1.2 },
    { keywords: ["wireless charging", "powershare", "reverse"], weight: 1.1 },
    { keywords: ["drain", "draining", "last", "lasts", "sot", "screen on time"], weight: 1 },
    { keywords: ["mah", "5000mah", "4000mah"], weight: 0.9 },
  ],
  performance: [
    { keywords: ["performance", "perform", "performs"], weight: 1 },
    { keywords: ["fast", "speed", "speedy", "quick", "snappy"], weight: 1 },
    { keywords: ["smooth", "smoothness", "lag", "laggy", "stutter"], weight: 1 },
    { keywords: ["snapdragon", "exynos", "processor", "chip", "chipset"], weight: 1.2 },
    { keywords: ["ram", "memory", "8gb", "12gb", "16gb"], weight: 1 },
    { keywords: ["multitask", "multitasking", "split screen"], weight: 1 },
    { keywords: ["game", "gaming", "fps", "frame rate"], weight: 1.1 },
    { keywords: ["heat", "heating", "hot", "warm", "thermal"], weight: 1.1 },
  ],
  design: [
    { keywords: ["design", "look", "looks", "aesthetic"], weight: 1 },
    { keywords: ["build", "build quality", "premium", "quality"], weight: 1 },
    { keywords: ["thin", "slim", "lightweight", "light", "heavy", "weight"], weight: 1 },
    { keywords: ["color", "colour", "titanium", "gray", "black", "violet"], weight: 0.9 },
    { keywords: ["grip", "slippery", "feel", "hand feel", "in hand"], weight: 1 },
    { keywords: ["bezels", "bezel", "edge", "curved", "flat"], weight: 1 },
  ],
  software: [
    { keywords: ["software", "one ui", "oneui", "ui"], weight: 1 },
    { keywords: ["update", "updates", "android", "android 15"], weight: 1 },
    { keywords: ["feature", "features"], weight: 0.8 },
    { keywords: ["app", "apps", "application"], weight: 0.8 },
    { keywords: ["bug", "bugs", "glitch", "crash", "freeze"], weight: 1.2 },
    { keywords: ["bloatware", "bloat", "pre-installed"], weight: 1.1 },
  ],
  audio: [
    { keywords: ["sound", "audio", "speaker", "speakers"], weight: 1 },
    { keywords: ["music", "listening", "podcast"], weight: 0.9 },
    { keywords: ["call", "calls", "call quality", "microphone", "mic"], weight: 1 },
    { keywords: ["dolby", "atmos", "stereo"], weight: 1.1 },
    { keywords: ["loud", "loudness", "volume", "bass"], weight: 1 },
  ],
  price: [
    { keywords: ["price", "pricing", "cost", "costs"], weight: 1 },
    { keywords: ["expensive", "pricey", "overpriced"], weight: 1.2 },
    { keywords: ["cheap", "affordable", "budget"], weight: 1 },
    { keywords: ["value", "worth", "money"], weight: 1 },
    { keywords: ["deal", "discount", "sale", "offer"], weight: 0.9 },
    { keywords: ["trade", "trade-in", "exchange"], weight: 0.9 },
  ],
  durability: [
    { keywords: ["durable", "durability", "sturdy", "solid"], weight: 1 },
    { keywords: ["drop", "dropped", "fall", "crack", "cracked"], weight: 1.2 },
    { keywords: ["waterproof", "water resistant", "ip68", "ip67"], weight: 1.1 },
    { keywords: ["scratch", "scratched", "scratches"], weight: 1 },
    { keywords: ["case", "cover", "protection", "screen protector"], weight: 0.8 },
  ],
  ai_features: [
    { keywords: ["ai", "artificial intelligence"], weight: 1 },
    { keywords: ["galaxy ai", "samsung ai"], weight: 1.5 },
    { keywords: ["gemini", "google ai", "bixby"], weight: 1.2 },
    { keywords: ["smart", "intelligent", "assistant"], weight: 0.9 },
    { keywords: ["circle to search", "circle search", "live translate"], weight: 1.3 },
    { keywords: ["photo assist", "edit suggestion", "generative"], weight: 1.2 },
  ],
  connectivity: [
    { keywords: ["5g", "network", "signal", "reception"], weight: 1 },
    { keywords: ["wifi", "wi-fi", "bluetooth"], weight: 1 },
    { keywords: ["gps", "location"], weight: 0.9 },
    { keywords: ["esim", "dual sim", "sim"], weight: 1 },
    { keywords: ["nfc", "samsung pay", "contactless"], weight: 1 },
  ],
  storage: [
    { keywords: ["storage", "space", "memory"], weight: 1 },
    { keywords: ["256gb", "512gb", "1tb", "gigabyte"], weight: 1 },
    { keywords: ["sd card", "expandable", "micro sd"], weight: 1.1 },
    { keywords: ["full", "running out", "not enough"], weight: 0.9 },
  ],
  general: [
    { keywords: ["phone", "device", "samsung", "galaxy"], weight: 0.5 },
    { keywords: ["overall", "general", "in general"], weight: 0.5 },
  ],
}

// N-gram extraction (phrases of 2-4 words)
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

// Detect intent from text
function detectIntent(text: string): IntentCategory {
  const lowerText = text.toLowerCase()
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerText)) {
        return intent as IntentCategory
      }
    }
  }
  
  return "experience" // Default to experience if no specific intent detected
}

// Detect aspect from phrase
function detectAspect(phrase: string): { aspect: AspectCategory; confidence: number } {
  const lowerPhrase = phrase.toLowerCase()
  let bestAspect: AspectCategory = "general"
  let bestScore = 0
  
  for (const [aspect, keywordGroups] of Object.entries(aspectKeywords)) {
    for (const group of keywordGroups) {
      for (const keyword of group.keywords) {
        if (lowerPhrase.includes(keyword)) {
          const score = group.weight * keyword.length // Longer matches score higher
          if (score > bestScore) {
            bestScore = score
            bestAspect = aspect as AspectCategory
          }
        }
      }
    }
  }
  
  return { aspect: bestAspect, confidence: bestScore }
}

// Calculate sentiment score for a phrase based on context
function calculateSentimentScore(phrase: string, reviewSentiment: Sentiment): number {
  const positiveModifiers = ["amazing", "excellent", "great", "love", "best", "perfect", "incredible", "fantastic", "outstanding"]
  const negativeModifiers = ["terrible", "awful", "horrible", "worst", "hate", "poor", "bad", "disappointing", "frustrating"]
  const intensifiers = ["very", "really", "extremely", "absolutely", "totally", "completely", "incredibly"]
  
  const lowerPhrase = phrase.toLowerCase()
  let score = reviewSentiment === "positive" ? 0.5 : reviewSentiment === "negative" ? -0.5 : 0
  
  // Adjust based on modifiers in phrase
  for (const mod of positiveModifiers) {
    if (lowerPhrase.includes(mod)) score += 0.3
  }
  for (const mod of negativeModifiers) {
    if (lowerPhrase.includes(mod)) score -= 0.3
  }
  for (const int of intensifiers) {
    if (lowerPhrase.includes(int)) score *= 1.2
  }
  
  return Math.max(-1, Math.min(1, score)) // Clamp to [-1, 1]
}

// Main extraction pipeline
export interface KeywordExtractionResult {
  keywords: ExtractedKeyword[]
  aspectSummary: Record<AspectCategory, { count: number; avgSentiment: number }>
  intentSummary: Record<IntentCategory, number>
  topPhrases: { phrase: string; count: number; sentiment: Sentiment }[]
}

export function extractProductKeywords(reviews: AnalyzedReview[]): KeywordExtractionResult {
  const phraseMap = new Map<string, {
    count: number
    intents: Map<IntentCategory, number>
    aspects: Map<AspectCategory, number>
    sentimentScores: number[]
    reviewIds: string[]
    coOccurring: Map<string, number>
  }>()
  
  // Process each review
  for (const review of reviews) {
    const fullText = `${review["Review Title"]} ${review["Review Text"]}`
    const ngrams = extractNGrams(fullText)
    const reviewIntent = detectIntent(fullText)
    const seenInReview = new Set<string>()
    
    for (const phrase of ngrams) {
      // Skip generic/stop phrases
      if (isStopPhrase(phrase)) continue
      
      // Only include phrases related to product aspects
      const { aspect, confidence } = detectAspect(phrase)
      if (confidence < 1 && aspect === "general") continue // Skip low-confidence general phrases
      
      if (!phraseMap.has(phrase)) {
        phraseMap.set(phrase, {
          count: 0,
          intents: new Map(),
          aspects: new Map(),
          sentimentScores: [],
          reviewIds: [],
          coOccurring: new Map(),
        })
      }
      
      const data = phraseMap.get(phrase)!
      
      if (!seenInReview.has(phrase)) {
        data.count++
        seenInReview.add(phrase)
        
        // Track intent
        const prevIntent = data.intents.get(reviewIntent) || 0
        data.intents.set(reviewIntent, prevIntent + 1)
        
        // Track aspect
        const prevAspect = data.aspects.get(aspect) || 0
        data.aspects.set(aspect, prevAspect + 1)
        
        // Track sentiment
        const sentimentScore = calculateSentimentScore(phrase, review.sentiment)
        data.sentimentScores.push(sentimentScore)
        
        // Track review IDs (max 3)
        if (data.reviewIds.length < 3) {
          data.reviewIds.push(review["Review ID"])
        }
      }
    }
    
    // Track co-occurrences
    const phrasesInReview = Array.from(seenInReview)
    for (let i = 0; i < phrasesInReview.length; i++) {
      for (let j = i + 1; j < phrasesInReview.length; j++) {
        const p1 = phrasesInReview[i]
        const p2 = phrasesInReview[j]
        
        const data1 = phraseMap.get(p1)!
        const data2 = phraseMap.get(p2)!
        
        data1.coOccurring.set(p2, (data1.coOccurring.get(p2) || 0) + 1)
        data2.coOccurring.set(p1, (data2.coOccurring.get(p1) || 0) + 1)
      }
    }
  }
  
  // Convert to result format
  const keywords: ExtractedKeyword[] = []
  
  for (const [phrase, data] of phraseMap) {
    if (data.count < 3) continue // Skip rare phrases
    
    // Get dominant intent
    let dominantIntent: IntentCategory = "experience"
    let maxIntentCount = 0
    for (const [intent, count] of data.intents) {
      if (count > maxIntentCount) {
        dominantIntent = intent
        maxIntentCount = count
      }
    }
    
    // Get dominant aspect
    let dominantAspect: AspectCategory = "general"
    let maxAspectCount = 0
    for (const [aspect, count] of data.aspects) {
      if (count > maxAspectCount) {
        dominantAspect = aspect
        maxAspectCount = count
      }
    }
    
    // Calculate average sentiment
    const avgSentiment = data.sentimentScores.reduce((a, b) => a + b, 0) / data.sentimentScores.length
    const sentiment: Sentiment = avgSentiment > 0.2 ? "positive" : avgSentiment < -0.2 ? "negative" : "neutral"
    
    // Get top co-occurrences
    const coOccurrences = Array.from(data.coOccurring.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([p]) => p)
    
    keywords.push({
      phrase,
      count: data.count,
      intent: dominantIntent,
      aspect: dominantAspect,
      sentiment,
      sentimentScore: avgSentiment,
      coOccurrences,
      sampleReviews: data.reviewIds,
      trendDirection: null, // Would need temporal data to calculate
    })
  }
  
  // Sort by count
  keywords.sort((a, b) => b.count - a.count)
  
  // Build aspect summary
  const aspectSummary: Record<AspectCategory, { count: number; avgSentiment: number }> = {} as any
  for (const aspect of Object.keys(aspectKeywords) as AspectCategory[]) {
    const aspectKeywords = keywords.filter(k => k.aspect === aspect)
    aspectSummary[aspect] = {
      count: aspectKeywords.reduce((sum, k) => sum + k.count, 0),
      avgSentiment: aspectKeywords.length > 0 
        ? aspectKeywords.reduce((sum, k) => sum + k.sentimentScore, 0) / aspectKeywords.length 
        : 0
    }
  }
  
  // Build intent summary
  const intentSummary: Record<IntentCategory, number> = {} as any
  for (const intent of Object.keys(intentPatterns) as IntentCategory[]) {
    intentSummary[intent] = keywords.filter(k => k.intent === intent).reduce((sum, k) => sum + k.count, 0)
  }
  
  // Top phrases (simplified)
  const topPhrases = keywords.slice(0, 50).map(k => ({
    phrase: k.phrase,
    count: k.count,
    sentiment: k.sentiment
  }))
  
  return {
    keywords: keywords.slice(0, 100), // Top 100 keywords
    aspectSummary,
    intentSummary,
    topPhrases
  }
}

// Stop phrases to filter out
function isStopPhrase(phrase: string): boolean {
  const stopPhrases = [
    "the phone", "this phone", "my phone", "a phone", "the device", "this device",
    "i have", "i am", "i was", "i will", "it is", "it was", "it has", "there is",
    "and the", "with the", "for the", "in the", "on the", "to the", "of the",
    "is a", "is the", "was a", "was the", "has a", "has the", "have a", "have the",
    "so far", "so good", "at all", "as well", "a lot", "a bit", "at first",
    "i would", "i could", "i think", "i feel", "i love", "i like", "i got",
    "very good", "very nice", "very happy", "really good", "really nice", "really happy",
    "much better", "much more", "the best", "the only", "the new", "the old",
  ]
  
  const lowerPhrase = phrase.toLowerCase()
  
  // Check if phrase is in stop list
  if (stopPhrases.includes(lowerPhrase)) return true
  
  // Check if phrase is too generic (all stop words)
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does",
    "did", "will", "would", "could", "should", "may", "might", "can", "this", "that",
    "these", "those", "i", "you", "he", "she", "it", "we", "they", "my", "your", "his",
    "her", "its", "our", "their", "so", "very", "really", "just", "also", "now", "then"
  ])
  
  const words = lowerPhrase.split(" ")
  const nonStopWords = words.filter(w => !stopWords.has(w))
  
  // If more than half are stop words, skip
  if (nonStopWords.length < words.length / 2) return true
  
  return false
}

// Get keywords by aspect
export function getKeywordsByAspect(result: KeywordExtractionResult, aspect: AspectCategory): ExtractedKeyword[] {
  return result.keywords.filter(k => k.aspect === aspect)
}

// Get keywords by intent
export function getKeywordsByIntent(result: KeywordExtractionResult, intent: IntentCategory): ExtractedKeyword[] {
  return result.keywords.filter(k => k.intent === intent)
}

// Get keywords by sentiment
export function getKeywordsBySentiment(result: KeywordExtractionResult, sentiment: Sentiment): ExtractedKeyword[] {
  return result.keywords.filter(k => k.sentiment === sentiment)
}
