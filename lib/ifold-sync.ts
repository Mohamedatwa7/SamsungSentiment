// Competition Watch sync — Apple iPhone Duo launch tracking.
// ("iPhone Duo" is the official name from the Sep 9 2026 keynote; the press
// called it "iPhone Fold" through the rumor cycle, hence the ifold_ keys.)
//
// Ingests iPhone Duo / iPhone 18 launch conversations across Instagram,
// TikTok, X, YouTube (Apify actors) and GCC/global tech press (RSS), lands
// everything in the SAME social_posts / social_comments tables as the other
// pipelines, tagged with the ifold_ external_id prefix + raw_data._ifold.
// /api/comments excludes those rows and /api/ifold selects only them.
//
// Storage notes (same workarounds as lib/roster-sync.ts):
// - The platform column only accepts the original four values, so YouTube
//   rows store platform="twitter" with an ifold_yt_ key and raw_data._platform
//   = "youtube"; news articles store platform="twitter" with an ifold_news_
//   key and raw_data._platform = "news". The APIs re-map them on read.
// - Several actors are shared with the brand/unpacked/roster pipelines. That
//   is safe in BOTH directions because every ingest pass is marker-filtered:
//   ours keeps only fold/launch-matching items, theirs keep only brand-
//   authored / campaign-matching / parent-matched items.

import { createClient } from "@/lib/supabase/server"
import { getLatestRuns, getDatasetItems } from "@/lib/apify-sync"
import { instagramShortcodeToId, instagramShortcodeFromUrl } from "@/lib/instagram-id"
import { youtubeVideoId } from "@/lib/roster-sync"
import { analyzeIFoldItems } from "@/lib/ifold-sentiment"
import {
  IFOLD_NEWS_FEEDS,
  IFOLD_TRACKING_START,
  type IFoldFocus,
} from "@/lib/ifold-data"

const APIFY_TOKEN = process.env.APIFY_API_TOKEN

export const IFOLD_ID_PREFIX = "ifold_"
// YouTube/news rows live under platform="twitter" — the sub-prefix keeps them
// distinguishable (and still matches the ifold_% predicate everywhere).
export const IFOLD_YT_PREFIX = `${IFOLD_ID_PREFIX}yt_`
export const IFOLD_NEWS_PREFIX = `${IFOLD_ID_PREFIX}news_`

export function stripIFoldPrefix(id: string): string {
  return id.startsWith(IFOLD_ID_PREFIX) ? id.slice(IFOLD_ID_PREFIX.length) : id
}

export const IFOLD_ACTORS = {
  instagramHashtag: "reGe1ST3OBgYZSsZJ", // apify/instagram-hashtag-scraper
  instagramComments: "SbK00X0JYCPblD2wp", // apify/instagram-comment-scraper
  // Profile scrapers shared with the roster pipeline: its daily FF8-roster
  // runs and our Apple-account runs land under the same actors, and the
  // marker-filtered ingest below reads BOTH — that's how the Samsung
  // influencer roster's Duo coverage flows into this section for free.
  instagramProfiles: "dSCLg0C3YEZ83HzYX", // apify/instagram-profile-scraper (latestPosts)
  tiktokProfiles: "0FXVyOXXEmdGcV88a", // clockworks/tiktok-profile-scraper
  tiktokHashtag: "f1ZeP0K58iwlqG2pY", // clockworks/tiktok-hashtag-scraper
  tiktokSearch: "GdWCkxBtKWOsKjdch", // clockworks/tiktok-scraper (keyword search)
  tiktokComments: "BDec00yAmCm1QbMEI", // clockworks/tiktok-comments-scraper
  youtubeSearch: "h7sDV53CddomktSi5", // streamers/youtube-scraper (search mode)
  youtubeComments: "p7UMdpQnjKmmpR21D", // streamers/youtube-comments-scraper
  // Referenced by name slug (resolves like an id in the Apify API) — X search
  // has no precedent in the other pipelines.
  twitterSearch: "apidojo~tweet-scraper",
}

// ---------------------------------------------------------------------------
// Qualification — what counts as iPhone Duo / launch conversation
// ---------------------------------------------------------------------------

// "iPhone Duo" is the official keynote name; the wild still says iPhone Fold
// (press rumor cycle) and iPhone Ultra (earlier rumors), so all three match.
// Arabic press: آيفون القابل للطي / ايفون ديو.
const FOLD_SPECIFIC = [
  /iphone\s*fold/i,
  /iphone\s*duo/i,
  /iphone\s*ultra/i,
  /fold(?:able|ing)\s*iphone/i,
  /apple\s*fold/i,
  /[اآ]يفون[\s_]*(فولد|دي?و|[اأ]لترا)/,
  /ايفون[\s_]*القابل/,
]
// Generic foldable terms count only alongside an Apple context — otherwise
// every Galaxy Fold post would qualify.
const FOLD_GENERIC = /قابل\s*للطي|foldable|القابل\s*للطي|تطوى|يطوى/i
const APPLE_CONTEXT = /apple|iphone|[اأآ]بل\b|[اآ]يفون|أيفون/i

const LAUNCH_PATTERNS = [
  /iphone\s*18/i,
  /[اآأ]يفون\s*[١1]8/,
  /apple\s*event/i,
  /#appleevent/i,
  /مؤتمر\s*[اأآ]بل/,
  /حدث\s*[اأآ]بل/,
]

