import type { AnalyzedComment } from "./influencer-data"

// Intent categories for social media comments
export type CommentIntent = 
  | "praise"           // Direct positive statement
  | "complaint"        // Direct negative statement  
  | "comparison"       // Comparing to competitors (esp. iPhone)
  | "question"         // Asking about product
  | "experience"       // Describing usage experience
  | "recommendation"   // Recommending or warning others
  | "hype"             // Excitement/anticipation
  | "defense"          // Defending Samsung against criticism

// Product aspect categories
export type ProductAspect =
  | "camera"
  | "display"
  | "battery"
  | "performance"
  | "design"
  | "software"
  | "audio"
  | "price"
  | "ai_features"
  | "brand"
  | "competitor"
  | "general"

// Extracted keyword with context
export interface InfluencerKeyword {
  phrase: string
  count: number
  intent: CommentIntent
  aspect: ProductAspect
  sentiment: "positive" | "neutral" | "negative"
  sentimentScore: number // -1 to 1
  platforms: { tiktok: number; instagram: number }
  sampleComments: { text: string; username: string; platform: string }[]
}

// Intent detection patterns - English
const englishIntentPatterns: Record<CommentIntent, RegExp[]> = {
  praise: [
    /love\s+(?:the|my|this|it)/i,
    /(?:best|amazing|excellent|perfect|incredible|fire|goat|king)\s*\w*/i,
    /(?:so|very|really)\s+(?:good|nice|cool|sick|dope|lit)/i,
    /(?:impressed|blown away|mind blown)/i,
    /w+\s*(?:phone|camera|display)/i,
  ],
  complaint: [
    /(?:hate|dislike|disappointed|trash|garbage|mid)/i,
    /(?:terrible|awful|horrible|worst|overrated|overhyped)/i,
    /(?:doesn't|does\s*n't|won't|can't)\s+work/i,
    /(?:issue|problem|bug|broken|laggy)/i,
    /waste\s+of\s+money/i,
    /L\s+(?:phone|samsung|take)/i,
  ],
  comparison: [
    /(?:better|worse|same)\s+(?:than|as)\s+(?:iphone|apple|pixel)/i,
    /iphone\s+(?:still|is|remains|better|wins)/i,
    /(?:vs|versus|over|or)\s+(?:iphone|apple|pixel)/i,
    /switch(?:ed|ing)?\s+(?:from|to)\s+(?:iphone|samsung|android)/i,
    /(?:android|samsung)\s+(?:vs|over)\s+(?:ios|iphone)/i,
  ],
  question: [
    /(?:does|can|will|is|how)\s+(?:it|this|the)\s+\w+\??/i,
    /(?:anyone|somebody|who)\s+(?:know|tried|has)/i,
    /\?\s*$/,
    /(?:what|which|when|where|why|how)\s+/i,
  ],
  experience: [
    /(?:been|have\s+been)\s+using/i,
    /(?:after|since)\s+\d+\s+(?:day|week|month)/i,
    /(?:my|got|bought)\s+(?:s26|s25|s24|galaxy|samsung)/i,
    /(?:using|use|used)\s+(?:it|this|mine)/i,
  ],
  recommendation: [
    /(?:get|buy|cop)\s+(?:this|it|one)/i,
    /(?:don't|do\s*n't|never)\s+(?:get|buy|waste)/i,
    /(?:must|should|need\s+to)\s+(?:have|get|buy|cop)/i,
    /(?:highly\s+)?recommend/i,
    /(?:skip|pass|avoid)\s+(?:this|it)/i,
  ],
  hype: [
    /(?:can't|cannot)\s+wait/i,
    /(?:so|super|very)\s+(?:excited|hyped|pumped)/i,
    /(?:day\s+one|pre.?order|ordering)/i,
    /(?:finally|let's\s+go|yess+|omg)/i,
  ],
  defense: [
    /(?:samsung|android)\s+(?:haters?|fans)/i,
    /(?:stop|quit)\s+(?:hating|comparing)/i,
    /(?:both|all)\s+(?:phones?|are)\s+good/i,
    /(?:leave|let)\s+(?:samsung|people)\s+alone/i,
  ],
}

// Arabic intent patterns
const arabicIntentPatterns: Record<CommentIntent, RegExp[]> = {
  praise: [
    /(?:احب|عاشق|يجنن|روعة|خرافي|رهيب|ممتاز|جبار|فخم|اسطوري)/,
    /(?:افضل|احسن|اقوى)\s+(?:جوال|تلفون|كاميرا|شاشة)/,
    /(?:الله|ماشاء\s*الله|تبارك)/,
  ],
  complaint: [
    /(?:سيء|زفت|خايس|فاشل|مو\s+زين|ماعجبني)/,
    /(?:مشكلة|عيب|خراب)/,
    /(?:غالي|مكلف|سرقة|نصب)/,
    /(?:ندمت|ماكان|مايستاهل)/,
  ],
  comparison: [
    /(?:ايفون|آيفون|أيفون)\s+(?:احسن|افضل|اقوى|الملك|يفوز)/,
    /(?:سامسونج|جالكسي)\s+(?:vs|ضد|ولا)\s+(?:ايفون|آيفون)/,
    /(?:احسن|افضل)\s+(?:من|عن)\s+(?:ايفون|سامسونج)/,
  ],
  question: [
    /(?:كيف|ليش|متى|وين|شلون|هل)\s+/,
    /\؟\s*$/,
    /(?:احد|احد)\s+(?:جرب|عنده|يعرف)/,
  ],
  experience: [
    /(?:استخدم|استخدمت|عندي|اخذت|شريت)/,
    /(?:من|بعد)\s+(?:شهر|اسبوع|يوم|سنة)/,
  ],
  recommendation: [
    /(?:خذ|خذوا|اشتر|اشتروا)\s+(?:هذا|هالجوال)/,
    /(?:لاتاخذ|لاتشتر|تجنب)/,
    /(?:انصح|انصحكم|لازم)/,
  ],
  hype: [
    /(?:ماقدر\s+اصبر|منتظر|يلا)/,
    /(?:متحمس|حماس)/,
  ],
  defense: [
    /(?:خلوا|اتركوا)\s+(?:سامسونج|الناس)/,
    /(?:كلهم|الكل)\s+(?:حلو|زين)/,
  ],
}

// Aspect detection keywords - bilingual
const aspectKeywords: Record<ProductAspect, string[]> = {
  camera: [
    "camera", "photo", "picture", "zoom", "portrait", "night mode", "video", "selfie", "200mp", "lens",
    "كاميرا", "صور", "صورة", "زوم", "تصوير", "فيديو", "سيلفي", "عدسة"
  ],
  display: [
    "screen", "display", "amoled", "oled", "brightness", "120hz", "refresh", "resolution",
    "شاشة", "عرض", "سطوع", "دقة"
  ],
  battery: [
    "battery", "charge", "charging", "fast charge", "wireless", "drain", "last",
    "بطارية", "شحن", "يشحن", "يخلص"
  ],
  performance: [
    "fast", "speed", "smooth", "lag", "snapdragon", "exynos", "processor", "ram", "game", "gaming", "heat",
    "سريع", "سرعة", "معالج", "رام", "العاب", "حرارة", "يهنق"
  ],
  design: [
    "design", "look", "build", "premium", "thin", "color", "titanium", "weight", "feel",
    "تصميم", "شكل", "فخم", "لون", "تيتانيوم", "خفيف", "ثقيل"
  ],
  software: [
    "software", "one ui", "update", "android", "feature", "bug", "app",
    "نظام", "تحديث", "اندرويد", "تطبيق", "برنامج"
  ],
  audio: [
    "speaker", "sound", "audio", "music", "call", "mic", "dolby",
    "صوت", "سماعة", "موسيقى", "مكالمة"
  ],
  price: [
    "price", "expensive", "cheap", "value", "worth", "money", "cost", "deal",
    "سعر", "غالي", "رخيص", "قيمة", "فلوس", "يستاهل"
  ],
  ai_features: [
    "ai", "galaxy ai", "smart", "gemini", "circle to search", "translate", "assistant",
    "ذكاء", "ذكي", "مساعد"
  ],
  brand: [
    "samsung", "galaxy", "s26", "s25", "s24", "ultra", "fold", "flip",
    "سامسونج", "جالكسي", "الترا", "فولد", "فليب"
  ],
  competitor: [
    "iphone", "apple", "ios", "pixel", "xiaomi", "huawei", "oneplus",
    "ايفون", "آيفون", "أيفون", "ابل", "آبل", "بكسل", "شاومي", "هواوي"
  ],
  general: []
}

// Stop words to filter
const stopWords = new Set([
  // English
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "can", "this", "that", "these", "those",
  "i", "you", "he", "she", "it", "we", "they", "me", "my", "your", "his", "her", "its", "our", "their",
  "what", "which", "who", "when", "where", "why", "how", "all", "each", "every", "both", "few",
  "more", "most", "other", "some", "such", "no", "not", "only", "own", "same", "so", "than",
  "too", "very", "just", "also", "now", "here", "there", "then", "if", "about", "into", "as", "am",
  // Arabic
  "في", "من", "على", "الى", "إلى", "عن", "مع", "هذا", "هذه", "ذلك", "تلك", "التي", "الذي",
  "هو", "هي", "هم", "نحن", "انا", "أنا", "انت", "أنت", "كل", "بعض", "أي", "اي", "لا", "ما",
  "لم", "لن", "قد", "كان", "يكون", "كانت", "او", "أو", "و", "ان", "أن", "إن", "الي", "يا",
  "اللي", "دي", "ده", "كده", "بس", "زي", "عشان", "علشان", "كمان", "برضو", "بردو", "اللى",
  "فى", "علي", "دا", "كدة", "كدا", "الله", "لله"
])

// Remove emojis from text
function removeEmojis(text: string): string {
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "")
    .replace(/[\u{231A}-\u{231B}]/gu, "")
    .replace(/[\u{23E9}-\u{23F3}]/gu, "")
    .replace(/[\u{23F8}-\u{23FA}]/gu, "")
    .replace(/[\u{25AA}-\u{25AB}]/gu, "")
    .replace(/[\u{25B6}]/gu, "")
    .replace(/[\u{25C0}]/gu, "")
    .replace(/[\u{25FB}-\u{25FE}]/gu, "")
    .replace(/[\u{2B05}-\u{2B07}]/gu, "")
    .replace(/[\u{2B1B}-\u{2B1C}]/gu, "")
    .replace(/[\u{2B50}]/gu, "")
    .replace(/[\u{2B55}]/gu, "")
    .replace(/[\u{3030}]/gu, "")
    .replace(/[\u{303D}]/gu, "")
    .replace(/[\u{3297}]/gu, "")
    .replace(/[\u{3299}]/gu, "")
    .trim()
}

// Extract n-grams from text
function extractNGrams(text: string, minN: number = 2, maxN: number = 3): string[] {
  const cleanText = removeEmojis(text)
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  
  const words = cleanText.split(" ").filter(w => w.length > 1 && !stopWords.has(w))
  const ngrams: string[] = []
  
  // Add single important words (aspect keywords)
  for (const word of words) {
    if (isProductKeyword(word)) {
      ngrams.push(word)
    }
  }
  
  // Add n-grams
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n).join(" ")
      ngrams.push(ngram)
    }
  }
  
  return ngrams
}

