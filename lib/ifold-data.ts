// Shared (client-safe) types, config and helpers for the Competition Watch
// section — Apple iPhone Fold launch tracking vs Galaxy Z Fold8.
//
// The payload shape is produced by /api/ifold and consumed by the components
// under components/ifold/. Server-side sync logic lives in lib/ifold-sync.ts.

export type IFoldSentiment = "positive" | "negative" | "neutral"
export type IFoldFocus = "fold" | "launch"
export type IFoldLean = "apple" | "samsung" | null

// ---------------------------------------------------------------------------
// Campaign window
// ---------------------------------------------------------------------------

// Apple's "Surprise and shine" event: Sep 9 2026, 9:00 PM Dubai (UTC+4).
export const IFOLD_LAUNCH_AT = new Date("2026-09-09T21:00:00+04:00")
// Pre-launch rumor cycle is part of the story — track from a week before.
export const IFOLD_TRACKING_START = new Date("2026-09-02T00:00:00+04:00")
// Daily tracking for 3 weeks after the launch (through Sep 30, Gulf time).
export const IFOLD_TRACKING_END = new Date("2026-10-01T00:00:00+04:00")

export function ifoldTrackingEnded(now = new Date()): boolean {
  return now.getTime() >= IFOLD_TRACKING_END.getTime()
}

export function ifoldCampaignDay(now = new Date()): number {
  // Day 1 = launch day; 0 while still pre-launch.
  const launchMidnight = new Date("2026-09-09T00:00:00+04:00").getTime()
  return Math.max(0, Math.floor((now.getTime() - launchMidnight) / 86400000) + 1)
}

// ---------------------------------------------------------------------------
// Topic taxonomy — shared by the LLM analyzer, the API and the UI
// ---------------------------------------------------------------------------

export const IFOLD_TOPICS = [
  { key: "crease_hinge", label: "Crease & Hinge" },
  { key: "design_thinness", label: "Design & Thinness" },
  { key: "price", label: "Price & Value" },
  { key: "cameras", label: "Cameras & Zoom" },
  { key: "battery", label: "Battery & Charging" },
  { key: "display", label: "Displays" },
  { key: "software", label: "Software & Multitasking" },
  { key: "ai_features", label: "AI Features" },
  { key: "ecosystem", label: "Ecosystem & Lock-in" },
  { key: "biometrics", label: "Face ID / Touch ID" },
  { key: "availability", label: "Availability & GCC Launch" },
  { key: "durability", label: "Durability & Repair" },
] as const

export type IFoldTopicKey = (typeof IFOLD_TOPICS)[number]["key"]

export const IFOLD_TOPIC_LABELS: Record<string, string> = Object.fromEntries(
  IFOLD_TOPICS.map((t) => [t.key, t.label]),
)

// How Samsung Gulf can answer each Apple weakness — surfaced in the
// "Where Fold8 can capitalize" card when a topic trends negative for Apple.
export const IFOLD_PLAYBOOK: Record<IFoldTopicKey, string> = {
  crease_hinge:
    "Apple claims a 'nearly invisible' crease — if real-world units disagree, side-by-side crease content is the highest-credibility counter.",
  design_thinness:
    "If thinness praise dominates, shift the frame to what thinness costs: camera hardware, battery, hinge durability.",
  price:
    "iPhone Fold opens around $2,000 — Fold8's price advantage is a direct conquest message for upgraders on the fence.",
  cameras:
    "No telephoto on the iPhone Fold — Fold8 zoom demos are a visible, filmable difference GCC creators can reproduce.",
  battery:
    "Battery complaints on a v1 foldable are common — Fold8 battery + charging-speed comparisons land well here.",
  display:
    "Fold8's cover display is a full phone; Apple's 4:3 outer screen divides opinion — lean into one-handed usability content.",
  software:
    "iOS 27 split-view is version one — One UI multitasking, DeX and 8 generations of fold-aware apps are a maturity story.",
  ai_features:
    "Galaxy AI is shipping and localized (Arabic support) — contrast with what Apple Intelligence actually does on day one in the Gulf.",
  ecosystem:
    "Ecosystem lock-in cuts both ways — target dual-SIM, sideloading and customization freedoms Gulf users ask about.",
  biometrics:
    "Touch ID instead of Face ID reads as a regression — Fold8's biometric suite is an easy spec win.",
  availability:
    "A supply-constrained, US-first launch means weeks of GCC unavailability — Fold8 is on Gulf shelves today with trade-in offers.",
  durability:
    "First-gen folding hardware invites durability doubts — 8 generations of hinge engineering and IP ratings are the counter.",
}