// null = not our conversation; "fold" = the foldable specifically (the main
// story); "launch" = wider iPhone 18 / Apple event coverage.
export function ifoldFocus(text: string | null | undefined): IFoldFocus | null {
  const t = text || ""
  if (FOLD_SPECIFIC.some((p) => p.test(t))) return "fold"
  if (FOLD_GENERIC.test(t) && APPLE_CONTEXT.test(t)) return "fold"
  if (LAUNCH_PATTERNS.some((p) => p.test(t))) return "launch"
  return null
}

// Apple's own accounts are scraped directly — during the tracking window
// everything they publish is launch conversation, even when the caption never
// names the product (teasers, keynote clips, availability posts). Used as a
// fallback where ifoldFocus() finds no textual marker.
const APPLE_OFFICIAL_HANDLES = new Set(["apple", "tim_cook"])

export function appleOfficialFocus(handle: string | null | undefined): IFoldFocus | null {
  const h = String(handle || "").replace(/^@/, "").toLowerCase()
  return APPLE_OFFICIAL_HANDLES.has(h) ? "launch" : null
}

// GCC relevance — Arabic script is the strongest available proxy for the
// Arab/Gulf audience on global hashtag feeds; explicit Gulf geography terms
// catch the English-language GCC conversation.
const ARABIC_SCRIPT = /[؀-ۿ]/
const GCC_TERMS =
  /\buae\b|dubai|abu\s*dhabi|saudi|\bksa\b|riyadh|jeddah|kuwait|qatar|doha|bahrain|\boman\b|muscat|\bgulf\b|\bgcc\b|خليج|[اإ]مارات|دبي|[اأ]بو\s*ظبي|سعودي|الرياض|جد[هة]|كويت|قطر|الدوحة|بحرين|عمان|مسقط/i

export function isGccText(text: string | null | undefined): boolean {
  const t = text || ""
  return ARABIC_SCRIPT.test(t) || GCC_TERMS.test(t)
}

export function isInTrackingWindow(publishedAt: string | Date | null | undefined): boolean {
  if (!publishedAt) return false
  const t = new Date(publishedAt).getTime()
  return !isNaN(t) && t >= IFOLD_TRACKING_START.getTime()
}

// ---------------------------------------------------------------------------
// Apify helpers (same fire-then-harvest model as the unpacked pipeline)
// ---------------------------------------------------------------------------

// Several harvested actors are shared with the roster pipeline (profiles,
// YouTube), so one day can produce 2-3 runs per actor. 8 runs keeps ~3 days
// of backfill; deeper reads blew past the route's 300s function budget once
// launch-week datasets fattened up (FUNCTION_INVOCATION_TIMEOUT, Sep 10).
const RUNS_TO_SYNC = 8

async function getRecentRunsItems<T>(actorId: string, runCount = RUNS_TO_SYNC): Promise<T[]> {
  try {
    const runs = await getLatestRuns(actorId, runCount)
    const all: T[] = []
    // Oldest first so the newest scrape wins the upsert on overlap.
    for (const run of runs.reverse()) {
      all.push(...(await getDatasetItems<T>(run.defaultDatasetId)))
    }
    return all
  } catch (e) {
    console.error(`[ifold] Failed to read runs for ${actorId}:`, e)
    return []
  }
}

async function startActorRun(
  actorId: string,
  input: Record<string, unknown>,
  maxTotalChargeUsd = 3,
): Promise<string | null> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}&maxTotalChargeUsd=${maxTotalChargeUsd}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  )
  const out = await res.json().catch(() => null)
  if (!res.ok) {
    console.error(`[ifold] Failed to start actor ${actorId}:`, out?.error?.message || res.status)
    return null
  }
  return out?.data?.id || null
}

export async function waitForRuns(runIds: (string | null)[], timeoutMs: number): Promise<void> {
  const ids = runIds.filter((id): id is string => !!id)
  const deadline = Date.now() + timeoutMs
  const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"])
  const pending = new Set(ids)

  while (pending.size > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10000))
    for (const id of [...pending]) {
      try {
        const res = await fetch(`https://api.apify.com/v2/actor-runs/${id}?token=${APIFY_TOKEN}`)
        const out = await res.json().catch(() => null)
        if (TERMINAL.has(out?.data?.status)) pending.delete(id)
      } catch {
        // transient — retry on the next tick
      }
    }
  }
}

// ---------------------------------------------------------------------------
// RSS ingestion — GCC + global tech press
// ---------------------------------------------------------------------------

interface RssItem {
  title: string
  link: string
  description: string
  publishedAt: string | null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&nbsp;/g, " ")
}

