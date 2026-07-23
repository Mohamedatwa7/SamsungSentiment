import { gzipSync } from "zlib"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  instagramIdToShortcode,
  instagramShortcodeToId,
  instagramShortcodeFromUrl,
} from "@/lib/instagram-id"

// Paginate in small pages: with 8+ JSONB projections per row, 1000-row pages
// exceed the DB statement timeout on a cold cache — 500-row pages stay under
// it (each statement does half the detoast work).
const PAGE_SIZE = 500

// Narrow column lists — selecting * would drag the full raw_data JSONB for
// tens of thousands of rows and blow Supabase's statement timeout. The two
// raw_data subfields the post-resolver needs are projected out individually.
// Per-platform column lists: JSONB projections are the expensive part of the
// scan (each one detoasts raw_data per row), so every platform only pays for
// the author fields it actually needs. Twitter needs none — the post URL
// carries the profile.
const POST_BASE_COLUMNS =
  "external_id,platform,post_url,caption,likes_count,views_count,published_at"
const POST_COLUMNS_BY_PLATFORM: Record<string, string> = {
  instagram: `${POST_BASE_COLUMNS},short_code:raw_data->>shortCode,owner_ig:raw_data->>ownerUsername`,
  tiktok: `${POST_BASE_COLUMNS},owner_tt:raw_data->authorMeta->>name`,
  facebook: `${POST_BASE_COLUMNS},owner_fb:raw_data->>pageName,src_input:raw_data->>inputUrl,src_fb:raw_data->>facebookUrl`,
  twitter: POST_BASE_COLUMNS,
}

// The tables also hold retailer/operator accounts (Xcite, Sharaf DG, Ooredoo,
// Zain, stc, Omantel, du, Vodafone, e&, ...) from other scrapes. This
// dashboard is strictly @samsunggulf: keep only brand-authored posts. Brand
// reels/tweets sometimes lack author metadata, so fall back to the post URL /
// scrape-input URL, which carries the profile.
function isBrandPost(p: any): boolean {
  const s = (v: unknown) => String(v || "").toLowerCase().replace(/\s+/g, "")
  switch (p.platform) {
    case "instagram":
      return s(p.owner_ig) === "samsunggulf"
    case "tiktok":
      return s(p.owner_tt) === "samsunggulf"
    case "facebook":
      return (
        s(p.owner_fb) === "samsunggulf" ||
        s(p.src_input).includes("/samsunggulf") ||
        s(p.src_fb).includes("/samsunggulf")
      )
    case "twitter":
      return s(p.owner_tw) === "samsunggulf" || s(p.post_url).includes("/samsunggulf/")
    default:
      return false
  }
}
const COMMENT_COLUMNS =
  "external_id,external_post_id,platform,text,author_username,published_at," +
  "sentiment,sentiment_score,sentiment_analyzed_at,flags,likes_count,features," +
  "product_model,department,raw_post_ref:raw_data->>postId,raw_post_url:raw_data->>postUrl"

