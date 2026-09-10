import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { instagramShortcodeToId, instagramShortcodeFromUrl } from "@/lib/instagram-id"
import {
  IFOLD_ID_PREFIX,
  IFOLD_NEWS_PREFIX,
  IFOLD_YT_PREFIX,
  stripIFoldPrefix,
  isGccText,
} from "@/lib/ifold-sync"
import { UNPACKED_ID_PREFIX } from "@/lib/unpacked-sync"
import { ROSTER_ID_PREFIX } from "@/lib/roster-sync"
import {
  IFOLD_LAUNCH_AT,
  IFOLD_TRACKING_START,
  IFOLD_TRACKING_END,
  ifoldTrackingEnded,
  parseIFoldFlags,
  type IFoldComment,
  type IFoldPayload,
  type IFoldPost,
  type IFoldSamsungBaseline,
  type IFoldSentiment,
} from "@/lib/ifold-data"

// Always read live from Supabase — never prerendered at build time.
export const dynamic = "force-dynamic"
// Cold-cache rebuilds page through ~15k rows across four queries; the
// default function budget cuts them off mid-retry.
export const maxDuration = 300

const PAGE_SIZE = 1000

// Keyword fallback for comments the LLM has not scored yet — mirrors
// /api/unpacked so items don't read as blank pre-analysis.
function fallbackSentiment(text: string): IFoldSentiment {
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

// Cold-cache statement timeouts: the failed attempt warms the buffers, so a
// short-delay retry succeeds. Never return partial data.
async function withRetry<T>(
  label: string,
  fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  attempts = 5,
): Promise<T> {
  let lastError = "unknown"
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await fn()
    if (!error) return (data || []) as T
    lastError = error.message
    console.error(`[ifold] ${label} attempt ${i + 1} failed:`, error.message)
    await new Promise((r) => setTimeout(r, 600))
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastError}`)
}

// The storage check-constraint allows exactly these platform values.
const STORAGE_PLATFORMS = ["instagram", "tiktok", "twitter", "facebook"]

// Query per platform: with the leading equality the planner serves
// eq(platform) + order(external_id) + limit straight from the existing
// (platform, external_id) unique index — a prefix LIKE alone forces a
// full-table scan + sort, which started exceeding the statement timeout
// once the launch-week corpus and upsert churn fattened the table.
async function fetchPrefixedComments(supabase: any, prefix: string, columns: string): Promise<any[]> {
  const rows: any[] = []
  for (const platform of STORAGE_PLATFORMS) {
    let from = 0
    while (true) {
      const page = await withRetry<any[]>(`comments ${prefix}/${platform}`, () =>
        supabase
          .from("social_comments")
          .select(columns)
          .eq("platform", platform)
          .like("external_id", `${prefix}%`)
          .order("external_id", { ascending: true })
          .range(from, from + PAGE_SIZE - 1),
      )
      if (page.length === 0) break
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }
  return rows
}

// Maps the Samsung-side analyzer's flags (lib/sentiment.ts vocabulary) onto
// the shared competition topic taxonomy for the head-to-head panel.
const SAMSUNG_FLAG_TOPICS: Record<string, string> = {
  price_complaint: "price",
  battery_issue: "battery",
  camera_praise: "cameras",
  software_bug: "software",
  green_line_defect: "display",
  overheating: "durability",
  warranty_issue: "durability",
  ai_content_backlash: "ai_features",
}

// Persist every successfully built payload to Supabase Storage. The public
// CDN file is the page's guaranteed fallback: it loads in ~1s regardless of
// DB health, so the dashboard always paints even mid-outage or on a cold
// cache after a deploy.
async function persistSnapshot(payload: IFoldPayload): Promise<void> {
  try {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const upload = () =>
      admin.storage.from("snapshots").upload("ifold.json", JSON.stringify(payload), {
        upsert: true,
        contentType: "application/json",
        cacheControl: "300",
      })
    let { error } = await upload()
    if (error && /bucket/i.test(error.message)) {
      await admin.storage.createBucket("snapshots", { public: true }).catch(() => undefined)
      ;({ error } = await upload())
    }
    if (error) console.error("[ifold] snapshot persist failed:", error.message)
  } catch (e) {
    console.error("[ifold] snapshot persist failed:", e)
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    // Paged like the comments — Supabase caps a single request at 1000 rows
    // regardless of .limit(), and the corpus passed that on day 2. Project
    // ONLY the raw_data keys the payload uses: detoasting the full scrape
    // JSON across thousands of rows trips the cold-cache statement timeout
    // (the launch-week corpus took this route down on Sep 10).
    const fetchPostRows = async (): Promise<any[]> => {
      const rows: any[] = []
      // Per-platform for the same index-path reason as fetchPrefixedComments.
      for (const platform of STORAGE_PLATFORMS) {
        for (let from = 0; ; from += PAGE_SIZE) {
          const page = await withRetry<any[]>(`posts query/${platform}`, () =>
            supabase
              .from("social_posts")
              .select(
                "external_id,platform,post_url,caption,likes_count,comments_count," +
                  "shares_count,views_count,published_at," +
                  "_analysis:raw_data->_analysis,_focus:raw_data->>_focus,_gcc:raw_data->_gcc," +
                  "_source:raw_data->>_source,_sourceLang:raw_data->>_sourceLang," +
                  "_title:raw_data->>title,_owner:raw_data->>ownerUsername," +
                  "_ttAuthor:raw_data->authorMeta->>name,_xAuthor:raw_data->author->>userName," +
                  "_channel:raw_data->>channelName,_channelU:raw_data->>channelUsername," +
                  "_shortCode:raw_data->>shortCode",
              )
              .eq("platform", platform)
              .like("external_id", `${IFOLD_ID_PREFIX}%`)
              .order("external_id", { ascending: true })
              .range(from, from + PAGE_SIZE - 1),
          )
          rows.push(...page)
          if (page.length < PAGE_SIZE || rows.length >= 12000) break
        }
      }
      return rows
    }

    // Two parallel pairs, not four-wide: concurrent rebuilds already stack up
    // when the cache is cold (page retries, edge revalidation, cache warmer),
    // and four-wide × several rebuilds pegged the DB into statement timeouts.
    const [postRows, commentRows] = await Promise.all([
      fetchPostRows(),
      fetchPrefixedComments(
        supabase,
        IFOLD_ID_PREFIX,
        "external_id,external_post_id,platform,text,author_username,likes_count," +
          "published_at,sentiment,sentiment_score,sentiment_analyzed_at,flags," +
          "_platform:raw_data->_platform,_gcc:raw_data->_gcc",
      ),
    ])
    const [unpackedBaselineRows, rosterBaselineRows] = await Promise.all([
      fetchPrefixedComments(supabase, UNPACKED_ID_PREFIX, "external_id,sentiment,flags,sentiment_analyzed_at"),
      fetchPrefixedComments(supabase, ROSTER_ID_PREFIX, "external_id,sentiment,flags,sentiment_analyzed_at"),
    ])

    // ---- Normalize posts + register comment-parent aliases ----------------
    const posts: IFoldPost[] = []
    const aliasToPost = new Map<string, IFoldPost>()
    const register = (key: string | null | undefined, post: IFoldPost) => {
      if (key && !aliasToPost.has(key)) aliasToPost.set(key, post)
    }

    for (const p of postRows) {
      const ext = String(p.external_id || "")
      const url = p.post_url || ""
      const isNews = ext.startsWith(IFOLD_NEWS_PREFIX)
      const isYt = ext.startsWith(IFOLD_YT_PREFIX)
      const realId = stripIFoldPrefix(ext).replace(/^(news_|yt_)/, "")

      let platform: IFoldPost["platform"]
      let author = "unknown"
      let title = p.caption || ""
      if (isNews) {
        platform = "news"
        author = p._source || "News"
        title = p._title || title.split("\n")[0]
      } else if (isYt) {
        platform = "youtube"
        author = p._channel || p._channelU || "YouTube"
      } else if (p.platform === "instagram") {
        platform = "instagram"
        author = p._owner || "unknown"
      } else if (p.platform === "tiktok") {
        platform = "tiktok"
        author = p._ttAuthor || "unknown"
      } else {
        platform = "twitter"
        author = p._xAuthor || "unknown"
      }

      const analysisRaw = p._analysis as { sentiment: IFoldSentiment; score: number; flags: string[] } | undefined
      const parsed = analysisRaw ? parseIFoldFlags(analysisRaw.flags) : null

      const post: IFoldPost = {
        id: ext,
        kind: isNews ? "news" : "social",
        platform,
        url,
        title,
        author,
        source: isNews ? p._source || null : null,
        sourceLang: isNews ? p._sourceLang || null : null,
        publishedAt: p.published_at || null,
        views: Math.max(0, p.views_count || 0),
        likes: Math.max(0, p.likes_count || 0),
        commentsCount: Math.max(0, p.comments_count || 0),
        shares: Math.max(0, p.shares_count || 0),
        focus: p._focus === "launch" ? "launch" : "fold",
        gcc: !!p._gcc,
        analysis: analysisRaw
          ? {
              sentiment: analysisRaw.sentiment,
              score: analysisRaw.score ?? null,
              topics: parsed!.topics,
              lean: parsed!.lean,
            }
          : null,
        commentSentiment: { positive: 0, neutral: 0, negative: 0 },
      }
      posts.push(post)

      register(realId, post)
      register(url.replace(/\/+$/, ""), post)
      if (platform === "instagram") {
        const sc = instagramShortcodeFromUrl(url) || p._shortCode
        register(sc, post)
        if (sc) register(instagramShortcodeToId(sc), post)
        if (!/^\d+$/.test(realId)) register(instagramShortcodeToId(realId), post)
      }
    }

    // ---- Normalize comments, attach to parents ----------------------------
    const comments: IFoldComment[] = []
    for (const c of commentRows) {
      const text = c.text || ""
      const analyzed = !!c.sentiment_analyzed_at && !!c.sentiment
      const { topics, lean } = parseIFoldFlags(c.flags)
      const ref = String(c.external_post_id || "")
      const parent =
        aliasToPost.get(ref) ||
        aliasToPost.get(ref.replace(/\/+$/, "")) ||
        (c.platform === "instagram" && !/^\d+$/.test(ref)
          ? aliasToPost.get(instagramShortcodeToId(ref) || "")
          : undefined)

      const sentiment: IFoldSentiment = analyzed ? c.sentiment : fallbackSentiment(text)
      if (parent) parent.commentSentiment[sentiment]++

      comments.push({
        id: String(c.external_id),
        postId: parent?.id || ref,
        platform: c._platform || c.platform,
        text,
        author: c.author_username || "anonymous",
        likes: c.likes_count || 0,
        publishedAt: c.published_at || null,
        sentiment,
        score: c.sentiment_score ?? null,
        topics,
        lean,
        analyzed,
        gcc: c._gcc ?? isGccText(text),
      })
    }

    // Newest first — the launch-night feed reads top-down.
    posts.sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    comments.sort((a, b) => b.likes - a.likes)

    // ---- Samsung Fold8 baseline (Galaxy Unpacked + FF8 roster corpus) -----
    const baseline: IFoldSamsungBaseline = {
      analyzed: 0,
      sentiment: { positive: 0, neutral: 0, negative: 0 },
      topics: {},
    }
    for (const rows of [unpackedBaselineRows, rosterBaselineRows]) {
      for (const r of rows) {
        if (!r.sentiment_analyzed_at || !r.sentiment) continue
        baseline.analyzed++
        baseline.sentiment[r.sentiment as IFoldSentiment]++
        for (const flag of r.flags || []) {
          const topic = SAMSUNG_FLAG_TOPICS[flag]
          if (!topic) continue
          const slot = (baseline.topics[topic] ||= { positive: 0, negative: 0 })
          if (r.sentiment === "positive") slot.positive++
          else if (r.sentiment === "negative") slot.negative++
        }
      }
    }

    const payload: IFoldPayload = {
      posts,
      comments,
      samsungBaseline: baseline,
      meta: {
        generatedAt: new Date().toISOString(),
        launchAt: IFOLD_LAUNCH_AT.toISOString(),
        trackingStart: IFOLD_TRACKING_START.toISOString(),
        trackingEndsAt: IFOLD_TRACKING_END.toISOString(),
        trackingEnded: ifoldTrackingEnded(),
      },
    }

    await persistSnapshot(payload)

    return NextResponse.json(payload, {
      headers: {
        // Fresh for 10 minutes, then serve stale instantly while the edge
        // revalidates in the background — the slow cold rebuild never sits
        // on a visitor's request path. Data only changes on sync cycles, so
        // longer freshness costs nothing.
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
      },
    })
  } catch (error) {
    console.error("[ifold] Error building payload:", error)
    return NextResponse.json({ error: "Failed to fetch Competition Watch data" }, { status: 500 })
  }
}