function stripCdataAndTags(s: string): string {
  return decodeEntities(
    s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
}

// Minimal RSS 2.0 / Atom parser — the feeds in IFOLD_NEWS_FEEDS are plain
// XML; a dependency-free regex pass keeps the bundle unchanged.
export function parseRssItems(xml: string): RssItem[] {
  const out: RssItem[] = []
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/g) || []
  for (const block of blocks) {
    const field = (name: string): string => {
      const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))
      return m ? stripCdataAndTags(m[1]) : ""
    }
    const title = field("title")
    // RSS <link>url</link> vs Atom <link href="url"/>
    let link = field("link")
    if (!link) link = decodeEntities(block.match(/<link[^>]*href="([^"]+)"/i)?.[1] || "")
    const description = (field("description") || field("summary") || field("content")).slice(0, 400)
    const pub = field("pubDate") || field("published") || field("updated") || field("dc:date")
    const t = pub ? new Date(pub).getTime() : NaN
    if (!title || !link) continue
    out.push({ title, link, description, publishedAt: isNaN(t) ? null : new Date(t).toISOString() })
  }
  return out
}

// Ingest upserts rewrite raw_data from the fresh scrape item, which would
// wipe the stored _analysis verdicts and re-bill the LLM for every news
// headline and tweet each cycle — carry the existing verdicts over.
async function getExistingAnalyses(): Promise<Map<string, unknown>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("social_posts")
    .select("external_id,_analysis:raw_data->_analysis")
    .like("external_id", `${IFOLD_ID_PREFIX}%`)
    .eq("platform", "twitter")
  if (error) {
    console.error("[ifold] analysis-carryover read failed:", error.message)
    return new Map()
  }
  const map = new Map<string, unknown>()
  for (const r of (data as any[]) || []) {
    if (r._analysis) map.set(String(r.external_id), r._analysis)
  }
  return map
}

// Stable short hash for article ids (links are too long for readable keys).
function hashId(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

// Google News items carry the outlet as a " - Outlet" title suffix.
function googleNewsSource(title: string): { title: string; source: string | null } {
  const m = title.match(/^(.*)\s-\s([^-]{2,60})$/)
  return m ? { title: m[1].trim(), source: m[2].trim() } : { title, source: null }
}

export async function syncIFoldNews() {
  const supabase = await createClient()
  let fetched = 0
  let matched = 0
  let inserted = 0
  const feedErrors: string[] = []
  const existingAnalyses = await getExistingAnalyses()

  const results = await Promise.allSettled(
    IFOLD_NEWS_FEEDS.map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: {
          // Several WordPress feeds (Arabian Business et al.) bot-block
          // default fetch UAs — present as a regular browser.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) throw new Error(`${feed.id}: HTTP ${res.status}`)
      return { feed, items: parseRssItems(await res.text()) }
    }),
  )

  for (const r of results) {
    if (r.status === "rejected") {
      feedErrors.push(String(r.reason?.message || r.reason))
      continue
    }
    const { feed, items } = r.value
    fetched += items.length
    for (const item of items) {
      const { title, source } = feed.site === "news.google.com" ? googleNewsSource(item.title) : { title: item.title, source: null }
      const text = `${title} ${item.description}`
      const focus = ifoldFocus(text)
      if (!focus) continue
      if (item.publishedAt && !isInTrackingWindow(item.publishedAt)) continue
      matched++

      const newsId = IFOLD_NEWS_PREFIX + hashId(item.link)
      const prevAnalysis = existingAnalyses.get(newsId)
      const { error } = await supabase.from("social_posts").upsert(
        {
          platform: "twitter", // storage constraint — real platform in raw_data
          external_id: newsId,
          post_url: item.link,
          caption: item.description ? `${title}\n${item.description}` : title,
          media_type: "article",
          published_at: item.publishedAt || new Date().toISOString(),
          scraped_at: new Date().toISOString(),
          raw_data: {
            _ifold: true,
            _platform: "news",
            _focus: focus,
            _gcc: feed.region === "gcc" || isGccText(text),
            _source: source || feed.name,
            _sourceId: feed.id,
            _sourceLang: feed.lang,
            title,
            description: item.description,
            ...(prevAnalysis ? { _analysis: prevAnalysis } : {}),
          },
        },
        { onConflict: "platform,external_id", ignoreDuplicates: false },
      )
      if (!error) inserted++
    }
  }

  if (feedErrors.length > 0) console.error("[ifold] Feed errors:", feedErrors.slice(0, 8))
  return { fetched, matched, inserted, feedErrors: feedErrors.length }
}

// ---------------------------------------------------------------------------
// Social post scrapes + ingest
// ---------------------------------------------------------------------------

// Official name first; "iphone fold" stays because the wild keeps using it.
const IFOLD_HASHTAGS = ["iphoneduo", "iphonefold", "iphone18pro"]
const IFOLD_SEARCHES_AR = ["ايفون ديو", "ايفون فولد", "آيفون القابل للطي", "ايفون 18"]
const IFOLD_SEARCHES_EN = ["iphone duo", "iphone fold", "iphone duo vs galaxy fold"]

// Apple official accounts scraped directly (X handles ride the tweet-scraper
// query below; YouTube rides a channel-mode run of the shared YT actor).
const APPLE_IG_ACCOUNTS = ["apple", "tim_cook"]
const APPLE_TIKTOK_ACCOUNTS = ["apple"]
const APPLE_YT_CHANNEL = "https://www.youtube.com/@Apple/videos"
// GCC tech-voice X accounts from the watchlist (the Samsung-roster reviewers
// have no X presence worth polling; their YT/IG/TikTok flow via shared runs).
const WATCHLIST_X_QUERY =
  "(from:iphoneislam OR from:faisal_sabahii OR from:TechWD OR from:WiredMiddleEast)"

