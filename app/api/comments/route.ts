import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Supabase caps each request at 1000 rows; we paginate to fetch everything.
const PAGE_SIZE = 1000

async function fetchAll(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
): Promise<any[]> {
  const all: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("published_at", { ascending: false })
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
      fetchAll(supabase, "social_posts"),
      fetchAll(supabase, "social_comments"),
    ])

    // Map posts. Keep a lookup from external_id -> our post id so comments can
    // resolve their parent post via external_post_id.
    const postUrlByExternalId = new Map<string, string>()
    const posts = supabasePosts.map((p: any) => {
      const classification = classifyContent(p.caption || "")
      const url = p.post_url || p.url || ""
      if (p.external_id) postUrlByExternalId.set(p.external_id, url)
      return {
        id: `supabase-${p.external_id}`,
        platform: p.platform,
        url,
        caption: p.caption || "",
        owner: "samsunggulf",
        timestamp: p.published_at,
        likes: p.likes_count || 0,
        views: p.views_count || 0,
        department: p.department || classification.department,
        productCategory: p.product_category || classification.category,
        productModel: p.product_model || classification.model,
        features: p.features || [],
        source: "synced",
      }
    })

    // Map comments. Prefer stored LLM sentiment; fall back to keywords only when
    // the comment has not been analyzed yet.
    const comments = supabaseComments.map((c: any) => {
      const sentiment = c.sentiment || fallbackSentiment(c.text || "")
      return {
        id: `supabase-${c.external_id}`,
        postId: `supabase-${c.external_post_id}`,
        postUrl: postUrlByExternalId.get(c.external_post_id) || "",
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