// Check if word is a product-related keyword
function isProductKeyword(word: string): boolean {
  const lowerWord = word.toLowerCase()
  for (const keywords of Object.values(aspectKeywords)) {
    if (keywords.some(k => k.toLowerCase() === lowerWord)) {
      return true
    }
  }
  return false
}

// Detect intent from comment text
function detectIntent(text: string): CommentIntent {
  const cleanText = removeEmojis(text)
  
  // Check English patterns
  for (const [intent, patterns] of Object.entries(englishIntentPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(cleanText)) {
        return intent as CommentIntent
      }
    }
  }
  
  // Check Arabic patterns
  for (const [intent, patterns] of Object.entries(arabicIntentPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(cleanText)) {
        return intent as CommentIntent
      }
    }
  }
  
  return "experience"
}

// Detect aspect from phrase
function detectAspect(phrase: string): ProductAspect {
  const lowerPhrase = phrase.toLowerCase()
  
  for (const [aspect, keywords] of Object.entries(aspectKeywords)) {
    if (aspect === "general") continue
    for (const keyword of keywords) {
      if (lowerPhrase.includes(keyword.toLowerCase())) {
        return aspect as ProductAspect
      }
    }
  }
  
  return "general"
}

// Calculate sentiment score
function calculateSentimentScore(phrase: string, commentSentiment: "positive" | "neutral" | "negative"): number {
  const positiveWords = [
    "amazing", "excellent", "great", "love", "best", "perfect", "incredible", "fire", "goat", "king",
    "ممتاز", "رائع", "جميل", "احسن", "افضل", "خرافي", "جبار", "روعة"
  ]
  const negativeWords = [
    "terrible", "awful", "horrible", "worst", "hate", "poor", "bad", "trash", "mid", "overrated",
    "سيء", "زفت", "خايس", "فاشل", "غالي"
  ]
  
  const lowerPhrase = phrase.toLowerCase()
  let score = commentSentiment === "positive" ? 0.5 : commentSentiment === "negative" ? -0.5 : 0
  
  for (const word of positiveWords) {
    if (lowerPhrase.includes(word)) score += 0.25
  }
  for (const word of negativeWords) {
    if (lowerPhrase.includes(word)) score -= 0.25
  }
  
  return Math.max(-1, Math.min(1, score))
}