// The keynote reaction wave (launch week) is the densest window of the whole
// campaign — scrape deeper so the daily harvest doesn't truncate it, then
// drop back to the cheaper steady-state depth.
const LAUNCH_WEEK_END = new Date("2026-09-17T00:00:00+04:00")

export async function startIFoldPostScrapes() {
  const boost = Date.now() < LAUNCH_WEEK_END.getTime()
  const started: Record<string, string | null> = {}
  started.instagramHashtag = await startActorRun(IFOLD_ACTORS.instagramHashtag, {
    hashtags: IFOLD_HASHTAGS,
    resultsLimit: boost ? 150 : 80,
  })
  started.tiktokHashtag = await startActorRun(IFOLD_ACTORS.tiktokHashtag, {
    hashtags: IFOLD_HASHTAGS,
    resultsPerPage: boost ? 150 : 80,
  })
  started.tiktokSearch = await startActorRun(IFOLD_ACTORS.tiktokSearch, {
    searchQueries: [...IFOLD_SEARCHES_EN.slice(0, 2), ...IFOLD_SEARCHES_AR.slice(0, 2)],
    searchSection: "/video",
    videoSearchSorting: "LATEST",
    videoSearchDateFilter: "PAST_WEEK",
    resultsPerPage: boost ? 75 : 50,
  })
  started.twitterSearch = await startActorRun(
    IFOLD_ACTORS.twitterSearch,
    {
      searchTerms: [
        '"iphone duo"',
        '"iphone fold"',
        '"foldable iphone"',
        "ايفون ديو",
        "ايفون فولد",
        "آيفون القابل للطي",
        "from:Apple",
        "from:tim_cook",
        WATCHLIST_X_QUERY,
      ],
      maxItems: boost ? 600 : 300,
      sort: "Latest",
      start: "2026-09-02",
    },
    5,
  )
  started.youtubeSearch = await startActorRun(IFOLD_ACTORS.youtubeSearch, {
    searchQueries: ["iphone duo review", "iphone duo مراجعة", "ايفون ديو", "iphone duo vs galaxy z fold", "iphone fold review"],
    maxResults: boost ? 25 : 15,
    maxResultsShorts: boost ? 15 : 10,
    maxResultStreams: 0,
    oldestPostDate: "2026-09-02",
  })
  // Apple official accounts — profile/channel scrapes. The Samsung FF8 roster
  // profiles are NOT re-fired here: the roster pipeline already scrapes them
  // daily with these same actors, and our ingest harvests those runs too.
  started.appleInstagram = await startActorRun(IFOLD_ACTORS.instagramProfiles, {
    usernames: APPLE_IG_ACCOUNTS,
  })
  started.appleTikTok = await startActorRun(IFOLD_ACTORS.tiktokProfiles, {
    profiles: APPLE_TIKTOK_ACCOUNTS,
    resultsPerPage: boost ? 20 : 10,
    profileSorting: "latest",
    excludePinnedPosts: false,
  })
  started.appleYouTube = await startActorRun(IFOLD_ACTORS.youtubeSearch, {
    startUrls: [{ url: APPLE_YT_CHANNEL }],
    maxResults: boost ? 15 : 8,
    oldestPostDate: "2026-09-02",
  })
  return started
}

interface IgHashtagItem {
  id?: string
  shortCode?: string
  url?: string
  caption?: string
  type?: string
  displayUrl?: string
  likesCount?: number
  commentsCount?: number
  videoViewCount?: number
  videoPlayCount?: number
  timestamp?: string
  ownerUsername?: string
  ownerFullName?: string
}

export async function syncIFoldInstagramPosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const items = await getRecentRunsItems<IgHashtagItem>(IFOLD_ACTORS.instagramHashtag, runCount)

  // Profile-scraper runs return profile objects carrying latestPosts. The
  // actor is shared with the roster pipeline, so this harvests BOTH our
  // Apple-account runs and the daily Samsung FF8-roster runs — the focus
  // filter keeps only Duo/launch-matching posts from either.
  const profiles = await getRecentRunsItems<any>(IFOLD_ACTORS.instagramProfiles, runCount)
  for (const profile of profiles) {
    for (const p of [...(profile?.latestPosts || []), ...(profile?.latestIgtvVideos || [])]) {
      items.push({ ...p, ownerUsername: p.ownerUsername || profile?.username })
    }
  }

  let inserted = 0
  let matched = 0
  for (const post of items) {
    const focus = ifoldFocus(post.caption) ?? appleOfficialFocus(post.ownerUsername)
    if (!focus || !isInTrackingWindow(post.timestamp)) continue
    const externalId = post.id || post.shortCode || instagramShortcodeFromUrl(post.url || "")
    if (!externalId) continue
    matched++
    const { error } = await supabase.from("social_posts").upsert(
      {
        platform: "instagram",
        external_id: IFOLD_ID_PREFIX + String(externalId),
        post_url: post.url || (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : ""),
        caption: post.caption || "",
        media_type: post.type || "Video",
        media_url: post.displayUrl,
        likes_count: Math.max(0, post.likesCount || 0),
        comments_count: Math.max(0, post.commentsCount || 0),
        views_count: post.videoPlayCount || post.videoViewCount || 0,
        published_at: post.timestamp ? new Date(post.timestamp).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: { ...post, _ifold: true, _focus: focus, _gcc: isGccText(post.caption) },
      },
      { onConflict: "platform,external_id" },
    )
    if (!error) inserted++
  }
  return { inserted, matched, total: items.length }
}

