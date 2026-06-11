import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  instagramIdToShortcode,
  instagramShortcodeToId,
  instagramShortcodeFromUrl,
} from "@/lib/instagram-id"

// Supabase caps each request at 1000 rows; we paginate to fetch everything.
const PAGE_SIZE = 1000

// Narrow column lists — selecting * would drag the full raw_data JSONB for
// tens of thousands of rows and blow Supabase's statement timeout. The two
// raw_data subfields the post-resolver needs are projected out individually.
const POST_COLUMNS =
  "external_id,platform,post_url,caption,likes_count,views_count,published_at," +
  "short_code:raw_data->>shortCode"
const COMMENT_COLUMNS =
  "external_id,external_post_id,platform,text,author_username,published_at," +
  "sentiment,sentiment_score,sentiment_analyzed_at,flags,likes_count,features," +
  "product_model,department,raw_post_ref:raw_data->>postId,raw_post_url:raw_data->>postUrl"

async function fetchAll(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  columns: string,
): Promise<any[]> {
  const all: any[] = []
  let from = 0
  while (true) {
    // Order by primary key — fast btree scan; the dashboard sorts client-side.
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error(`[v0] Error fetching ${table}:`, error.message)
      break
    }
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
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
function classifyContent(text: string): { department: string; category: string; model: string } {
  const lowerText = (text || "").toLowerCase()
  if (lowerText.includes("galaxy s") || lowerText.includes("fold") || lowerText.includes("flip") || lowerText.includes("phone") || lowerText.includes("a5")) {
    if (lowerText.includes("s24") || lowerText.includes("s25") || lowerText.includes("s26")) {
      return { department: "MX", category: "Smartphone", model: lowerText.includes("ultra") ? "Galaxy S Series Ultra" : "Galaxy S Series" }
    }
    if (lowerText.includes("fold")) return { department: "MX", category: "Smartphone", model: "Galaxy Z Fold" }
    if (lowerText.includes("flip")) return { department: "MX", category: "Smartphone", model: "Galaxy Z Flip" }
    if (lowerText.includes("a5")) return { department: "MX", category: "Smartphone", model: "Galaxy A Series" }
    return { department: "MX", category: "Smartphone", model: "Galaxy Smartphone" }
  }
  if (lowerText.includes("watch") || lowerText.includes("buds") || lowerText.includes("ring")) {
    if (lowerText.includes("watch")) return { department: "MX", category: "Wearable", model: "Galaxy Watch" }
    if (lowerText.includes("buds")) return { department: "MX", category: "Wearable", model: "Galaxy Buds" }
    if (lowerText.includes("ring")) return { department: "MX", category: "Wearable", model: "Galaxy Ring" }
    return { department: "MX", category: "Wearable", model: "Galaxy Wearable" }
  }
  if (lowerText.includes("tv") || lowerText.includes("neo qled") || lowerText.includes("oled") || lowerText.includes("frame")) {
    return { department: "VD", category: "TV", model: "Samsung TV" }
  }
  if (lowerText.includes("fridge") || lowerText.includes("washer") || lowerText.includes("bespoke") || lowerText.includes("refrigerator")) {
    return { department: "DA", category: "Home Appliance", model: "Bespoke Appliance" }
  }
  return { department: "Brand", category: "Other", model: "General" }
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()

    const [supabasePosts, supabaseComments] = await Promise.all([
      fetchAll(supabase, "social_posts", POST_COLUMNS),
      fetchAll(supabase, "social_comments", COMMENT_COLUMNS),
    ])

    // Map posts. Register every alias a comment might use to reference its
    // parent post — external id, Instagram shortcode AND numeric media id
    // (two encodings of the same number), and the post URL itself — because
    // historical imports and different actors used different key schemes.
    const postKeyIndex = new Map<string, { externalId: string; url: string }>()
    const registerPostKey = (key: string | null | undefined, entry: { externalId: string; url: string }) => {
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
        features: [],
        source: "synced",
      }
    })

    // Resolve a comment's parent post through any of the registered aliases.
    const resolvePost = (c: any): { externalId: string; url: string } | undefined => {
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
    // the comment has not been analyzed yet.
    const comments = supabaseComments.map((c: any) => {
      const sentiment = c.sentiment || fallbackSentiment(c.text || "")
      const parent = resolvePost(c)
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
        features: c.features || [],
        productModel: c.product_model || null,
        department: c.department || null,
        source: "synced",
      }
    })

    const analyzed = supabaseComments.filter((c: any) => c.sentiment_analyzed_at).length

    return NextResponse.json({
      posts,
      comments,
      meta: {
        totalPosts: posts.length,
        totalComments: comments.length,
        analyzedComments: analyzed,
        unanalyzedComments: comments.length - analyzed,
      },
    })
  } catch (error) {
    console.error("[v0] Error fetching comments:", error)
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}