// Check if phrase should be filtered
function isStopPhrase(phrase: string): boolean {
  const words = phrase.split(" ")
  
  // All words are stop words
  if (words.every(w => stopWords.has(w.toLowerCase()))) return true
  
  // Too short
  if (phrase.length < 3) return true
  
  // Just numbers
  if (/^\d+$/.test(phrase.replace(/\s/g, ""))) return true
  
  return false
}

// Main extraction result interface
export interface InfluencerKeywordResult {
  keywords: InfluencerKeyword[]
  aspectSummary: { aspect: ProductAspect; count: number; avgSentiment: number; topPhrases: string[] }[]
  intentSummary: { intent: CommentIntent; count: number; percentage: number }[]
  topPraise: { phrase: string; count: number }[]
  topComplaints: { phrase: string; count: number }[]
  competitorMentions: { phrase: string; count: number; sentiment: "positive" | "neutral" | "negative" }[]
}

// Main extraction function
export function extractInfluencerKeywords(comments: AnalyzedComment[]): InfluencerKeywordResult {
  const phraseMap = new Map<string, {
    count: number
    intents: Map<CommentIntent, number>
    aspects: Map<ProductAspect, number>
    sentimentScores: number[]
    platforms: { tiktok: number; instagram: number }
    sampleComments: { text: string; username: string; platform: string }[]
  }>()
  
  // Process each comment
  for (const comment of comments) {
    const ngrams = extractNGrams(comment.text)
    const commentIntent = detectIntent(comment.text)
    const seenInComment = new Set<string>()
    
    for (const phrase of ngrams) {
      if (isStopPhrase(phrase)) continue
      
      const aspect = detectAspect(phrase)
      // Only keep phrases with product relevance
      if (aspect === "general" && !isProductKeyword(phrase.split(" ")[0])) continue
      
      if (!phraseMap.has(phrase)) {
        phraseMap.set(phrase, {
          count: 0,
          intents: new Map(),
          aspects: new Map(),
          sentimentScores: [],
          platforms: { tiktok: 0, instagram: 0 },
          sampleComments: []
        })
      }
      
      const data = phraseMap.get(phrase)!
      
      if (!seenInComment.has(phrase)) {
        data.count++
        seenInComment.add(phrase)
        
        // Track intent
        data.intents.set(commentIntent, (data.intents.get(commentIntent) || 0) + 1)
        
        // Track aspect
        data.aspects.set(aspect, (data.aspects.get(aspect) || 0) + 1)
        
        // Track sentiment
        data.sentimentScores.push(calculateSentimentScore(phrase, comment.sentiment))
        
        // Track platform
        if (comment.platform === "tiktok") data.platforms.tiktok++
        else data.platforms.instagram++
        
        // Track sample comments (max 3)
        if (data.sampleComments.length < 3) {
          data.sampleComments.push({
            text: removeEmojis(comment.text).slice(0, 100),
            username: comment.username,
            platform: comment.platform
          })
        }
      }
    }
  }
  
  // Convert to result format
  const keywords: InfluencerKeyword[] = []
  
  for (const [phrase, data] of phraseMap) {
    if (data.count < 3) continue // Skip rare phrases
    
    // Get dominant intent
    let dominantIntent: CommentIntent = "experience"
    let maxIntentCount = 0
    for (const [intent, count] of data.intents) {
      if (count > maxIntentCount) {
        dominantIntent = intent
        maxIntentCount = count
      }
    }
    
    // Get dominant aspect
    let dominantAspect: ProductAspect = "general"
    let maxAspectCount = 0
    for (const [aspect, count] of data.aspects) {
      if (count > maxAspectCount) {
        dominantAspect = aspect
        maxAspectCount = count
      }
    }
    
    // Calculate average sentiment
    const avgSentiment = data.sentimentScores.reduce((a, b) => a + b, 0) / data.sentimentScores.length
    const sentiment = avgSentiment > 0.15 ? "positive" : avgSentiment < -0.15 ? "negative" : "neutral"
    
    keywords.push({
      phrase,
      count: data.count,
      intent: dominantIntent,
      aspect: dominantAspect,
      sentiment,
      sentimentScore: avgSentiment,
      platforms: data.platforms,
      sampleComments: data.sampleComments
    })
  }
  
  // Sort by count
  keywords.sort((a, b) => b.count - a.count)
  
  // Build aspect summary
  const aspectCounts = new Map<ProductAspect, { count: number; sentimentSum: number; phrases: string[] }>()
  for (const kw of keywords) {
    if (!aspectCounts.has(kw.aspect)) {
      aspectCounts.set(kw.aspect, { count: 0, sentimentSum: 0, phrases: [] })
    }
    const data = aspectCounts.get(kw.aspect)!
    data.count += kw.count
    data.sentimentSum += kw.sentimentScore * kw.count
    if (data.phrases.length < 3) data.phrases.push(kw.phrase)
  }
  
  const aspectSummary = Array.from(aspectCounts.entries())
    .filter(([aspect]) => aspect !== "general")
    .map(([aspect, data]) => ({
      aspect,
      count: data.count,
      avgSentiment: data.sentimentSum / data.count,
      topPhrases: data.phrases
    }))
    .sort((a, b) => b.count - a.count)
  
  // Build intent summary
  const intentCounts = new Map<CommentIntent, number>()
  for (const kw of keywords) {
    intentCounts.set(kw.intent, (intentCounts.get(kw.intent) || 0) + kw.count)
  }
  const totalIntents = Array.from(intentCounts.values()).reduce((a, b) => a + b, 0)
  
  const intentSummary = Array.from(intentCounts.entries())
    .map(([intent, count]) => ({
      intent,
      count,
      percentage: Math.round((count / totalIntents) * 100)
    }))
    .sort((a, b) => b.count - a.count)
  
  // Get top praise phrases
  const topPraise = keywords
    .filter(k => k.sentiment === "positive" && k.intent === "praise")
    .slice(0, 10)
    .map(k => ({ phrase: k.phrase, count: k.count }))
  
  // Get top complaint phrases
  const topComplaints = keywords
    .filter(k => k.sentiment === "negative" && k.intent === "complaint")
    .slice(0, 10)
    .map(k => ({ phrase: k.phrase, count: k.count }))
  
  // Get competitor mentions
  const competitorMentions = keywords
    .filter(k => k.aspect === "competitor")
    .slice(0, 10)
    .map(k => ({ phrase: k.phrase, count: k.count, sentiment: k.sentiment }))
  
  return {
    keywords: keywords.slice(0, 50), // Top 50 keywords
    aspectSummary,
    intentSummary,
    topPraise,
    topComplaints,
    competitorMentions
  }
}