interface TikTokItem {
  id?: string
  text?: string
  webVideoUrl?: string
  diggCount?: number
  commentCount?: number
  shareCount?: number
  playCount?: number
  createTime?: number
  createTimeISO?: string
  authorMeta?: { name?: string; nickName?: string; avatar?: string }
  videoMeta?: { coverUrl?: string }
  hashtags?: { name?: string }[]
}

function tiktokText(p: TikTokItem): string {
  return [p.text || "", ...(p.hashtags || []).map((h) => `#${h?.name || ""}`)].join(" ")
}

export async function syncIFoldTikTokPosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const items = [
    ...(await getRecentRunsItems<TikTokItem>(IFOLD_ACTORS.tiktokHashtag, runCount)),
    ...(await getRecentRunsItems<TikTokItem>(IFOLD_ACTORS.tiktokSearch, runCount)),
    // Shared with the roster pipeline — harvests our Apple-account runs and
    // the Samsung FF8-roster profile runs alike (focus-filtered below).
    ...(await getRecentRunsItems<TikTokItem>(IFOLD_ACTORS.tiktokProfiles, runCount)),
  ]

  let inserted = 0
  let matched = 0
  const seen = new Set<string>()
  for (const post of items) {
    if (!post.id || seen.has(post.id)) continue
    const text = tiktokText(post)
    const focus = ifoldFocus(text) ?? appleOfficialFocus(post.authorMeta?.name)
    const publishedAt = post.createTimeISO || (post.createTime ? new Date(post.createTime * 1000) : null)
    if (!focus || !isInTrackingWindow(publishedAt)) continue
    seen.add(post.id)
    matched++
    const author = post.authorMeta?.name
    const { error } = await supabase.from("social_posts").upsert(
      {
        platform: "tiktok",
        external_id: IFOLD_ID_PREFIX + String(post.id),
        post_url: post.webVideoUrl || `https://www.tiktok.com/@${author || "user"}/video/${post.id}`,
        caption: post.text || "",
        media_type: "video",
        media_url: post.videoMeta?.coverUrl,
        likes_count: Math.max(0, post.diggCount || 0),
        comments_count: Math.max(0, post.commentCount || 0),
        shares_count: Math.max(0, post.shareCount || 0),
        views_count: Math.max(0, post.playCount || 0),
        published_at: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: { ...post, _ifold: true, _focus: focus, _gcc: isGccText(text) },
      },
      { onConflict: "platform,external_id" },
    )
    if (!error) inserted++
  }
  return { inserted, matched, total: items.length }
}

// apidojo/tweet-scraper items.
interface TweetItem {
  type?: string
  id?: string
  url?: string
  twitterUrl?: string
  text?: string
  fullText?: string
  likeCount?: number
  replyCount?: number
  retweetCount?: number
  quoteCount?: number
  viewCount?: number
  createdAt?: string
  author?: { userName?: string; name?: string; profilePicture?: string }
}

export async function syncIFoldTweets(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const items = await getRecentRunsItems<TweetItem>(IFOLD_ACTORS.twitterSearch, runCount)

  let inserted = 0
  let matched = 0
  const seen = new Set<string>()
  const existingAnalyses = items.length > 0 ? await getExistingAnalyses() : new Map()
  for (const t of items) {
    if (t.type && t.type !== "tweet") continue
    const text = t.fullText || t.text || ""
    const focus = ifoldFocus(text) ?? appleOfficialFocus(t.author?.userName)
    if (!t.id || !focus || seen.has(t.id)) continue
    const createdAt = t.createdAt ? new Date(t.createdAt) : null
    if (createdAt && isNaN(createdAt.getTime())) continue
    if (!isInTrackingWindow(createdAt)) continue
    seen.add(t.id)
    matched++
    const prevAnalysis = existingAnalyses.get(IFOLD_ID_PREFIX + String(t.id))
    const { error } = await supabase.from("social_posts").upsert(
      {
        platform: "twitter",
        external_id: IFOLD_ID_PREFIX + String(t.id),
        post_url: t.url || t.twitterUrl || "",
        caption: text,
        media_type: "tweet",
        likes_count: Math.max(0, t.likeCount || 0),
        comments_count: Math.max(0, t.replyCount || 0),
        shares_count: Math.max(0, (t.retweetCount || 0) + (t.quoteCount || 0)),
        views_count: Math.max(0, t.viewCount || 0),
        published_at: createdAt ? createdAt.toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: {
          ...t,
          _ifold: true,
          _focus: focus,
          _gcc: isGccText(text),
          ...(prevAnalysis ? { _analysis: prevAnalysis } : {}),
        },
      },
      { onConflict: "platform,external_id" },
    )
    if (!error) inserted++
  }
  return { inserted, matched, total: items.length }
}