// ---------------------------------------------------------------------------
// Payload types (produced by /api/ifold)
// ---------------------------------------------------------------------------

export interface IFoldAnalysis {
  sentiment: IFoldSentiment
  score: number | null
  topics: string[]
  lean: IFoldLean
}

export interface IFoldPost {
  id: string
  kind: "social" | "news"
  platform: "instagram" | "tiktok" | "youtube" | "twitter" | "news"
  url: string
  title: string
  author: string
  // news only: outlet name + feed language
  source: string | null
  sourceLang: "ar" | "en" | null
  publishedAt: string | null
  views: number
  likes: number
  commentsCount: number
  shares: number
  focus: IFoldFocus
  gcc: boolean
  // LLM analysis of the post's own text (news headlines, tweets)
  analysis: IFoldAnalysis | null
  // aggregate sentiment of scraped comments under this post
  commentSentiment: { positive: number; neutral: number; negative: number }
}

export interface IFoldComment {
  id: string
  postId: string
  platform: string
  text: string
  author: string
  likes: number
  publishedAt: string | null
  sentiment: IFoldSentiment
  score: number | null
  topics: string[]
  lean: IFoldLean
  analyzed: boolean
  gcc: boolean
}

export interface IFoldSamsungBaseline {
  // Aggregated from the Galaxy Unpacked + FF8 roster campaign comments
  // (our own Fold8 launch corpus, already analyzed).
  analyzed: number
  sentiment: { positive: number; neutral: number; negative: number }
  topics: Record<string, { positive: number; negative: number }>
}

export interface IFoldPayload {
  posts: IFoldPost[]
  comments: IFoldComment[]
  samsungBaseline: IFoldSamsungBaseline
  meta: {
    generatedAt: string
    launchAt: string
    trackingStart: string
    trackingEndsAt: string
    trackingEnded: boolean
  }
}

// ---------------------------------------------------------------------------
// Client-side aggregation helpers
// ---------------------------------------------------------------------------

export interface IFoldTotals {
  posts: number
  socialPosts: number
  newsArticles: number
  views: number
  engagements: number
  scrapedComments: number
  analyzedComments: number
  // comments + analyzed posts (tweets, headlines) combined
  sentiment: { positive: number; neutral: number; negative: number }
  samsungLeans: number
  appleLeans: number
}

// Every unit of opinion we scored: comments, tweets and news headlines.
export function ifoldOpinions(
  posts: IFoldPost[],
  comments: IFoldComment[],
): { sentiment: IFoldSentiment; topics: string[]; lean: IFoldLean; text: string; likes: number }[] {
  const out: { sentiment: IFoldSentiment; topics: string[]; lean: IFoldLean; text: string; likes: number }[] = []
  for (const p of posts) {
    if (p.analysis) {
      out.push({
        sentiment: p.analysis.sentiment,
        topics: p.analysis.topics,
        lean: p.analysis.lean,
        text: p.title,
        likes: p.likes,
      })
    }
  }
  for (const c of comments) {
    if (c.analyzed) out.push({ sentiment: c.sentiment, topics: c.topics, lean: c.lean, text: c.text, likes: c.likes })
  }
  return out
}

export function computeIFoldTotals(posts: IFoldPost[], comments: IFoldComment[]): IFoldTotals {
  const totals: IFoldTotals = {
    posts: posts.length,
    socialPosts: posts.filter((p) => p.kind === "social").length,
    newsArticles: posts.filter((p) => p.kind === "news").length,
    views: 0,
    engagements: 0,
    scrapedComments: comments.length,
    analyzedComments: comments.filter((c) => c.analyzed).length,
    sentiment: { positive: 0, neutral: 0, negative: 0 },
    samsungLeans: 0,
    appleLeans: 0,
  }
  for (const p of posts) {
    totals.views += p.views
    totals.engagements += p.likes + p.commentsCount + p.shares
  }
  for (const o of ifoldOpinions(posts, comments)) {
    totals.sentiment[o.sentiment]++
    if (o.lean === "samsung") totals.samsungLeans++
    if (o.lean === "apple") totals.appleLeans++
  }
  return totals
}

export function parseIFoldFlags(flags: string[] | null | undefined): {
  topics: string[]
  lean: IFoldLean
} {
  const list = flags || []
  const topics = list.filter((f) => f.startsWith("topic_")).map((f) => f.slice(6))
  const lean: IFoldLean = list.includes("lean_samsung")
    ? "samsung"
    : list.includes("lean_apple")
      ? "apple"
      : null
  return { topics, lean }
}

