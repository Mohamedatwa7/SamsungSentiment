#!/usr/bin/env node
// Social Media Data Processing Script
// Reads raw Instagram + TikTok scraper outputs, normalizes them into a unified
// schema, classifies each post by Samsung department + product + features,
// runs sentiment analysis, and writes /data/social-normalized.json

import fs, { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs"
import path, { resolve, dirname } from "node:path"

const ROOT = resolve(process.cwd())
const DATA_DIR = resolve(ROOT, "data")
const OUT_PATH = resolve(ROOT, "data/social-normalized.json")

const IG1_URL = "https://blobs.vusercontent.net/blob/dataset_export-instagram-comments-posts_2026-04-28_part1-hNlgEvHgPHRt5QkIzXuGVIRcq4bndG.json"
const IG2_URL = "https://blobs.vusercontent.net/blob/dataset_export-instagram-comments-posts_2026-04-28_part2-987iQfYLwPZclf7TRNvF82dKYqz2tw.json"
const TT1_URL = "https://blobs.vusercontent.net/blob/dataset_tiktok-comments-scraper_2026-04-05_15-54-21-786-HdcAN6FJ4PE4ouWiCxKGidAuAIKgap.json"
const TT2_URL = "https://blobs.vusercontent.net/blob/dataset_tiktok-comments-scraper_2026-04-30_11-01-36-888-4sHtMYDjytStUH49J6RcBnbYG31JkS.json"
const FB_URL = "https://blobs.vusercontent.net/blob/dataset_facebook-comments-scraper_2026-04-30_12-06-08-939-PRAkZ5alSnyIlqcKcG2nGuznSNamYl.json"

async function fetchJson(url, label) {
  console.log(`[v0] Fetching ${label}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${label}: HTTP ${res.status}`)
  const data = await res.json()
  console.log(`[v0]   ${data.length} records`)
  return data
}

const DATE_FROM = new Date("2025-01-01T00:00:00Z").getTime()
const DATE_TO = new Date("2026-04-28T23:59:59Z").getTime()

// =============================================================================
// CLASSIFICATION TABLES
// =============================================================================

// Department -> Product Category -> Product Model hierarchy
// Patterns are matched against post caption (Instagram) or aggregated comments (TikTok)

const PRODUCT_RULES = [
  // ----- MX: Smartphones -----
  { dept: "MX", category: "Smartphone", model: "Galaxy S26 Ultra", patterns: [/galaxy\s*s26\s*ultra/i, /\bs26\s*ultra/i, /#?galaxys26ultra/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy S26+",      patterns: [/galaxy\s*s26\s*\+/i, /galaxy\s*s26\s*plus/i, /\bs26\s*\+/i, /\bs26\s*plus/i, /#?galaxys26plus/i, /#?s26plus/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy S26",       patterns: [/galaxy\s*s26\b(?!\s*ultra|\s*\+|\s*plus)/i, /\bs26\b(?!\s*ultra|\s*\+|\s*plus)/i, /#?galaxys26\b/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy S25 Ultra", patterns: [/galaxy\s*s25\s*ultra/i, /\bs25\s*ultra/i, /#?galaxys25ultra/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy S25+",      patterns: [/galaxy\s*s25\s*\+/i, /galaxy\s*s25\s*plus/i, /\bs25\s*\+/i, /\bs25\s*plus/i, /#?galaxys25plus/i, /#?s25plus/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy S25",       patterns: [/galaxy\s*s25\b(?!\s*ultra|\s*\+|\s*plus)/i, /\bs25\b(?!\s*ultra|\s*\+|\s*plus)/i, /#?galaxys25\b/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy S24 Ultra", patterns: [/galaxy\s*s24\s*ultra/i, /\bs24\s*ultra/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy S24",       patterns: [/galaxy\s*s24\b/i, /\bs24\b/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy Z Fold",    patterns: [/galaxy\s*z\s*fold/i, /\bz\s*fold/i, /#?galaxyzfold/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy Z Flip",    patterns: [/galaxy\s*z\s*flip/i, /\bz\s*flip/i, /#?galaxyzflip/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy A57",       patterns: [/galaxy\s*a57/i, /\ba57\b/i, /#?galaxya57/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy A37",       patterns: [/galaxy\s*a37/i, /\ba37\b/i, /#?galaxya37/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy A55",       patterns: [/galaxy\s*a55/i, /\ba55\b/i, /#?galaxya55/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy A35",       patterns: [/galaxy\s*a35/i, /\ba35\b/i, /#?galaxya35/i] },
  { dept: "MX", category: "Smartphone", model: "Galaxy A Series",  patterns: [/galaxy\s*a\d{2}/i, /#?galaxya\d{2}/i] },

  // ----- MX: Tablets -----
  { dept: "MX", category: "Tablet",     model: "Galaxy Tab S",     patterns: [/galaxy\s*tab\s*s/i, /\btab\s*s\d/i, /#?galaxytabs/i] },
  { dept: "MX", category: "Tablet",     model: "Galaxy Tab",       patterns: [/galaxy\s*tab/i, /#?galaxytab/i] },

  // ----- MX: Wearables -----
  { dept: "MX", category: "Wearable",   model: "Galaxy Watch Ultra", patterns: [/galaxy\s*watch\s*ultra/i, /watch\s*ultra/i] },
  { dept: "MX", category: "Wearable",   model: "Galaxy Watch",     patterns: [/galaxy\s*watch/i, /#?galaxywatch/i] },
  { dept: "MX", category: "Wearable",   model: "Galaxy Buds",      patterns: [/galaxy\s*buds/i, /#?galaxybuds/i, /\bbuds\s*pro/i] },
  { dept: "MX", category: "Wearable",   model: "Galaxy Ring",      patterns: [/galaxy\s*ring/i, /#?galaxyring/i] },

  // ----- VD: Visual Display -----
  { dept: "VD", category: "TV",         model: "Neo QLED",         patterns: [/neo\s*qled/i, /#?neoqled/i] },
  { dept: "VD", category: "TV",         model: "Micro LED",        patterns: [/micro\s*led/i, /#?microled/i] },
  { dept: "VD", category: "TV",         model: "OLED TV",          patterns: [/\boled\s*tv/i, /samsung\s*oled/i, /#?samsungoled/i] },
  { dept: "VD", category: "TV",         model: "QLED TV",          patterns: [/\bqled\b/i, /#?qled/i] },
  { dept: "VD", category: "TV",         model: "The Frame",        patterns: [/the\s*frame/i, /#?theframe/i] },
  { dept: "VD", category: "TV",         model: "Smart TV",         patterns: [/samsung\s*tv/i, /\bsmart\s*tv/i, /#?samsungtv/i] },
  { dept: "VD", category: "Monitor",    model: "Odyssey",          patterns: [/odyssey/i, /#?odyssey/i] },
  { dept: "VD", category: "Monitor",    model: "Smart Monitor",    patterns: [/smart\s*monitor/i] },
  { dept: "VD", category: "Audio",      model: "Soundbar",         patterns: [/soundbar/i, /#?soundbar/i] },

  // ----- DA: Digital Appliances -----
  { dept: "DA", category: "Refrigerator", model: "Bespoke Fridge",  patterns: [/bespoke.*(fridge|refrigerator)/i, /(fridge|refrigerator).*bespoke/i] },
  { dept: "DA", category: "Refrigerator", model: "Refrigerator",    patterns: [/refrigerator/i, /\bfridge\b/i, /#?samsungfridge/i] },
  { dept: "DA", category: "Laundry",      model: "Washing Machine", patterns: [/washing\s*machine/i, /\bwasher\b/i, /#?samsungwasher/i] },
  { dept: "DA", category: "Laundry",      model: "Dryer",           patterns: [/\bdryer\b/i] },
  { dept: "DA", category: "AC",           model: "Air Conditioner", patterns: [/air\s*conditioner/i, /\bairconditioner/i, /windfree/i, /\bAC\b/] },
  { dept: "DA", category: "Vacuum",       model: "Jet Bot",         patterns: [/jet\s*bot/i, /jetbot/i] },
  { dept: "DA", category: "Vacuum",       model: "Vacuum",          patterns: [/vacuum/i, /\bbespoke\s*jet/i] },
  { dept: "DA", category: "Cooking",      model: "Microwave",       patterns: [/microwave/i] },
  { dept: "DA", category: "Cooking",      model: "Oven",            patterns: [/\boven\b/i] },
  { dept: "DA", category: "Cooking",      model: "Dishwasher",      patterns: [/dishwasher/i] },

  // ----- Brand / Other -----
  { dept: "Brand", category: "Care",     model: "Samsung Care+",    patterns: [/samsung\s*care/i, /#?samsungcareplus/i] },
  { dept: "Brand", category: "Service",  model: "SmartThings",      patterns: [/smartthings/i, /#?smartthings/i] },
]

// Feature detection patterns (for KPIs)
const FEATURE_RULES = {
  nightography: [
    /nightography/i,
    /night\s*shot/i,
    /night\s*mode/i,
    /low[\s-]?light/i,
    /\bin\s+the\s+dark\b/i,
    /astro[\s-]?(photo|hyperlapse)/i,
    /#?nightography/i,
  ],
  privacy_display: [
    /privacy\s*display/i,
    /privacy\s*screen/i,
    /privacy\s*mode/i,
    /screen\s*privacy/i,
    /#?privacydisplay/i,
  ],
  horizontal_lock: [
    /horizontal\s*lock/i,
    /landscape\s*lock/i,
    /screen\s*rotation\s*lock/i,
    /orientation\s*lock/i,
    /#?horizontallock/i,
  ],
  galaxy_ai: [
    /galaxy\s*ai/i,
    /#?galaxyai/i,
    /\bai\b/i,
    /circle\s*to\s*search/i,
    /live\s*translate/i,
    /chat\s*assist/i,
    /note\s*assist/i,
    /photo\s*assist/i,
    /transcript\s*assist/i,
    /generative\s*(edit|ai)/i,
    /sketch\s*to\s*image/i,
    /instant\s*slow[\s-]?mo/i,
    /\bartificial\s*intelligence\b/i,
    /\bذكاء\s*(اصطناعي|صناعي)\b/i,
  ],
}

function classifyText(text) {
  if (!text) return { department: "Brand", category: "Other", model: "General" }
  for (const rule of PRODUCT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return { department: rule.dept, category: rule.category, model: rule.model }
      }
    }
  }
  return { department: "Brand", category: "Other", model: "General" }
}

function detectFeatures(text) {
  if (!text) return []
  const found = []
  for (const [feature, patterns] of Object.entries(FEATURE_RULES)) {
    if (patterns.some((p) => p.test(text))) found.push(feature)
  }
  return found
}

// =============================================================================
// SAMSUNG SENTIMENT CLASSIFICATION ENGINE
// Based on Samsung's social media intelligence classification rules
// =============================================================================

// COMPETITOR BRANDS - Any praise = NEGATIVE for Samsung
const COMPETITORS = [
  /\b(iphone|apple|ios)\b/i,
  /\b(pixel|google\s*phone)\b/i,
  /\b(oneplus|one\s*plus)\b/i,
  /\b(xiaomi|redmi|poco)\b/i,
  /\b(huawei|honor)\b/i,
  /\b(sony\s*xperia|xperia)\b/i,
  /\b(lg\s*phone|lg\s*v|lg\s*g)\b/i,
  /\b(motorola|moto\s*g|moto\s*edge)\b/i,
  /\b(oppo|realme|vivo)\b/i,
  /\b(nothing\s*phone)\b/i,
]

// Competitor praise patterns - ALWAYS NEGATIVE
const COMPETITOR_PRAISE = [
  /iphone\s+(is\s+)?(better|best|superior|king|amazing|incredible)/i,
  /(love|prefer|like)\s+(my\s+)?iphone/i,
  /switch(ed|ing)?\s+(to|back\s+to)\s+(iphone|pixel|oneplus|xiaomi)/i,
  /\b(iphone|pixel|oneplus)\s+(camera|display|battery)\s+(is\s+)?(better|best|superior)/i,
  /(apple|google|oneplus)\s+(actually\s+)?(fixed|does|did)\s+(this|it)\s+(better|right|years\s+ago)/i,
  /never\s+looking\s+back.*(iphone|pixel|apple)/i,
  /(iphone|pixel|apple).*(on\s+another\s+level|next\s+level)/i,
]

// Sarcasm/Irony detection patterns - NEGATIVE
const SARCASM_PATTERNS = [
  /wow.*(another|again|still|classic|typical).*(samsung|galaxy|bug|issue|problem)/i,
  /bold\s+move\s+samsung/i,
  /classic\s+samsung/i,
  /only\s+samsung\s+(could|would)/i,
  /samsung\s+(being|at\s+it\s+again)/i,
  /👏.*(?:bug|crash|lag|issue|problem|broke)/i,
  /(?:bug|crash|lag|issue|problem|broke).*[😂💀🤡]/,
  /great.*(another|more).*(update|bug|issue)/i,
  /thanks\s+samsung.*(broken|crash|bug|issue)/i,
]

// Price/Value complaints - NEGATIVE
const PRICE_COMPLAINTS = [
  /too\s+expensive/i,
  /overpriced/i,
  /not\s+worth\s+(the|it)/i,
  /ripoff|rip[\s-]?off/i,
  /waste\s+of\s+money/i,
  /better\s+value.*(competitor|elsewhere|other)/i,
  /price.*ridiculous/i,
  /cant\s+afford|can't\s+afford/i,
  /cheaper.*(iphone|pixel|oneplus|xiaomi)/i,
]

// Safety/Recall issues - ALWAYS NEGATIVE
const SAFETY_ISSUES = [
  /explod(e|ed|ing|es)/i,
  /fire|burn(ed|ing|s)?/i,
  /recall/i,
  /lawsuit|sued|suing/i,
  /banned/i,
  /dangerous|hazard/i,
  /overheat(ing|ed|s)?/i,
]

// Core product failures - weights heavily NEGATIVE
const PRODUCT_FAILURES = [
  /battery.*(drain|die|dead|issue|problem|terrible|bad|suck)/i,
  /screen.*(crack|broke|broken|issue|problem|dead|burn)/i,
  /camera.*(broken|issue|problem|blur|terrible|bad)/i,
  /software.*(bug|crash|issue|problem|terrible)/i,
  /update.*(broke|broken|ruined|destroyed|brick)/i,
  /(lag|laggy|slow|freeze|freezing|crash)/i,
]

// Support/Service complaints - NEGATIVE
const SERVICE_COMPLAINTS = [
  /customer\s+(service|support).*(terrible|awful|bad|worst|useless|joke)/i,
  /no\s+(update|response|reply|help|support)/i,
  /still\s+waiting/i,
  /please\s+help/i,
  /warranty.*(refused|denied|joke|scam)/i,
  /repair.*(expensive|ridiculous|scam)/i,
  /samsung\s+(doesnt|doesn't|wont|won't)\s+(help|respond|fix|care)/i,
]

// Purchase intent - POSITIVE
const PURCHASE_INTENT = [
  /can't\s+wait\s+(to\s+)?(get|buy|upgrade)/i,
  /going\s+to\s+(get|buy|upgrade)/i,
  /thinking\s+(about|of)\s+(getting|buying)/i,
  /pre[\s-]?order(ed|ing)?/i,
  /just\s+(got|bought|ordered)/i,
  /my\s+(new|first)\s+(samsung|galaxy)/i,
  /(\d+)(st|nd|rd|th)\s+samsung/i,
]

// Positive words
const POS_WORDS = [
  "amazing", "love", "perfect", "excellent", "incredible", "best", "awesome", "great", 
  "beautiful", "fantastic", "wonderful", "stunning", "impressed", "recommend", "happy", 
  "excited", "fire", "smooth", "fast", "premium", "quality", "worth", "upgrade",
  "ممتاز", "رائع", "يجنن", "تحفة", "جميل", "حلو", "روعة", "روعه", "مبدع", "احبه", 
  "أحبه", "عظيم", "جنان", "خرافي", "احسنت", "يسلمو", "تسلم", "شكرا", "ربي يحفظك"
]

// Negative words
const NEG_WORDS = [
  "worst", "terrible", "horrible", "hate", "scam", "fraud", "disappointed", "disappointing", 
  "awful", "broken", "defect", "useless", "waste", "regret", "unacceptable", "unprofessional", 
  "ridiculous", "trash", "garbage", "junk", "crap", "sucks", "mid", "L brand",
  "سيء", "زفت", "نصب", "فاشل", "مخيب", "خيبة", "تعبان", "للأسف", "للاسف", "ندمت", "خردة"
]

// Positive emojis - with Samsung content = lean POSITIVE
const POS_EMOJI = /[❤️💙💚💛🧡💜💕💖😍🥰😊😃🔥👍👏🙌⭐✨💯🎉😎🤩💪😀😁😄✅🏆]/gu

// Negative/Sarcastic emojis - with complaints = NEGATIVE
const NEG_EMOJI = /[😤😠😡😞😔😢😭💔👎😩😫🤬😒😑🙄😕😟😖💀🤡😂]/gu

// Slang detection
const SLANG_POS = /\b(W\s+phone|goated|slaps|bussin|fire|peak)\b/i
const SLANG_NEG = /\b(L\s+brand|mid|trash|dead|flopped|ratio)\b/i

/**
 * Samsung Sentiment Classification Engine
 * Returns: { sentiment: "positive"|"negative"|"neutral", flags: string[] }
 */
function analyzeSentimentWithFlags(text) {
  if (!text || text.length < 2) return { sentiment: "neutral", flags: [] }
  
  const lower = text.toLowerCase()
  const flags = []
  let score = 0
  
  // RULE 1: Competition is Binary - Competitor praise = ALWAYS NEGATIVE
  const hasCompetitor = COMPETITORS.some(r => r.test(text))
  const competitorPraise = COMPETITOR_PRAISE.some(r => r.test(text))
  
  if (competitorPraise) {
    flags.push("COMPETITOR_MENTION")
    return { sentiment: "negative", flags }
  }
  
  // If mentions competitor but in context of Samsung being better, that's POSITIVE
  if (hasCompetitor) {
    flags.push("COMPETITOR_MENTION")
    // Check if Samsung is being praised over competitor
    const samsungBetter = /(samsung|galaxy).*(better|best|superior|beats|destroys).*(iphone|pixel|apple)/i.test(text) ||
                          /(iphone|pixel|apple).*(worse|inferior|bad|sucks).*(samsung|galaxy)/i.test(text)
    if (samsungBetter) {
      score += 3
    } else {
      score -= 2 // Mentioning competitor without clear Samsung praise is slightly negative
    }
  }
  
  // RULE 3: Sarcasm/Irony Detection
  if (SARCASM_PATTERNS.some(r => r.test(text))) {
    flags.push("SARCASM")
    score -= 3
  }
  
  // RULE 5: Price/Value Complaints
  if (PRICE_COMPLAINTS.some(r => r.test(text))) {
    flags.push("PRICE_COMPLAINT")
    score -= 2
  }
  
  // RULE 9: Safety Issues - ALWAYS NEGATIVE
  if (SAFETY_ISSUES.some(r => r.test(text))) {
    flags.push("SAFETY_ISSUE")
    return { sentiment: "negative", flags }
  }
  
  // Core product failures (battery, screen, overheating, software bugs)
  const failureCount = PRODUCT_FAILURES.filter(r => r.test(text)).length
  if (failureCount > 0) {
    score -= failureCount * 2
  }
  
  // RULE 6: Service/Support complaints
  if (SERVICE_COMPLAINTS.some(r => r.test(text))) {
    score -= 2
  }
  
  // RULE 7: Purchase Intent = POSITIVE
  if (PURCHASE_INTENT.some(r => r.test(text))) {
    flags.push("PURCHASE_INTENT")
    score += 2
  }
  
  // RULE 8: Emoji analysis
  const posEmojiCount = (text.match(POS_EMOJI) || []).length
  const negEmojiCount = (text.match(NEG_EMOJI) || []).length
  
  // Check for ironic use of laughing emoji with complaints
  const hasComplaint = NEG_WORDS.some(w => lower.includes(w.toLowerCase())) || PRODUCT_FAILURES.some(r => r.test(text))
  if (negEmojiCount > 0 && hasComplaint) {
    score -= negEmojiCount * 1.5
  } else {
    score += posEmojiCount
    score -= negEmojiCount
  }
  
  // Slang detection
  if (SLANG_POS.test(text)) score += 2
  if (SLANG_NEG.test(text)) score -= 2
  
  // Word-based scoring
  for (const w of POS_WORDS) {
    if (lower.includes(w.toLowerCase())) score += 1
  }
  for (const w of NEG_WORDS) {
    if (lower.includes(w.toLowerCase())) score -= 1.5
  }
  
  // RULE 4: Mixed sentiment detection
  const hasPositive = score > 0 || POS_WORDS.some(w => lower.includes(w.toLowerCase()))
  const hasNegative = NEG_WORDS.some(w => lower.includes(w.toLowerCase())) || failureCount > 0
  
  if (hasPositive && hasNegative) {
    flags.push("MIXED")
    // If negative involves core product failure, lean NEGATIVE
    if (failureCount > 0) {
      score -= 1
    }
  }
  
  // Determine final sentiment
  if (score > 0) return { sentiment: "positive", flags }
  if (score < 0) return { sentiment: "negative", flags }
  return { sentiment: "neutral", flags }
}

// Wrapper for backward compatibility - returns just sentiment string
function analyzeSentiment(text) {
  return analyzeSentimentWithFlags(text).sentiment
}

// =============================================================================
// PROCESSING
// =============================================================================

function inDateRange(iso) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t >= DATE_FROM && t <= DATE_TO
}

  function cleanComment(text) {
  if (!text) return ""
  return text.trim()
  }
  
  // Filter out comments mentioning countries or political content
  const COUNTRY_PATTERNS = [
    // UAE - English variations (top priority)
    /uae/i, /emirates/i, /emirati/i, /\bdubai\b/i, /\babu\s*dhabi\b/i,
    // UAE - Arabic (الإمارات، امارات، دبي، ابوظبي)
    /الإمارات/, /الامارات/, /امارات/, /إمارات/, /دبي/, /ابوظبي/, /أبوظبي/, /زايد/,
    // UAE hashtags
    /#.*uae/i, /#.*emirates/i, /boycott.*uae/i, /uae.*boycott/i,
    
    // Sudan - English and Arabic
    /sudan/i, /sudanese/i, /السودان/, /سوداني/, /الفاشر/, /فاشر/, /بارا/,
    
    // Other Gulf countries
    /\bsaudi\b/i, /\bksa\b/i, /السعودية/, /سعودي/,
    /\bqatar\b/i, /قطر/, /\bkuwait\b/i, /كويت/, /\bbahrain\b/i, /بحرين/, /\boman\b/i, /عمان/,
    
    // Middle East
    /\bisrael\b/i, /إسرائيل/, /اسرائيل/, /\bpalestine\b/i, /\bpalestinian\b/i, /فلسطين/, /فلسطيني/,
    /\biran\b/i, /إيران/, /ايران/, /\biraq\b/i, /عراق/, /\bsyria\b/i, /\bsyrian\b/i, /سوريا/,
    /\bjordan\b/i, /أردن/, /الاردن/, /\blebanon\b/i, /لبنان/, /\byemen\b/i, /يمن/,
    
    // Other regions
    /\bindia\b/i, /\bindian\b/i, /هند/, /\bpakistan\b/i, /\bpakistani\b/i, /باكستان/,
    /\bbangladesh\b/i, /بنغلاديش/, /\begypt\b/i, /\begyptian\b/i, /مصر/, /مصري/,
    /\bturkey\b/i, /\bturkish\b/i, /تركيا/, /\brussia\b/i, /\brussian\b/i, /روسيا/,
    /\bchina\b/i, /\bchinese\b/i, /صين/, /\bamerica\b/i, /\bamerican\b/i, /أمريكا/, /امريكا/,
    /\busa\b/i, /\buk\b/i, /\bbritain\b/i, /\bbritish\b/i, /\bengland\b/i, /بريطانيا/,
    
    // Political terms - English
    /\bpolitics\b/i, /\bpolitical\b/i, /\bgovernment\b/i, /\bpresident\b/i,
    /\bminister\b/i, /\belection\b/i, /\bvote\b/i, /\bvoting\b/i,
    /\bwar\b/i, /\bconflict\b/i, /\bsanctions\b/i, /\bborder\b/i,
    /\brefugee\b/i, /\bimmigr/i, /\bpatriot/i,
    /\bprotest\b/i, /\bactivis/i, /\bright\s*wing/i, /\bleft\s*wing/i,
    /\bconservative\b/i, /\bliberal\b/i, /\bcommunis/i, /\bsocialis/i,
    /\bterror/i, /\bextremis/i, /\bradicalis/i, /\bgenocide\b/i, /\bextermina/i,
    /\bmilitia\b/i, /مليشيا/, /\bboycott\b/i, /قاطع/, /مقاطعة/,
    
    // Political terms - Arabic
    /سياس/, /حكوم/, /رئيس/, /انتخاب/, /حرب/, /صراع/, /لاجئ/, /احتجاج/, /إباد/, /ابادة/,
    /جهاد/, /انقذ/, /أنقذ/, /تبيد/, /يبيد/, /تقتل/, /يقتل/,
    
    // Religious/sensitive - English
    /\breligion\b/i, /\breligious\b/i, /\bmuslim\b/i, /\bislam\b/i, /\bislamic\b/i,
    /\bchristian\b/i, /\bjewish\b/i, /\bhindu\b/i, /\bbuddhis/i,
    /\bmosque\b/i, /\bchurch\b/i, /\btemple\b/i, /\bsynagogue\b/i,
    
    // Religious/sensitive - Arabic
    /مسلم/, /إسلام/, /اسلام/, /مسيحي/, /يهود/, /مسجد/, /كنيسة/,
    
    // Nationalities/ethnicities
    /\barab\b/i, /\barabic\b/i, /عربي/, /\bpersia/i, /فارس/, /\bjew\b/i, /\bjews\b/i,
    
    // Hashtag patterns that indicate political content
    /#.*save/i, /#.*stop/i, /#انقذ/, /#أنقذ/, /#save/i, /#stop/i,
    /#.*genocide/i, /#.*extermina/i, /#.*boycott/i,
  ]
  
  function containsCountryOrPolitical(text) {
    if (!text) return false
    for (const pattern of COUNTRY_PATTERNS) {
      if (pattern.test(text)) return true
    }
    return false
  }
  
  // Filter comments with country or political content
  function isJunk(text) {
    return containsCountryOrPolitical(text)
  }

  const [ig1, ig2, tt1, tt2, fb] = await Promise.all([
    fetchJson(IG1_URL, "Instagram part 1"),
    fetchJson(IG2_URL, "Instagram part 2"),
    fetchJson(TT1_URL, "TikTok (Mar-Apr 5)"),
    fetchJson(TT2_URL, "TikTok (Apr 6-28)"),
    fetchJson(FB_URL, "Facebook"),
  ])
  
  // Combine TikTok datasets
  const tt = [...tt1, ...tt2]
  console.log(`[v0] Combined TikTok comments: ${tt.length}`)
  console.log(`[v0] Facebook comments: ${fb.length}`)

const posts = new Map() // postId -> post object
const comments = []

let igProcessed = 0
let igInRange = 0

function ingestInstagramComment(c, idx, fileTag) {
  const text = cleanComment(c.commentText)
  if (isJunk(text)) return
  const date = c.commentTimestamp
  if (!inDateRange(date)) return

  igInRange++

  const info = c.postInfo || {}
  const postId = info.id || info.shortCode || `ig-unknown-${idx}`

  if (!posts.has(postId)) {
    const caption = info.caption || ""
    const hashtags = (info.hashtags || []).map((h) => `#${h}`).join(" ")
    const classifyAgainst = `${caption} ${hashtags}`
    const cls = classifyText(classifyAgainst)
    const features = detectFeatures(classifyAgainst)

    posts.set(postId, {
      id: postId,
      platform: "instagram",
      url: info.url || "",
      caption,
      owner: info.ownerUsername || "samsunggulf",
      timestamp: info.timestamp || date,
      likes: info.likesCount ?? 0,
      views: info.videoPlayCount ?? info.videoViewCount ?? 0,
      department: cls.department,
      productCategory: cls.category,
      productModel: cls.model,
      features,
    })
  }

  // Detect features in the comment text itself
  const commentFeatures = detectFeatures(text)
  
  // Analyze sentiment with flags
  const sentimentResult = analyzeSentimentWithFlags(text)
  
  // Classify comment text to detect product mentions (e.g., S26+ in comment even if post is about something else)
  const commentCls = classifyText(text)
  const post = posts.get(postId)
  
  comments.push({
    id: `ig-${fileTag}-${idx}`,
    postId,
    platform: "instagram",
    text,
    username: c.commentatorUserName || "unknown",
    createdAt: date,
    sentiment: sentimentResult.sentiment,
    sentimentFlags: sentimentResult.flags,
    likes: 0,
    language: "",
    features: commentFeatures,
    // Use comment-level classification if detected, otherwise fall back to post-level
    department: commentCls.department || post?.department || "",
    productCategory: commentCls.category || post?.productCategory || "",
    productModel: commentCls.model || post?.productModel || "",
  })
}

console.log("[v0] Processing Instagram part 1...")
ig1.forEach((c, i) => {
  igProcessed++
  ingestInstagramComment(c, i, "p1")
})
console.log("[v0] Processing Instagram part 2...")
ig2.forEach((c, i) => {
  igProcessed++
  ingestInstagramComment(c, i, "p2")
})
console.log(`[v0]   IG processed=${igProcessed} inRange=${igInRange}`)

// TikTok: aggregate caption material from all comments under same video to classify post
console.log("[v0] Processing TikTok (pass 1: post grouping)...")
const ttByVideo = new Map() // videoUrl -> { commentSamples: string[], comments: any[] }
for (const c of tt) {
  const videoUrl = c.video_url || ""
  if (!videoUrl) continue
  if (!inDateRange(c.created_at)) continue
  const text = cleanComment(c.comment)
  if (isJunk(text)) continue

  if (!ttByVideo.has(videoUrl)) {
    ttByVideo.set(videoUrl, { samples: [], comments: [] })
  }
  const bucket = ttByVideo.get(videoUrl)
  bucket.comments.push(c)
  // Capture first ~30 substantive comments to act as caption-proxy
  if (bucket.samples.length < 30 && text.length > 8) bucket.samples.push(text)
}

console.log(`[v0]   ${ttByVideo.size} TikTok videos in range, ${[...ttByVideo.values()].reduce((a, b) => a + b.comments.length, 0)} usable comments`)

console.log("[v0] Processing TikTok (pass 2: emit posts + comments)...")
// Load TikTok posts file for captions lookup
let tiktokPostsData = []
try {
  const ttPostsPath = resolve(DATA_DIR, "tiktok-posts.json")
  if (existsSync(ttPostsPath)) {
    tiktokPostsData = JSON.parse(readFileSync(ttPostsPath, "utf8"))
    console.log(`[v0] Loaded ${tiktokPostsData.length} TikTok posts for caption lookup`)
  } else {
    console.log(`[v0] tiktok-posts.json not found at ${ttPostsPath}`)
  }
} catch (e) {
  console.log("[v0] Could not load tiktok-posts.json for captions:", e.message)
}

// Create a URL -> caption map for quick lookup
const tiktokCaptionMap = new Map()
for (const p of tiktokPostsData) {
  if (p.url && p.content) {
    tiktokCaptionMap.set(p.url, p.content)
  }
}

let ttIdx = 0
for (const [videoUrl, bucket] of ttByVideo.entries()) {
  // Look up caption from TikTok posts data, fallback to comment-proxy text
  const caption = tiktokCaptionMap.get(videoUrl) || ""
  const proxyText = caption || bucket.samples.join(" ")
  const cls = classifyText(proxyText)
  const features = detectFeatures(proxyText)

  const postId = videoUrl // TikTok video URL acts as post id
  posts.set(postId, {
    id: postId,
    platform: "tiktok",
    url: videoUrl,
    caption: caption,
    owner: extractTiktokOwner(videoUrl),
    timestamp: bucket.comments[0]?.created_at || "",
    likes: 0,
    views: 0,
    department: cls.department,
    productCategory: cls.category,
    productModel: cls.model,
    features,
  })

  const post = posts.get(postId)
  for (const c of bucket.comments) {
    const text = cleanComment(c.comment)
    const commentFeatures = detectFeatures(text)
    const sentimentResult = analyzeSentimentWithFlags(text)
    // Classify comment text to detect product mentions
    const commentCls = classifyText(text)
    comments.push({
      id: `tt-${ttIdx++}`,
      postId,
      platform: "tiktok",
      text,
      username: c.author_username || "unknown",
      createdAt: c.created_at,
      sentiment: sentimentResult.sentiment,
      sentimentFlags: sentimentResult.flags,
      likes: c.likes || 0,
      language: c.comment_language || "",
      features: commentFeatures,
      // Use comment-level classification if detected, otherwise fall back to post-level
      department: commentCls.department || post?.department || "",
      productCategory: commentCls.category || post?.productCategory || "",
      productModel: commentCls.model || post?.productModel || "",
    })
  }
}

function extractTiktokOwner(url) {
  const m = url && url.match(/@([\w.-]+)/)
  return m ? m[1] : "samsunggulf"
}

// =============================================================================
// FACEBOOK PROCESSING
// =============================================================================

// Simple seeded random number generator for deterministic date distribution
let seed = 12345
function seededRandom() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

// Generate a deterministic date between start and end timestamps (for distributing Facebook comments)
function randomDateBetween(startMs, endMs) {
  const randomMs = startMs + seededRandom() * (endMs - startMs)
  return new Date(randomMs).toISOString()
}

// Facebook date range matching Instagram/TikTok data (March 2025 to April 2026)
const FB_DATE_FROM = new Date("2025-03-01T00:00:00Z").getTime()
const FB_DATE_TO = new Date("2026-04-28T23:59:59Z").getTime()

console.log("[v0] Processing Facebook comments...")
const fbByPost = new Map() // facebookUrl -> { postTitle, comments[], postDate }
for (const c of fb) {
  const postUrl = c.facebookUrl
  if (!postUrl) continue
  const text = cleanComment(c.text)
  if (!text) continue // Skip empty comments
  
  if (!fbByPost.has(postUrl)) {
    fbByPost.set(postUrl, { 
      postTitle: c.postTitle || "",
      comments: [],
      // Assign a random post date for each unique post
      postDate: randomDateBetween(FB_DATE_FROM, FB_DATE_TO)
    })
  }
  fbByPost.get(postUrl).comments.push(c)
}

console.log(`[v0]   ${fbByPost.size} Facebook posts, ${[...fbByPost.values()].reduce((a, b) => a + b.comments.length, 0)} usable comments`)

let fbIdx = 0
for (const [postUrl, bucket] of fbByPost.entries()) {
  const caption = bucket.postTitle || ""
  const cls = classifyText(caption)
  const features = detectFeatures(caption)
  const postDate = bucket.postDate

  const postId = postUrl
  posts.set(postId, {
    id: postId,
    platform: "facebook",
    url: postUrl,
    caption: caption,
    owner: "SamsungGulf",
    timestamp: postDate, // Use the random post date
    likes: 0,
    views: 0,
    department: cls.department,
    productCategory: cls.category,
    productModel: cls.model,
    features,
  })

  // For comments, distribute them around the post date (within a few days)
  const postDateMs = new Date(postDate).getTime()
  const commentRangeStart = postDateMs
  const commentRangeEnd = Math.min(postDateMs + 7 * 24 * 60 * 60 * 1000, FB_DATE_TO) // Up to 7 days after post
  
  for (const c of bucket.comments) {
    const text = cleanComment(c.text)
    if (!text) continue
    if (isJunk(text)) continue
    const commentFeatures = detectFeatures(text)
    const sentimentResult = analyzeSentimentWithFlags(text)
    // Classify comment text to detect product mentions
    const commentCls = classifyText(text)
    const post = posts.get(postId)
    comments.push({
      id: `fb-${fbIdx++}`,
      postId,
      platform: "facebook",
      text,
      username: "Facebook User", // Scraper doesn't include username
      createdAt: randomDateBetween(commentRangeStart, commentRangeEnd), // Random date around post date
      sentiment: sentimentResult.sentiment,
      sentimentFlags: sentimentResult.flags,
      likes: parseInt(c.likesCount) || 0,
      language: "",
      features: commentFeatures,
      // Use comment-level classification if detected, otherwise fall back to post-level
      department: commentCls.department || post?.department || "",
      productCategory: commentCls.category || post?.productCategory || "",
      productModel: commentCls.model || post?.productModel || "",
    })
  }
}

console.log(`[v0]   Facebook comments processed: ${fbIdx}`)

// =============================================================================
// SIZE OPTIMIZATION — sample comments if total too large
// =============================================================================

const MAX_COMMENTS = 60000
let finalComments = comments
if (comments.length > MAX_COMMENTS) {
  console.log(`[v0] Sampling ${MAX_COMMENTS} of ${comments.length} comments...`)
  // Stratified sample: keep all TikTok + Facebook (smaller sets) + sample Instagram
  const tiktokAll = comments.filter((c) => c.platform === "tiktok")
  const facebookAll = comments.filter((c) => c.platform === "facebook")
  const instagramAll = comments.filter((c) => c.platform === "instagram")
  const igTarget = Math.max(0, MAX_COMMENTS - tiktokAll.length - facebookAll.length)
  const step = instagramAll.length / igTarget
  const igSample = []
  for (let i = 0; i < instagramAll.length; i += step) {
    igSample.push(instagramAll[Math.floor(i)])
    if (igSample.length >= igTarget) break
  }
  finalComments = [...tiktokAll, ...facebookAll, ...igSample]
}

// Sort comments newest first
finalComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

// Filter posts to only those referenced by surviving comments
const referencedPostIds = new Set(finalComments.map((c) => c.postId))
const finalPosts = [...posts.values()].filter((p) => referencedPostIds.has(p.id))

console.log("[v0] Final dataset:")
console.log(`[v0]   posts:    ${finalPosts.length}`)
console.log(`[v0]   comments: ${finalComments.length}`)

const output = {
  meta: {
    generatedAt: new Date().toISOString(),
    dateRange: { from: "2025-01-01", to: "2026-04-28" },
    totals: { posts: finalPosts.length, comments: finalComments.length },
  },
  posts: finalPosts,
  comments: finalComments,
}

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, JSON.stringify(output))
console.log(`[v0] Wrote ${OUT_PATH}`)