export async function syncIFoldYouTubePosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const items = await getRecentRunsItems<any>(IFOLD_ACTORS.youtubeSearch, runCount)

  let inserted = 0
  let matched = 0
  for (const item of items) {
    const url = item.url || (item.id ? `https://www.youtube.com/watch?v=${item.id}` : "")
    const videoId = item.id || youtubeVideoId(url)
    if (!videoId) continue
    const text = `${item.title || ""} ${item.text || item.description || ""}`
    // channelName "Apple" → the direct channel scrape; keynote/product films
    // rarely say "Duo" in the title but are all launch content right now.
    const focus = ifoldFocus(text) ?? appleOfficialFocus(item.channelName)
    const publishedAt = item.date || item.uploadDate
    if (!focus || !isInTrackingWindow(publishedAt)) continue
    matched++
    const { error } = await supabase.from("social_posts").upsert(
      {
        platform: "twitter", // storage constraint — real platform in raw_data
        external_id: `${IFOLD_YT_PREFIX}${videoId}`,
        post_url: url,
        caption: item.title || "",
        media_type: "video",
        media_url: item.thumbnailUrl,
        likes_count: Math.max(0, item.likes || 0),
        comments_count: Math.max(0, item.commentsCount || 0),
        views_count: Math.max(0, item.viewCount || 0),
        published_at: new Date(publishedAt).toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: {
          ...item,
          _ifold: true,
          _platform: "youtube",
          _focus: focus,
          _gcc: isGccText(`${text} ${item.channelName || ""}`),
        },
      },
      { onConflict: "platform,external_id" },
    )
    if (!error) inserted++
  }
  return { inserted, matched, total: items.length }
}

// ---------------------------------------------------------------------------
// Comment scrapes + ingest
// ---------------------------------------------------------------------------

interface IFoldPostRow {
  external_id: string
  platform: string
  post_url: string | null
  published_at: string | null
  views_count: number | null
  _gcc?: boolean | null
}

// Comment activity dies off within days; only fresh posts get re-scraped,
// capped to the highest-viewed per platform to bound actor spend.
const COMMENT_RESCRAPE_DAYS = 5
const COMMENT_SCRAPE_TOP_N = 40

function isFreshPost(row: { published_at: string | null }): boolean {
  const t = new Date(row.published_at || 0).getTime()
  return !isNaN(t) && t >= Date.now() - COMMENT_RESCRAPE_DAYS * 86400000
}

async function getIFoldPostRows(): Promise<IFoldPostRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("social_posts")
    .select("external_id,platform,post_url,published_at,views_count,_gcc:raw_data->_gcc")
    .like("external_id", `${IFOLD_ID_PREFIX}%`)
  if (error) {
    console.error("[ifold] Failed to read posts:", error.message)
    return []
  }
  return (data as IFoldPostRow[]) || []
}

function topFresh(rows: IFoldPostRow[], filter: (r: IFoldPostRow) => boolean, n = COMMENT_SCRAPE_TOP_N): string[] {
  // GCC-relevant posts first (they're what the dashboard's video cards and
  // Gulf drill-downs surface), then global reach fills the remaining slots.
  return [
    ...new Set(
      rows
        .filter((r) => filter(r) && r.post_url && isFreshPost(r))
        .sort((a, b) => Number(!!b._gcc) - Number(!!a._gcc) || (b.views_count || 0) - (a.views_count || 0))
        .slice(0, n)
        .map((r) => String(r.post_url)),
    ),
  ]
}

export async function startIFoldCommentScrapes() {
  const rows = await getIFoldPostRows()
  const started: Record<string, string | null> = {}

  const igUrls = topFresh(rows, (r) => r.platform === "instagram")
  if (igUrls.length > 0) {
    started.instagramComments = await startActorRun(IFOLD_ACTORS.instagramComments, {
      directUrls: igUrls,
      resultsLimit: 100,
    })
  }

  const ttUrls = topFresh(rows, (r) => r.platform === "tiktok")
  if (ttUrls.length > 0) {
    started.tiktokComments = await startActorRun(IFOLD_ACTORS.tiktokComments, {
      postURLs: ttUrls,
      commentsPerPost: 100,
    })
  }

  const ytUrls = topFresh(rows, (r) => String(r.external_id).startsWith(IFOLD_YT_PREFIX), 25)
  if (ytUrls.length > 0) {
    started.youtubeComments = await startActorRun(IFOLD_ACTORS.youtubeComments, {
      startUrls: ytUrls.map((url) => ({ url })),
      maxComments: 100,
    })
  }

  return started
}

// Aliases a comment might use to reference its parent post.
function buildPostKeySet(rows: IFoldPostRow[]): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    const extId = stripIFoldPrefix(String(row.external_id || "")).replace(/^yt_/, "")
    if (extId) keys.add(extId)
    const url = (row.post_url || "").replace(/\/+$/, "")
    if (url) keys.add(url)
    if (row.platform === "instagram") {
      const sc = instagramShortcodeFromUrl(row.post_url || "")
      if (sc) {
        keys.add(sc)
        const numeric = instagramShortcodeToId(sc)
        if (numeric) keys.add(numeric)
      }
      if (!/^\d+$/.test(extId)) {
        const numeric = instagramShortcodeToId(extId)
        if (numeric) keys.add(numeric)
      }
    }
  }
  return keys
}