// ---------------------------------------------------------------------------
// Monitored sources — surfaced in the Watchlist panel and used by the sync
// ---------------------------------------------------------------------------

export interface IFoldFeed {
  id: string
  name: string
  url: string
  site: string
  lang: "ar" | "en"
  region: "gcc" | "global"
}

// RSS URLs verified working 2026-09-09 (fetched, returned valid XML).
export const IFOLD_NEWS_FEEDS: IFoldFeed[] = [
  { id: "aitnews", name: "البوابة التقنية (AITnews)", url: "https://aitnews.com/feed/", site: "aitnews.com", lang: "ar", region: "gcc" },
  { id: "tech-wd", name: "عالم التقنية", url: "https://www.tech-wd.com/wd/feed/", site: "tech-wd.com", lang: "ar", region: "gcc" },
  { id: "iphoneislam", name: "آي-فون إسلام", url: "https://www.iphoneislam.com/feed", site: "iphoneislam.com", lang: "ar", region: "gcc" },
  { id: "unlimit-tech", name: "التقنية بلا حدود", url: "https://www.unlimit-tech.com/feed/", site: "unlimit-tech.com", lang: "ar", region: "gcc" },
  { id: "arabhardware", name: "عرب هاردوير", url: "https://arabhardware.net/feed", site: "arabhardware.net", lang: "ar", region: "gcc" },
  { id: "skynewsarabia", name: "سكاي نيوز عربية — تكنولوجيا", url: "https://www.skynewsarabia.com/web/rss/technology.xml", site: "skynewsarabia.com", lang: "ar", region: "gcc" },
  { id: "tbreak", name: "Tbreak (UAE)", url: "https://tbreak.com/feed/", site: "tbreak.com", lang: "en", region: "gcc" },
  { id: "tahawultech", name: "TahawulTech (Dubai)", url: "https://tahawultech.com/feed/", site: "tahawultech.com", lang: "en", region: "gcc" },
  { id: "gulftimes", name: "Gulf Times Tech (Qatar)", url: "http://www.gulf-times.com/rssFeed/5/20", site: "gulf-times.com", lang: "en", region: "gcc" },
  { id: "arabnews", name: "Arab News (KSA)", url: "https://www.arabnews.com/rss.xml", site: "arabnews.com", lang: "en", region: "gcc" },
  // Gulf News / Khaleej Times have no native RSS — Google News search feeds
  // surface their coverage (verified returning their items today).
  {
    id: "gnews-en",
    name: "Google News · Gulf press (EN)",
    url: "https://news.google.com/rss/search?q=%22iPhone+Fold%22+OR+%22iPhone+Duo%22+OR+%22foldable+iPhone%22+OR+%22iPhone+18%22&hl=en-AE&gl=AE&ceid=AE:en",
    site: "news.google.com",
    lang: "en",
    region: "gcc",
  },
  {
    id: "gnews-ar",
    name: "Google News · الصحافة العربية",
    url: "https://news.google.com/rss/search?q=%22%D8%A2%D9%8A%D9%81%D9%88%D9%86%20%D8%A7%D9%84%D9%82%D8%A7%D8%A8%D9%84%20%D9%84%D9%84%D8%B7%D9%8A%22%20OR%20%22%D8%A7%D9%8A%D9%81%D9%88%D9%86%20%D9%81%D9%88%D9%84%D8%AF%22%20OR%20%22%D8%A2%D9%8A%D9%81%D9%88%D9%86%2018%22&hl=ar&gl=SA&ceid=SA:ar",
    site: "news.google.com",
    lang: "ar",
    region: "gcc",
  },
  { id: "macrumors", name: "MacRumors", url: "https://feeds.macrumors.com/MacRumors-All", site: "macrumors.com", lang: "en", region: "global" },
  { id: "9to5mac", name: "9to5Mac", url: "https://9to5mac.com/feed/", site: "9to5mac.com", lang: "en", region: "global" },
  { id: "engadget", name: "Engadget", url: "https://www.engadget.com/rss.xml", site: "engadget.com", lang: "en", region: "global" },
  { id: "techradar", name: "TechRadar", url: "https://www.techradar.com/feeds.xml", site: "techradar.com", lang: "en", region: "global" },
  { id: "theverge", name: "The Verge", url: "https://www.theverge.com/rss/index.xml", site: "theverge.com", lang: "en", region: "global" },
  { id: "apple-newsroom", name: "Apple Newsroom", url: "https://www.apple.com/newsroom/rss-feed.rss", site: "apple.com", lang: "en", region: "global" },
]