async function fetchAll(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  columns: string,
  platform?: string,
): Promise<any[]> {
  // Pages with JSONB projections can trip the statement timeout on a cold
  // cache; the failed attempt warms the buffers, so retry before giving up —
  // and NEVER return partial data (a truncated payload gets edge-cached and
  // silently hides most of the corpus). Galaxy Unpacked / FF8 roster rows are
  // excluded with cheap text predicates, not JSONB reads.
  const fetchPage = async (from: number): Promise<any[]> => {
    let lastError = ""
    for (let attempt = 0; attempt < 5; attempt++) {
      let q = supabase
        .from(table)
        .select(columns)
        .not("external_id", "like", "unpacked\\_%")
        .not("external_id", "like", "roster\\_%")
      if (platform) q = q.eq("platform", platform)
      const { data, error } = await q.order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1)
      if (!error) return data || []
      lastError = error.message
      console.error(`[v0] ${table}/${platform || "all"} page at ${from} attempt ${attempt + 1} failed:`, error.message)
      await new Promise((r) => setTimeout(r, 600))
    }
    throw new Error(`Fetching ${table} failed at offset ${from}: ${lastError}`)
  }

  // SEQUENTIAL paging on purpose: parallel page fetches contend for the same
  // cold buffers and every statement trips the DB timeout (tried CONCURRENCY
  // 6 — the endpoint 500'd consistently). Sequential pages warm the cache as
  // they go and reliably complete; the day-long stale-while-revalidate below
  // keeps this rebuild off the user's request path.
  const all: any[] = []
  let from = 0
  while (true) {
    const page = await fetchPage(from)
    if (page.length === 0) break
    all.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

// Flagship-feature detection so feature-level KPIs work on live data.
const FEATURE_RULES: { pattern: RegExp; feature: string }[] = [
  { pattern: /nightography|night\s*mode|night\s*photo/i, feature: "nightography" },
  { pattern: /privacy\s*display|privacy\s*screen/i, feature: "privacy_display" },
  { pattern: /horizontal\s*lock|super\s*steady/i, feature: "horizontal_lock" },
  { pattern: /galaxy\s*ai|ai\s*feature|photo\s*assist/i, feature: "galaxy_ai" },
]
function extractFeatures(text: string): string[] {
  const out: string[] = []
  for (const rule of FEATURE_RULES) {
    if (rule.pattern.test(text)) out.push(rule.feature)
  }
  return out
}

// Lightweight keyword fallback ONLY for comments that have not been analyzed
// by the LLM yet (sentiment column is null). Stored LLM sentiment is preferred.
function fallbackSentiment(text: string): "positive" | "negative" | "neutral" {
  const t = (text || "").toLowerCase()
  const pos = ["love", "amazing", "great", "awesome", "perfect", "best", "excellent", "حلو", "روعة", "ممتاز", "جميل"]
  const neg = ["hate", "terrible", "worst", "bad", "awful", "broken", "waste", "problem", "issue", "سيء", "مشكلة", "خربان"]
  let p = 0
  let n = 0
  for (const w of pos) if (t.includes(w)) p++
  for (const w of neg) if (t.includes(w)) n++
  if (p > n) return "positive"
  if (n > p) return "negative"
  return "neutral"
}

// Classify a post by department/product for segmentation when not stored.
// Word-boundary patterns, NOT substring matches: a football caption saying
// "watch the match" must not classify as Galaxy Watch, "the frame of the
// shot" must not become a TV, etc.
function classifyContent(text: string): { department: string; category: string; model: string } {
  const t = (text || "").toLowerCase()

  // Specific devices first (most precise signals win)
  if (/galaxy\s?watch|watch\s?\d|smartwatch/.test(t))
    return { department: "MX", category: "Wearable", model: "Galaxy Watch" }
  if (/\bbuds\b|galaxy\s?buds/.test(t))
    return { department: "MX", category: "Wearable", model: "Galaxy Buds" }
  if (/galaxy\s?ring/.test(t))
    return { department: "MX", category: "Wearable", model: "Galaxy Ring" }
  if (/galaxy\s?tab|\btab\s?s\d/.test(t))
    return { department: "MX", category: "Tablet", model: "Galaxy Tab" }

  if (/\bs2[4-6]\b|galaxy\s?s2[4-6]/.test(t)) {
    return { department: "MX", category: "Smartphone", model: /ultra/.test(t) ? "Galaxy S Series Ultra" : "Galaxy S Series" }
  }
  if (/\bz?\s?fold\b|trifold/.test(t)) return { department: "MX", category: "Smartphone", model: "Galaxy Z Fold" }
  if (/\bz?\s?flip\b/.test(t)) return { department: "MX", category: "Smartphone", model: "Galaxy Z Flip" }
  if (/galaxy\s?a\d{2}\b|\bgalaxya\d{2}\b|#galaxya\b|galaxy\s?a\b/.test(t))
    return { department: "MX", category: "Smartphone", model: "Galaxy A Series" }
  if (/galaxy\s?s\b|\bphone\b|smartphone/.test(t))
    return { department: "MX", category: "Smartphone", model: "Galaxy Smartphone" }

  if (/\btv\b|neo\s?qled|\bqled\b|\boled\b|the\s?frame\b|micro\s?(led|rgb)|soundbar|crystal\s?uhd/.test(t))
    return { department: "VD", category: "TV", model: "Samsung TV" }

  if (/fridge|refrigerator|washer|washing\s?machine|dishwasher|\bbespoke\b|air\s?conditioner|vacuum/.test(t))
    return { department: "DA", category: "Home Appliance", model: "Bespoke Appliance" }

  return { department: "Brand", category: "Other", model: "General" }
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()

    // Posts platform-by-platform (each with minimal projections), then
    // comments — all strictly sequential: concurrent statements contend for
    // cold buffers and trip the DB timeout. Unpacked/roster rows are excluded
    // SQL-side.
    const igPosts = await fetchAll(supabase, "social_posts", POST_COLUMNS_BY_PLATFORM.instagram, "instagram")
    const ttPosts = await fetchAll(supabase, "social_posts", POST_COLUMNS_BY_PLATFORM.tiktok, "tiktok")
    const fbPosts = await fetchAll(supabase, "social_posts", POST_COLUMNS_BY_PLATFORM.facebook, "facebook")
    const twPosts = await fetchAll(supabase, "social_posts", POST_COLUMNS_BY_PLATFORM.twitter, "twitter")
    const supabaseComments = await fetchAll(supabase, "social_comments", COMMENT_COLUMNS)
    const allPosts = [...igPosts, ...ttPosts, ...fbPosts, ...twPosts]

    // Strictly @samsunggulf. Excluded (retailer/operator) posts still register
    // their aliases below so their comments can be dropped too.
    const supabasePosts = allPosts.filter(isBrandPost)
    const excludedPosts = allPosts.filter((p: any) => !isBrandPost(p))

    // Map posts. Register every alias a comment might use to reference its
    // parent post — external id, Instagram shortcode AND numeric media id
    // (two encodings of the same number), and the post URL itself — because
    // historical imports and different actors used different key schemes.
    const postKeyIndex = new Map<string, { externalId: string; url: string; excluded?: boolean }>()
    const registerPostKey = (
      key: string | null | undefined,
      entry: { externalId: string; url: string; excluded?: boolean },
    ) => {
      if (!key) return
      if (!postKeyIndex.has(key)) postKeyIndex.set(key, entry)
    }
    const posts = supabasePosts.map((p: any) => {
      const classification = classifyContent(p.caption || "")
      const url = p.post_url || p.url || ""
      const entry = { externalId: String(p.external_id || ""), url }
      registerPostKey(p.external_id, entry)
      registerPostKey(url, entry)
      registerPostKey(url.replace(/\/+$/, ""), entry)
      if (p.platform === "facebook") {
        // Facebook URLs reference the same item under several shapes
        // (reel/{id}, videos/{id}, posts/{id}) — alias every numeric id found.
        for (const m of url.matchAll(/\/(\d{10,})/g)) registerPostKey(m[1], entry)
      }
      if (p.platform === "instagram") {
        const extId = String(p.external_id || "")
        registerPostKey(p.short_code, entry)
        if (/^\d+$/.test(extId)) registerPostKey(instagramIdToShortcode(extId), entry)
        else registerPostKey(instagramShortcodeToId(extId), entry)
        registerPostKey(instagramShortcodeFromUrl(url), entry)
      }
      return {
        id: `supabase-${p.external_id}`,
        platform: p.platform,
        url,
        caption: p.caption || "",
        owner: "samsunggulf",
        timestamp: p.published_at,
        likes: p.likes_count || 0,
        views: p.views_count || 0,
        department: classification.department,
        productCategory: classification.category,
        productModel: classification.model,
        features: extractFeatures(p.caption || ""),
        source: "synced",
      }
    })

    // Register aliases for non-brand posts (after brand posts, so brand wins
    // any collision) so their comments resolve to an excluded entry and get
    // dropped — retailer/operator comment threads must not leak into brand
    // sentiment.
    for (const p of excludedPosts) {
      const url = String(p.post_url || "")
      const entry = { externalId: String(p.external_id || ""), url, excluded: true }
      registerPostKey(p.external_id, entry)
      registerPostKey(url, entry)
      registerPostKey(url.replace(/\/+$/, ""), entry)
      if (p.platform === "facebook") {
        for (const m of url.matchAll(/\/(\d{10,})/g)) registerPostKey(m[1], entry)
      }
      if (p.platform === "instagram") {
        const extId = String(p.external_id || "")
        registerPostKey(p.short_code, entry)
        if (/^\d+$/.test(extId)) registerPostKey(instagramIdToShortcode(extId), entry)
        else registerPostKey(instagramShortcodeToId(extId), entry)
        registerPostKey(instagramShortcodeFromUrl(url), entry)
      }
    }

    // Resolve a comment's parent post through any of the registered aliases.
    const resolvePost = (c: any): { externalId: string; url: string; excluded?: boolean } | undefined => {
      const refs: (string | null | undefined)[] = [
        c.external_post_id,
        c.raw_post_ref,
        c.raw_post_url,
      ]
      for (const ref of refs) {
        if (!ref) continue
        const key = String(ref)
        let hit =
          postKeyIndex.get(key) ||
          postKeyIndex.get(key.replace(/\/+$/, "")) ||
          (c.platform === "instagram"
            ? postKeyIndex.get(
                (/^\d+$/.test(key) ? instagramIdToShortcode(key) : instagramShortcodeToId(key)) || "",
              )
            : undefined) ||
          postKeyIndex.get(instagramShortcodeFromUrl(key) || "")
        if (!hit && c.platform === "facebook") {
          for (const m of key.matchAll(/\/(\d{10,})/g)) {
            hit = postKeyIndex.get(m[1])
            if (hit) break
          }
        }
        if (hit) return hit
      }
      return undefined
    }

    // Map comments. Prefer stored LLM sentiment; fall back to keywords only when
    // the comment has not been analyzed yet. Comments on excluded
    // (retailer/operator) posts are dropped; unresolved comments are kept —
    // the comment pipeline only scrapes brand threads.
    let analyzed = 0
    const comments = supabaseComments.flatMap((c: any) => {
      const sentiment = c.sentiment || fallbackSentiment(c.text || "")
      const parent = resolvePost(c)
      if (parent?.excluded) return []
      if (c.sentiment_analyzed_at) analyzed++
      return {
        id: `supabase-${c.external_id}`,
        postId: `supabase-${parent?.externalId || c.external_post_id}`,
        postUrl: parent?.url || "",
        platform: c.platform,
        text: c.text || "",
        username: c.author_username || "anonymous",
        createdAt: c.published_at,
        sentiment,
        sentimentScore: c.sentiment_score ?? null,
        sentimentFlags: c.flags || [],
        likes: c.likes_count || 0,
        features: [...new Set([...(c.features || []), ...extractFeatures(c.text || "")])],
        productModel: c.product_model || null,
        department: c.department || null,
        source: "synced",
      }
    })

    const payload = {
      posts,
      comments,
      meta: {
        totalPosts: posts.length,
        totalComments: comments.length,
        analyzedComments: analyzed,
        unanalyzedComments: comments.length - analyzed,
      },
    }

    // Gzip in the route: the raw payload is ~18MB, which exceeds Vercel's
    // 10MB edge-cache limit — so the response was NEVER cached and every
    // visitor paid the full DB rebuild. Compressed (~2MB) it caches, and
    // browsers decompress Content-Encoding transparently.
    const body = gzipSync(Buffer.from(JSON.stringify(payload)))
    return new NextResponse(body as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
        Vary: "Accept-Encoding",
        // Serve stale for up to a day while revalidating in the background:
        // data changes only on scheduled syncs, and nobody should ever sit
        // through the full DB rebuild — the edge refreshes itself off the
        // request path.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    })
  } catch (error) {
    console.error("[v0] Error fetching comments:", error)
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}