export async function syncIFoldComments(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const rows = await getIFoldPostRows()
  const keys = buildPostKeySet(rows)
  let inserted = 0

  // Instagram — apify/instagram-comment-scraper (shared actor; parent-filtered).
  const igItems = await getRecentRunsItems<any>(IFOLD_ACTORS.instagramComments, runCount)
  const igSeen = new Set<string>()
  for (const c of [...igItems].reverse()) {
    const text = (c.text || "").trim()
    if (!text) continue
    const sc = instagramShortcodeFromUrl(c.postUrl || "")
    if (!sc) continue
    const numeric = instagramShortcodeToId(sc)
    if (!keys.has(sc) && !keys.has(numeric || "")) continue
    const commentId = c.id || `${sc}_${c.ownerUsername || "user"}_${c.timestamp || text.slice(0, 40)}`
    if (igSeen.has(String(commentId))) continue
    igSeen.add(String(commentId))
    const { error } = await supabase.from("social_comments").upsert(
      {
        platform: "instagram",
        external_id: IFOLD_ID_PREFIX + String(commentId),
        external_post_id: numeric || sc,
        text,
        author_username: c.ownerUsername || "unknown",
        likes_count: c.likesCount || 0,
        published_at: c.timestamp ? new Date(c.timestamp).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: { ...c, _ifold: true, _gcc: isGccText(text) },
      },
      { onConflict: "platform,external_id" },
    )
    if (!error) inserted++
  }

  // TikTok — clockworks/tiktok-comments-scraper (shared actor; parent-filtered).
  const ttItems = await getRecentRunsItems<any>(IFOLD_ACTORS.tiktokComments, runCount)
  const ttSeen = new Set<string>()
  for (const c of [...ttItems].reverse()) {
    const text = (c.text || c.comment || "").trim()
    if (!text) continue
    const videoUrl = c.videoWebUrl || c.submittedVideoUrl || c.video_url || ""
    const videoId = videoUrl.match(/video\/(\d+)/)?.[1]
    if (!videoId || !keys.has(videoId)) continue
    const commentId = c.cid || c.id
    if (!commentId || ttSeen.has(String(commentId))) continue
    ttSeen.add(String(commentId))
    const { error } = await supabase.from("social_comments").upsert(
      {
        platform: "tiktok",
        external_id: IFOLD_ID_PREFIX + String(commentId),
        external_post_id: videoId,
        text,
        author_username: c.uniqueId || c.user?.uniqueId || c.author_username || "unknown",
        likes_count: c.diggCount ?? c.likes ?? 0,
        published_at: c.createTimeISO
          ? new Date(c.createTimeISO).toISOString()
          : c.created_at
            ? new Date(c.created_at).toISOString()
            : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: { ...c, _ifold: true, _gcc: isGccText(text) },
      },
      { onConflict: "platform,external_id" },
    )
    if (!error) inserted++
  }

  // YouTube — streamers/youtube-comments-scraper (shared actor; parent-filtered).
  const ytIds = new Set(
    rows
      .filter((r) => String(r.external_id).startsWith(IFOLD_YT_PREFIX))
      .map((r) => String(r.external_id).slice(IFOLD_YT_PREFIX.length)),
  )
  const ytItems = ytIds.size > 0 ? await getRecentRunsItems<any>(IFOLD_ACTORS.youtubeComments, runCount) : []
  const ytSeen = new Set<string>()
  for (const c of [...ytItems].reverse()) {
    const text = (c.comment || c.text || "").trim()
    if (!text) continue
    const videoId = c.videoId || youtubeVideoId(c.videoUrl || c.url || c.pageUrl || "")
    if (!videoId || !ytIds.has(videoId)) continue
    const commentId = c.cid || c.commentId || c.id || `${videoId}_${c.author || "user"}_${text.slice(0, 40)}`
    if (ytSeen.has(String(commentId))) continue
    ytSeen.add(String(commentId))
    const { error } = await supabase.from("social_comments").upsert(
      {
        platform: "twitter", // storage constraint — real platform in raw_data
        external_id: `${IFOLD_YT_PREFIX}${commentId}`,
        external_post_id: videoId,
        text,
        author_username: (c.author || c.authorName || "unknown").replace(/^@/, ""),
        likes_count: c.voteCount || c.likesCount || 0,
        published_at: c.date ? new Date(c.date).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: { ...c, _ifold: true, _platform: "youtube", _gcc: isGccText(text) },
      },
      { onConflict: "platform,external_id" },
    )
    if (!error) inserted++
  }

  return { inserted, total: igItems.length + ttItems.length + ytItems.length }
}

// ---------------------------------------------------------------------------
// LLM analysis passes
// ---------------------------------------------------------------------------