export interface IFoldInfluencer {
  name: string
  handle: string
  platform: "youtube" | "instagram" | "tiktok" | "x"
  url: string
  country: string
  lang: "ar" | "en"
  note?: string
}

// GCC tech voices expected to drive iPhone Fold coverage — verified 2026-09-09.
// Reviewers already on the FF8 roster are marked; their fold coverage also
// flows through the roster pipeline.
export const IFOLD_INFLUENCER_WATCHLIST: IFoldInfluencer[] = [
  { name: "فيصل السيف (UTD / Tech Pills)", handle: "falsaif", platform: "youtube", url: "https://www.youtube.com/TechPillsShow", country: "KSA", lang: "ar", note: "8.6M subs — top MENA tech creator · FF8 roster" },
  { name: "عبدالله السبع", handle: "alsabe3", platform: "instagram", url: "https://www.instagram.com/alsabe3/", country: "KSA", lang: "ar", note: "5.5M IG" },
  { name: "iPhone Islam", handle: "iphoneislam", platform: "x", url: "https://x.com/iphoneislam", country: "Pan-Arab", lang: "ar", note: "Largest Arabic Apple outlet" },
  { name: "iMAD Tech", handle: "imad_tech", platform: "tiktok", url: "https://www.tiktok.com/@imad_tech", country: "Gulf-wide", lang: "ar", note: "1.5M TikTok" },
  { name: "EMKWAN Reviews", handle: "emkwanreviews", platform: "youtube", url: "https://www.youtube.com/@emkwanreviews", country: "UAE", lang: "en", note: "Abu Dhabi · FF8 roster" },
  { name: "Raqami TV رقمي", handle: "RaqamiTV", platform: "youtube", url: "https://www.youtube.com/@RaqamiTV", country: "Gulf-wide", lang: "ar", note: "FF8 roster" },
  { name: "Android Basha", handle: "AndroidBasha", platform: "youtube", url: "https://www.youtube.com/@AndroidBasha", country: "Pan-Arab", lang: "ar", note: "FF8 roster" },
  { name: "Omardizer", handle: "omardizer", platform: "youtube", url: "https://www.youtube.com/@omardizer", country: "Pan-Arab", lang: "ar", note: "FF8 roster" },
  { name: "Slorks", handle: "slorks", platform: "youtube", url: "https://www.youtube.com/@slorks", country: "Gulf-wide", lang: "ar", note: "FF8 roster" },
  { name: "Issudeen Ibrahim", handle: "issutechy", platform: "instagram", url: "https://www.instagram.com/issutechy/", country: "KSA", lang: "en", note: "552K IG" },
  { name: "بدر منصور GameTech", handle: "gametech_sa", platform: "instagram", url: "https://www.instagram.com/gametech_sa/", country: "KSA", lang: "ar" },
  { name: "Feras Alsarami", handle: "realferas", platform: "instagram", url: "https://www.instagram.com/realferas/", country: "KSA", lang: "ar" },
  { name: "يزن — تفاحة", handle: "1.o8v", platform: "instagram", url: "https://www.instagram.com/1.o8v/", country: "KSA", lang: "ar", note: "Apple-focused" },
  { name: "WoLF Tech الذئب التقني", handle: "wolf.tech11", platform: "instagram", url: "https://www.instagram.com/wolf.tech11/", country: "KSA", lang: "ar" },
  { name: "SmartphonesRevealed", handle: "smartphonesrevealed70", platform: "youtube", url: "https://www.youtube.com/@smartphonesrevealed70", country: "Pan-Arab", lang: "ar" },
  { name: "فيصل التقني", handle: "faisal_sabahii", platform: "x", url: "https://x.com/faisal_sabahii", country: "Oman", lang: "ar" },
  { name: "عالم التقنية", handle: "TechWD", platform: "x", url: "https://x.com/TechWD", country: "KSA", lang: "ar", note: "Media" },
  { name: "Wired Middle East", handle: "WiredMiddleEast", platform: "x", url: "https://x.com/WiredMiddleEast", country: "UAE", lang: "en", note: "Media" },
]

// Hashtags & search terms the scrapers monitor (shown as chips in the UI).
export const IFOLD_TRACKED_TERMS = [
  "#iPhoneFold",
  "#iPhoneDuo",
  "#AppleEvent",
  "#iPhone18Pro",
  "iPhone Fold vs Galaxy Fold",
  "آيفون القابل للطي",
  "ايفون فولد",
  "ايفون ديو",
  "مؤتمر أبل",
  "سامسونج ولا ابل",
]

export function formatCompactNum(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  return num.toLocaleString()
}
