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
// Keyset (gt cursor) pagination, not OFFSET: with the leading platform
// equality the cursor continues the composite-index walk right where the
// previous page stopped, so every page does bounded work — offset pages
// re-walk the index from the start and their cost compounds as the corpus
// grows. external_id is unique within a platform, so the cursor never skips.
async function fetchPrefixedComments(supabase: any, prefix: string, columns: string): Promise<any[]> {
  const rows: any[] = []
  for (const platform of STORAGE_PLATFORMS) {
    let cursor: string | null = null
    while (true) {
      const after = cursor
      const page = await withRetry<any[]>(`comments ${prefix}/${platform}`, () => {
        let q = supabase
          .from("social_comments")
          .select(columns)
          .eq("platform", platform)
          .like("external_id", `${prefix}%`)
        if (after !== null) q = q.gt("external_id", after)
        return q.order("external_id", { ascending: true }).limit(PAGE_SIZE)
      })
      if (page.length === 0) break
      rows.push(...page)
      cursor = String(page[page.length - 1].external_id)
      if (page.length < PAGE_SIZE) break
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
    //
    // DESCENDING keyset walk with a PER-PLATFORM cap. The old cumulative
    // 12k cap was order-sensitive: instagram+tiktok filled it first, the
    // ascending walk of platform="twitter" then stopped mid-way — and since
    // tweet ids sort before "ifold_news_"/"ifold_yt_", YouTube rows dropped
    // out of the payload entirely (dashboard showed no YT from Sep 15).
    // Descending, whatever a cap cuts is the ids that sort first — for the
    // chronological tweet/IG ids that's the OLDEST rows, never the newest.
    const PER_PLATFORM_FETCH_CAP = 9000
    const fetchPostRows = async (): Promise<any[]> => {
      const rows: any[] = []
      // ifold posts only ever store under these three platform values.
      for (const platform of ["instagram", "tiktok", "twitter"]) {
        let fetched = 0
        let cursor: string | null = null
        while (fetched < PER_PLATFORM_FETCH_CAP) {
          const before = cursor
          const page = await withRetry<any[]>(`posts query/${platform}`, () => {
            let q = supabase
              .from("social_posts")
              .select(
                "external_id,platform,post_url,caption,likes_count,comments_count," +
                  "shares_count,views_count,published_at," +
                  "_analysis:raw_data->_analysis,_focus:raw_data->>_focus,_gcc:raw_data->_gcc," +
                  "_source:raw_data->>_source,_sourceLang:raw_data->>_sourceLang," +
                  "_title:raw_data->>title,_owner:raw_data->>ownerUsername," +
                  "_ttAuthor:raw_data->authorMeta->>name,_xAuthor:raw_data->author->>userName," +
                  "_channel:raw_data->>channelName,_channelU:raw_data->>channelUsername," +
                  "_shortCode:raw_data->>shortCode,_seed:raw_data->_seed",
              )
              .eq("platform", platform)
              .like("external_id", `${IFOLD_ID_PREFIX}%`)
            if (before !== null) q = q.lt("external_id", before)
            return q.order("external_id", { ascending: false }).limit(PAGE_SIZE)
          })
          rows.push(...page)
          fetched += page.length
          if (page.length < PAGE_SIZE) break
          cursor = String(page[page.length - 1].external_id)
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

      // Hashtag-wall captions run to 4000+ chars; the cards never show more
      // than a few lines and the payload has a hard 10MB cacheability budget.
      title = title.length > 300 ? `${title.slice(0, 300)}…` : title

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
        seeded: !!p._seed,
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

      let sentiment: IFoldSentiment = analyzed ? c.sentiment : fallbackSentiment(text)
      // House rule: a comment complimenting / siding with Samsung is ALWAYS
      // shown as positive — in video comment browsers, feeds and drill-downs
      // alike. The competitive stance toward Apple lives in `lean`, so the
      // head-to-head comparison analytics keep their signal.
      if (lean === "samsung") sentiment = "positive"
      if (parent?.commentSentiment) parent.commentSentiment[sentiment]++

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

    // ---- Payload budget ----------------------------------------------------
    // Past ~10MB the edge cannot cache the response AT ALL — every visit
    // then pays a full DB rebuild, which is what melted the DB on launch
    // day +1. Everything below exists to fit that budget while keeping the
    // RECENT story complete: the old likes-only comment cap shipped zero
    // fresh (still unliked) comments and made the last few days look empty
    // on the dashboard even though ingest was landing thousands of rows.

    // Posts: drop stale zero-engagement hashtag spam (nobody surfaces it —
    // it only inflated the payload), then cap newest-first so any overflow
    // sheds the oldest tail, never the recent days.
    const POSTS_CAP = 11000
    const now = Date.now()
    const THREE_DAYS = 3 * 86400000
    const shippedPosts = posts
      .filter((p) => {
        if (p.kind === "news" || p.analysis) return true
        if (p.views + p.likes + p.commentsCount + p.shares > 0) return true
        // Fresh posts keep their slot — engagement counts lag the scrape.
        return now - new Date(p.publishedAt || 0).getTime() < THREE_DAYS
      })
      .slice(0, POSTS_CAP)

    // Omit all-zero commentSentiment objects (the vast majority of posts
    // have no scraped comments) — ~0.5MB of dead weight at current corpus.
    for (const p of shippedPosts) {
      const cs = p.commentSentiment
      if (cs && cs.positive + cs.neutral + cs.negative === 0) delete p.commentSentiment
    }

    // Comments: recent days ship first (likes-sorted within), THEN the
    // all-time likes ranking fills what's left. Without the reserve, a
    // likes-only sort starves every fresh zero-like comment out of the
    // payload and the dashboard reads as "no new data" between syncs.
    const PER_POST_CAP = 80
    const GLOBAL_CAP = 11000
    const RECENT_RESERVE = 7000
    const SEVEN_DAYS = 7 * 86400000
    const recentFirst: IFoldComment[] = []
    const remainder: IFoldComment[] = []
    for (const c of comments) {
      if (recentFirst.length < RECENT_RESERVE && now - new Date(c.publishedAt || 0).getTime() < SEVEN_DAYS) {
        recentFirst.push(c)
      } else {
        remainder.push(c)
      }
    }
    const perPost = new Map<string, number>()
    const shippedComments: IFoldComment[] = []
    for (const c of [...recentFirst, ...remainder]) {
      const n = perPost.get(c.postId) || 0
      if (n >= PER_POST_CAP) continue
      perPost.set(c.postId, n + 1)
      shippedComments.push(c)
      if (shippedComments.length >= GLOBAL_CAP) break
    }

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
      posts: shippedPosts,
      comments: shippedComments,
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