// Comments: standard columns, competitive analyzer.
export async function analyzeIFoldComments(deadlineMs: number): Promise<number> {
  const supabase = await createClient()
  let persisted = 0

  while (Date.now() < deadlineMs) {
    const { data: rowsData, error } = await supabase
      .from("social_comments")
      .select("external_id, text")
      .like("external_id", `${IFOLD_ID_PREFIX}%`)
      .is("sentiment_analyzed_at", null)
      .not("text", "is", null)
      .limit(400)
    if (error) {
      console.error("[ifold] analyze select failed:", error.message)
      break
    }

    const toAnalyze = (rowsData || [])
      .filter((r: any) => (r.text || "").trim().length > 0)
      .map((r: any) => ({ id: r.external_id as string, text: r.text as string }))
    if (toAnalyze.length === 0) break

    const now = new Date().toISOString()
    let successes = 0
    await analyzeIFoldItems(toAnalyze, {
      onBatch: async (batchResults) => {
        const real = batchResults.filter((res) => !res.failed)
        await Promise.all(
          real.map((res) =>
            supabase
              .from("social_comments")
              .update({
                sentiment: res.sentiment,
                sentiment_score: res.score,
                flags: res.flags,
                sentiment_analyzed_at: now,
              })
              .eq("external_id", res.id),
          ),
        )
        successes += real.length
        persisted += real.length
      },
    })
    if (successes === 0) break
  }
  return persisted
}

// Posts that ARE the opinion unit (tweets, news headlines): social_posts has
// no sentiment columns, so the verdict lands in raw_data._analysis.
export async function analyzeIFoldPosts(deadlineMs: number): Promise<number> {
  const supabase = await createClient()
  // News + tweets + YouTube all store under platform="twitter"; the prefix
  // separates them.
  const { data, error } = await supabase
    .from("social_posts")
    .select("id, external_id, caption, raw_data")
    .like("external_id", `${IFOLD_ID_PREFIX}%`)
    .eq("platform", "twitter")
    .limit(3000)
  if (error) {
    console.error("[ifold] post-analysis select failed:", error.message)
    return 0
  }

  const pending = (data || []).filter((r: any) => {
    const ext = String(r.external_id)
    if (ext.startsWith(IFOLD_YT_PREFIX)) return false // sentiment lives in YT comments
    return !(r.raw_data || {})._analysis && (r.caption || "").trim().length > 0
  })
  if (pending.length === 0) return 0

  let persisted = 0
  const byId = new Map(pending.map((r: any) => [String(r.id), r]))
  await analyzeIFoldItems(
    pending.map((r: any) => ({ id: String(r.id), text: String(r.caption).slice(0, 500) })),
    {
      onBatch: async (batchResults) => {
        if (Date.now() > deadlineMs) return
        const real = batchResults.filter((res) => !res.failed)
        await Promise.all(
          real.map((res) => {
            const row = byId.get(res.id)
            if (!row) return Promise.resolve()
            return supabase
              .from("social_posts")
              .update({
                raw_data: {
                  ...(row.raw_data || {}),
                  _analysis: { sentiment: res.sentiment, score: res.score, flags: res.flags },
                },
              })
              .eq("id", row.id)
              .then(() => undefined)
          }),
        )
        persisted += real.length
      },
    },
  )
  return persisted
}

// ---------------------------------------------------------------------------
// Full sync
// ---------------------------------------------------------------------------

export async function syncIFold(
  opts: { wait?: boolean; runsToSync?: number; ingestOnly?: boolean } = {},
) {
  const runCount = opts.runsToSync ?? RUNS_TO_SYNC
  const startedAt = Date.now()

  // News first — RSS is free, fast, and independent of Apify.
  let news: Awaited<ReturnType<typeof syncIFoldNews>> | { error: string } = { error: "failed" }
  try {
    news = await syncIFoldNews()
  } catch (e) {
    console.error("[ifold] News sync failed:", e)
  }

  // Phase 1 — harvest completed post runs, then fire the next cycle's scrapes.
  let instagramPosts = await syncIFoldInstagramPosts(runCount)
  let tiktokPosts = await syncIFoldTikTokPosts(runCount)
  let tweets = await syncIFoldTweets(runCount)
  let youtubePosts = await syncIFoldYouTubePosts(runCount)
  const postRuns = opts.ingestOnly ? {} : await startIFoldPostScrapes()
  if (opts.wait && !opts.ingestOnly) {
    await waitForRuns(Object.values(postRuns), 150000)
    instagramPosts = await syncIFoldInstagramPosts(2)
    tiktokPosts = await syncIFoldTikTokPosts(2)
    tweets = await syncIFoldTweets(2)
    youtubePosts = await syncIFoldYouTubePosts(2)
  }

  // Phase 2 — comments on tracked posts.
  let comments = await syncIFoldComments(runCount)
  const commentRuns = opts.ingestOnly ? {} : await startIFoldCommentScrapes()
  if (opts.wait && !opts.ingestOnly) {
    await waitForRuns(Object.values(commentRuns), 100000)
    comments = await syncIFoldComments(2)
  }

  // Phase 3 — competitive LLM analysis on everything not yet scored.
  const deadline = startedAt + 240000
  let postsAnalyzed = 0
  let commentsAnalyzed = 0
  try {
    postsAnalyzed = await analyzeIFoldPosts(deadline)
    commentsAnalyzed = await analyzeIFoldComments(deadline)
  } catch (e) {
    console.error("[ifold] Post-sync analysis failed:", e)
  }

  return {
    news,
    instagramPosts,
    tiktokPosts,
    tweets,
    youtubePosts,
    comments,
    startedRuns: { ...postRuns, ...commentRuns },
    postsAnalyzed,
    commentsAnalyzed,
    syncedAt: new Date().toISOString(),
  }
}
