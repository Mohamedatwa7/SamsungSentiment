// Galaxy Unpacked campaign sync
//
// Tracks influencer videos posted for the Galaxy Unpacked campaign on
// Instagram and TikTok. Campaign posts share a caption pattern: they carry
// "#newshape", "#galaxyunpacked" and tag "@samsunggulf".
//
// Data lands in the SAME social_posts / social_comments tables as the brand
// sync but every row is tagged with raw_data._unpacked = true; /api/comments
// excludes those rows and /api/unpacked selects only them, so the campaign
// never mixes with the Social Reviews dashboard.

import { createClient } from "@/lib/supabase/server"
import { getLatestRuns, getDatasetItems } from "@/lib/apify-sync"
import { analyzeComments } from "@/lib/sentiment"
import { instagramShortcodeToId, instagramShortcodeFromUrl } from "@/lib/instagram-id"

const APIFY_TOKEN = process.env.APIFY_API_TOKEN

// Public Apify store actors, resolved by id. Deliberately DIFFERENT actors from
// SCHEDULED_ACTORS in apify-sync.ts — the nightly brand sync ingests recent
// runs per actor, so sharing an actor would cross-contaminate both pipelines.
export const UNPACKED_ACTORS = {
  instagramHashtag: "reGe1ST3OBgYZSsZJ", // apify/instagram-hashtag-scraper
  // Posts that mention/tag @samsunggulf — the hashtag feeds surface global
  // noise and bury small Gulf creators, but every campaign post tags the
  // brand, so the mentions feed is the higher-recall channel.
  instagramMentions: "zTSjdcGqjg6KEIBlt", // apify/instagram-tagged-scraper
  instagramComments: "SbK00X0JYCPblD2wp", // apify/instagram-comment-scraper
  tiktokHashtag: "f1ZeP0K58iwlqG2pY", // clockworks/tiktok-hashtag-scraper
  // clockworks/tiktok-scraper in keyword-search mode — TikTok's hashtag feed
  // is popularity-ranked and buries small Gulf creators, but searching
  // "samsunggulf" surfaces the mention-tagged campaign videos. This IS the
  // brand sync's actor (SCHEDULED_ACTORS.tiktokPosts): sharing is safe only
  // because the brand sync keeps authorMeta.name === "samsunggulf" items and
  // this pipeline drops them.
  tiktokSearch: "GdWCkxBtKWOsKjdch",
  tiktokComments: "BDec00yAmCm1QbMEI", // clockworks/tiktok-comments-scraper
}

export const CAMPAIGN_HASHTAGS = ["newshape", "galaxyunpacked"]

// Feeds to scrape (wider than the marker rule): creators who hashtag the
// brand itself surface in #samsunggulf even when the campaign tags are
// buried in ranked feeds. The marker rule still decides what qualifies.
const SCRAPE_HASHTAGS = [...CAMPAIGN_HASHTAGS, "samsunggulf"]

// The twice-daily schedule stops on Aug 1st, 2026 (Gulf time, UTC+4).
export const CAMPAIGN_END = new Date("2026-08-01T00:00:00+04:00")

// Teaser campaign started mid-July — the #samsunggulf feed also surfaces the
// brand's older collabs (S25/S26 era) which match the markers but are not
// this campaign.
export const CAMPAIGN_START = new Date("2026-07-10T00:00:00+04:00")

export function isInCampaignWindow(publishedAt: string | Date | null | undefined): boolean {
  if (!publishedAt) return false
  const t = new Date(publishedAt).getTime()
  return !isNaN(t) && t >= CAMPAIGN_START.getTime()
}

export function campaignEnded(now = new Date()): boolean {
  return now.getTime() >= CAMPAIGN_END.getTime()
}

// A caption qualifies only when it tags @samsunggulf AND carries a campaign
// hashtag. The hashtag feeds are global — Samsung's regional accounts and
// fans worldwide use #newshape/#galaxyunpacked too — so the Gulf mention is
// the discriminator that isolates OUR influencers' posts.
const GULF_MARKER = /samsung\s*gulf/i
const HASHTAG_MARKERS = [/newshape/i, /galaxy\s*unpacked/i]

export function matchesCampaign(caption: string | null | undefined): boolean {
  const text = caption || ""
  return GULF_MARKER.test(text) && HASHTAG_MARKERS.some((m) => m.test(text))
}

// Campaign rows share social_posts/social_comments with the brand sync. The
// external_id prefix is the queryable marker: a LIKE scan on the text column
// is fast, while filtering on raw_data->>_unpacked exceeds the Postgres
// statement timeout (JSONB detoast across 16k+ rows). The raw_data flag is
// still written — /api/comments uses it (as a cheap projection) to exclude
// campaign rows from the Social Reviews dashboard.
export const UNPACKED_ID_PREFIX = "unpacked_"

export function stripUnpackedPrefix(id: string): string {
  return id.startsWith(UNPACKED_ID_PREFIX) ? id.slice(UNPACKED_ID_PREFIX.length) : id
}

// Creators excluded from the campaign tracker by request (removed 2026-07-20:
// agency/aggregator accounts and creators outside the teaser roster). Their
// posts are skipped at ingest AND filtered in /api/unpacked, so they stay
// gone even if an old row lingers in the database.
export const EXCLUDED_CREATORS = new Set([
  "aesectorsignals",
  "uniquetalents.me",
  "abodelrahman_mohamed",
  "joycegchamoun",
  "farhaahmd",
  "yazxan",
  "basharkk",
])

export function isExcludedCreator(username: string | null | undefined): boolean {
  return EXCLUDED_CREATORS.has((username || "").toLowerCase().trim().replace(/^@/, ""))
}

// ---------------------------------------------------------------------------
// Apify helpers
// ---------------------------------------------------------------------------

// Twice-daily schedule → 6 runs ≈ 3 days of history, enough to backfill a
// missed cycle while keeping ingest fast.
const RUNS_TO_SYNC = 6

async function getRecentRunsItems<T>(actorId: string, runCount = RUNS_TO_SYNC): Promise<T[]> {
  const runs = await getLatestRuns(actorId, runCount)
  const all: T[] = []
  // Oldest first so the newest scrape wins the upsert on overlap.
  for (const run of runs.reverse()) {
    all.push(...(await getDatasetItems<T>(run.defaultDatasetId)))
  }
  return all
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
    console.error(`[unpacked] Failed to start actor ${actorId}:`, out?.error?.message || res.status)
    return null
  }
  return out?.data?.id || null
}

// Poll runs until they reach a terminal state or the time budget runs out.
// Used by the manual "wait" mode so a first trigger populates immediately;
// the cron path stays fire-and-forget like the nightly brand sync.
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
// Post (video) scrapes + ingest
// ---------------------------------------------------------------------------

export async function startUnpackedPostScrapes() {
  const started: Record<string, string | null> = {}
  // Deep limits: around the July 22 event the tags get busy and Gulf
  // influencer posts must not fall outside the scraped window.
  started.instagramHashtag = await startActorRun(UNPACKED_ACTORS.instagramHashtag, {
    hashtags: SCRAPE_HASHTAGS,
    resultsLimit: 250,
  })
  started.instagramMentions = await startActorRun(UNPACKED_ACTORS.instagramMentions, {
    username: ["samsunggulf"],
    resultsLimit: 250,
  })
  started.tiktokHashtag = await startActorRun(UNPACKED_ACTORS.tiktokHashtag, {
    hashtags: SCRAPE_HASHTAGS,
    resultsPerPage: 250,
  })
  started.tiktokSearch = await startActorRun(UNPACKED_ACTORS.tiktokSearch, {
    searchQueries: ["samsunggulf", "@samsunggulf"],
    searchSection: "/video",
    videoSearchSorting: "LATEST",
    videoSearchDateFilter: "PAST_MONTH",
    resultsPerPage: 150,
  })
  return started
}

interface UnpackedInstagramPost {
  id?: string
  shortCode?: string
  url?: string
  caption?: string
  type?: string
  displayUrl?: string
  videoUrl?: string
  likesCount?: number
  commentsCount?: number
  videoViewCount?: number
  videoPlayCount?: number
  timestamp?: string
  ownerUsername?: string
  ownerFullName?: string
}

export async function syncUnpackedInstagramPosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const items = [
    ...(await getRecentRunsItems<UnpackedInstagramPost>(UNPACKED_ACTORS.instagramHashtag, runCount)),
    ...(await getRecentRunsItems<UnpackedInstagramPost>(UNPACKED_ACTORS.instagramMentions, runCount)),
  ]
  const matched = items.filter(
    (p) =>
      matchesCampaign(p.caption) &&
      !isExcludedCreator(p.ownerUsername) &&
      isInCampaignWindow(p.timestamp),
  )

  let inserted = 0
  const errors: string[] = []
  for (const post of matched) {
    const externalId = post.id || post.shortCode || instagramShortcodeFromUrl(post.url || "")
    if (!externalId) continue

    const { error } = await supabase
      .from("social_posts")
      .upsert(
        {
          platform: "instagram",
          external_id: UNPACKED_ID_PREFIX + String(externalId),
          post_url: post.url || (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : ""),
          caption: post.caption || "",
          media_type: post.type || "Video",
          media_url: post.displayUrl,
          likes_count: post.likesCount || 0,
          comments_count: post.commentsCount || 0,
          views_count: post.videoPlayCount || post.videoViewCount || 0,
          published_at: post.timestamp ? new Date(post.timestamp).toISOString() : new Date().toISOString(),
          scraped_at: new Date().toISOString(),
          raw_data: { ...post, _unpacked: true },
        },
        { onConflict: "platform,external_id" },
      )
    if (error) errors.push(error.message)
    else inserted++
  }
  if (errors.length > 0) console.error("[unpacked] IG post sync errors (first 5):", errors.slice(0, 5))
  return { inserted, matched: matched.length, total: items.length }
}

interface UnpackedTikTokPost {
  id?: string
  text?: string
  webVideoUrl?: string
  diggCount?: number
  commentCount?: number
  shareCount?: number
  playCount?: number
  createTime?: number
  createTimeISO?: string
  authorMeta?: { name?: string; nickName?: string; avatar?: string; fans?: number }
  videoMeta?: { coverUrl?: string }
  hashtags?: { name?: string }[]
  mentions?: string[]
}

// Markers can live outside the caption text — TikTok items carry hashtags and
// mentions as separate arrays — so match against all of them combined.
function tiktokCampaignText(p: UnpackedTikTokPost): string {
  return [
    p.text || "",
    ...(p.hashtags || []).map((h) => `#${h?.name || ""}`),
    ...(p.mentions || []),
  ].join(" ")
}

export async function syncUnpackedTikTokPosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const items = [
    ...(await getRecentRunsItems<UnpackedTikTokPost>(UNPACKED_ACTORS.tiktokHashtag, runCount)),
    ...(await getRecentRunsItems<UnpackedTikTokPost>(UNPACKED_ACTORS.tiktokSearch, runCount)),
  ]
  const matched = items.filter(
    (p) =>
      matchesCampaign(tiktokCampaignText(p)) &&
      !isExcludedCreator(p.authorMeta?.name) &&
      // The brand's own videos belong to the Social Reviews pipeline.
      (p.authorMeta?.name || "").toLowerCase() !== "samsunggulf" &&
      isInCampaignWindow(
        p.createTimeISO || (p.createTime ? new Date(p.createTime * 1000) : null),
      ),
  )

  let inserted = 0
  const errors: string[] = []
  for (const post of matched) {
    if (!post.id) continue
    const author = post.authorMeta?.name
    const { error } = await supabase
      .from("social_posts")
      .upsert(
        {
          platform: "tiktok",
          external_id: UNPACKED_ID_PREFIX + String(post.id),
          post_url: post.webVideoUrl || `https://www.tiktok.com/@${author || "user"}/video/${post.id}`,
          caption: post.text || "",
          media_type: "video",
          media_url: post.videoMeta?.coverUrl,
          likes_count: post.diggCount || 0,
          comments_count: post.commentCount || 0,
          shares_count: post.shareCount || 0,
          views_count: post.playCount || 0,
          published_at: post.createTimeISO
            ? new Date(post.createTimeISO).toISOString()
            : post.createTime
              ? new Date(post.createTime * 1000).toISOString()
              : new Date().toISOString(),
          scraped_at: new Date().toISOString(),
          raw_data: { ...post, _unpacked: true },
        },
        { onConflict: "platform,external_id" },
      )
    if (error) errors.push(error.message)
    else inserted++
  }
  if (errors.length > 0) console.error("[unpacked] TikTok post sync errors (first 5):", errors.slice(0, 5))
  return { inserted, matched: matched.length, total: items.length }
}

// ---------------------------------------------------------------------------
// Comment scrapes + ingest
// ---------------------------------------------------------------------------

interface UnpackedPostRow {
  external_id: string
  platform: string
  post_url: string | null
}

async function getUnpackedPostRows(): Promise<UnpackedPostRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("social_posts")
    .select("external_id,platform,post_url")
    .like("external_id", `${UNPACKED_ID_PREFIX}%`)
  if (error) {
    console.error("[unpacked] Failed to read unpacked posts:", error.message)
    return []
  }
  return (data as UnpackedPostRow[]) || []
}

// Every alias a comment might use to reference one of our campaign videos:
// external id, Instagram shortcode/numeric id (two encodings), and post URL.
function buildPostKeySet(rows: UnpackedPostRow[]): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    // Comments reference videos by their REAL platform id, not the prefixed one.
    const extId = stripUnpackedPrefix(String(row.external_id || ""))
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
      if (/^\d+$/.test(extId)) {
        // numeric external id — nothing more to add, shortcode covered above
      } else {
        const numeric = instagramShortcodeToId(extId)
        if (numeric) keys.add(numeric)
      }
    }
  }
  return keys
}

export async function startUnpackedCommentScrapes() {
  const rows = await getUnpackedPostRows()
  const started: Record<string, string | null> = { instagramComments: null, tiktokComments: null }

  const igUrls = [...new Set(
    rows
      .filter((r) => r.platform === "instagram" && r.post_url)
      .map((r) => String(r.post_url)),
  )]
  if (igUrls.length > 0) {
    started.instagramComments = await startActorRun(UNPACKED_ACTORS.instagramComments, {
      directUrls: igUrls,
      resultsLimit: 300,
    })
  }

  const ttUrls = [...new Set(
    rows
      .filter((r) => r.platform === "tiktok" && r.post_url)
      .map((r) => String(r.post_url)),
  )]
  if (ttUrls.length > 0) {
    started.tiktokComments = await startActorRun(UNPACKED_ACTORS.tiktokComments, {
      postURLs: ttUrls,
      commentsPerPost: 300,
    })
  }

  return started
}

interface UnpackedInstagramComment {
  id?: string
  text?: string
  ownerUsername?: string
  timestamp?: string
  likesCount?: number
  postUrl?: string
}

export async function syncUnpackedInstagramComments(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const postKeys = buildPostKeySet(await getUnpackedPostRows())
  const items = await getRecentRunsItems<UnpackedInstagramComment>(
    UNPACKED_ACTORS.instagramComments,
    runCount,
  )

  let inserted = 0
  const errors: string[] = []
  const seenIds = new Set<string>()

  // Newest run first; skip ids already handled this sync.
  for (const c of [...items].reverse()) {
    const text = (c.text || "").trim()
    if (!text) continue

    const shortcode = instagramShortcodeFromUrl(c.postUrl || "")
    if (!shortcode) continue
    const numericPostId = instagramShortcodeToId(shortcode)
    // Only comments that belong to a tracked campaign video.
    if (!postKeys.has(shortcode) && !postKeys.has(numericPostId || "")) continue

    // Stable fallback id — must not change between syncs or the upsert dupes.
    const commentId = c.id || `${shortcode}_${c.ownerUsername || "user"}_${c.timestamp || text.slice(0, 40)}`
    if (seenIds.has(String(commentId))) continue
    seenIds.add(String(commentId))

    const { error } = await supabase
      .from("social_comments")
      .upsert(
        {
          platform: "instagram",
          external_id: UNPACKED_ID_PREFIX + String(commentId),
          external_post_id: numericPostId || shortcode,
          text,
          author_username: c.ownerUsername || "unknown",
          likes_count: c.likesCount || 0,
          published_at: c.timestamp ? new Date(c.timestamp).toISOString() : new Date().toISOString(),
          scraped_at: new Date().toISOString(),
          raw_data: { ...c, _unpacked: true },
        },
        { onConflict: "platform,external_id" },
      )
    if (error) errors.push(error.message)
    else inserted++
  }
  if (errors.length > 0) console.error("[unpacked] IG comment sync errors (first 5):", errors.slice(0, 5))
  return { inserted, total: items.length }
}

interface UnpackedTikTokComment {
  cid?: string
  id?: string
  text?: string
  comment?: string
  diggCount?: number
  likes?: number
  uniqueId?: string
  author_username?: string
  user?: { uniqueId?: string }
  createTimeISO?: string
  created_at?: string
  videoWebUrl?: string
  submittedVideoUrl?: string
  video_url?: string
}

export async function syncUnpackedTikTokComments(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const postKeys = buildPostKeySet(await getUnpackedPostRows())
  const items = await getRecentRunsItems<UnpackedTikTokComment>(
    UNPACKED_ACTORS.tiktokComments,
    runCount,
  )

  let inserted = 0
  const errors: string[] = []
  const seenIds = new Set<string>()

  for (const c of [...items].reverse()) {
    const text = (c.text || c.comment || "").trim()
    if (!text) continue

    const videoUrl = c.videoWebUrl || c.submittedVideoUrl || c.video_url || ""
    const videoId = videoUrl.match(/video\/(\d+)/)?.[1]
    if (!videoId || !postKeys.has(videoId)) continue

    const commentId = c.cid || c.id
    if (!commentId || seenIds.has(String(commentId))) continue
    seenIds.add(String(commentId))

    const author = c.uniqueId || c.user?.uniqueId || c.author_username || "unknown"
    const publishedAt = c.createTimeISO || c.created_at

    const { error } = await supabase
      .from("social_comments")
      .upsert(
        {
          platform: "tiktok",
          external_id: UNPACKED_ID_PREFIX + String(commentId),
          external_post_id: videoId,
          text,
          author_username: author,
          likes_count: c.diggCount ?? c.likes ?? 0,
          published_at: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
          scraped_at: new Date().toISOString(),
          raw_data: { ...c, _unpacked: true },
        },
        { onConflict: "platform,external_id" },
      )
    if (error) errors.push(error.message)
    else inserted++
  }
  if (errors.length > 0) console.error("[unpacked] TikTok comment sync errors (first 5):", errors.slice(0, 5))
  return { inserted, total: items.length }
}

// ---------------------------------------------------------------------------
// Full sync
// ---------------------------------------------------------------------------

// Mirrors the nightly brand sync's two-phase model: ingest the previous
// cycles' completed runs, then fire fresh scrapes for the NEXT cycle to
// ingest. With `wait: true` (manual trigger) the fresh runs are polled and
// ingested in the same call so a first setup populates immediately.
export async function syncUnpacked(
  opts: { wait?: boolean; runsToSync?: number; ingestOnly?: boolean } = {},
) {
  const runCount = opts.runsToSync ?? RUNS_TO_SYNC
  const startedAt = Date.now()

  // Phase 1 — campaign videos. ingestOnly harvests completed Apify runs
  // (dataset reads are free) without starting new paid actor runs.
  let instagramPosts = await syncUnpackedInstagramPosts(runCount)
  let tiktokPosts = await syncUnpackedTikTokPosts(runCount)
  const postRuns = opts.ingestOnly ? {} : await startUnpackedPostScrapes()
  if (opts.wait && !opts.ingestOnly) {
    await waitForRuns(Object.values(postRuns), 150000)
    instagramPosts = await syncUnpackedInstagramPosts(2)
    tiktokPosts = await syncUnpackedTikTokPosts(2)
  }

  // Deleted/private videos get flagged so the dashboard drops their cards.
  let unavailableMarked = 0
  try {
    unavailableMarked = await markUnavailableTikTokVideos()
  } catch (e) {
    console.error("[unpacked] Availability check failed:", e)
  }

  // Phase 2 — comments on those videos
  let instagramComments = await syncUnpackedInstagramComments(runCount)
  let tiktokComments = await syncUnpackedTikTokComments(runCount)
  const commentRuns = opts.ingestOnly ? {} : await startUnpackedCommentScrapes()
  if (opts.wait && !opts.ingestOnly) {
    await waitForRuns(Object.values(commentRuns), 100000)
    instagramComments = await syncUnpackedInstagramComments(2)
    tiktokComments = await syncUnpackedTikTokComments(2)
  }

  // Phase 3 — LLM sentiment on campaign comments not yet analyzed (same
  // model/prompt as the Social Reviews dashboard). Targets unpacked rows
  // explicitly: the shared analyzeUnanalyzedComments picks arbitrary rows
  // table-wide, and a standing backlog of failing brand comments starves the
  // campaign rows behind it. Unanalyzed comments read as keyword-fallback
  // "neutral" on the dashboard until scored.
  let sentimentAnalyzed = 0
  try {
    sentimentAnalyzed = await analyzeUnpackedComments(startedAt + 240000)
  } catch (e) {
    console.error("[unpacked] Post-sync sentiment analysis failed:", e)
  }

  return {
    instagramPosts,
    tiktokPosts,
    instagramComments,
    tiktokComments,
    startedRuns: { ...postRuns, ...commentRuns },
    unavailableMarked,
    sentimentAnalyzed,
    syncedAt: new Date().toISOString(),
  }
}

// Detect deleted/private TikTok videos via TikTok's public oEmbed endpoint
// (400/404 for gone videos) and mark them raw_data._unavailable so the
// dashboard drops the card instead of rendering an embed error page. Only
// explicit 400/404 marks a video — transient failures must not hide content.
export async function markUnavailableTikTokVideos(): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("social_posts")
    .select("id, post_url, raw_data")
    .like("external_id", `${UNPACKED_ID_PREFIX}%`)
    .eq("platform", "tiktok")
  if (error || !data) return 0

  let marked = 0
  for (const row of data as any[]) {
    const raw = row.raw_data || {}
    if (raw._unavailable || !row.post_url) continue
    try {
      const res = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(row.post_url)}`,
        { headers: { "User-Agent": "Mozilla/5.0" } },
      )
      if (res.status === 400 || res.status === 404) {
        await supabase
          .from("social_posts")
          .update({ raw_data: { ...raw, _unavailable: true } })
          .eq("id", row.id)
        marked++
      }
    } catch {
      // network hiccup — leave the video visible, recheck next sync
    }
  }
  return marked
}

// Analyze unanalyzed CAMPAIGN comments until the backlog is empty or the
// deadline approaches. Returns the number successfully persisted.
export async function analyzeUnpackedComments(deadlineMs: number): Promise<number> {
  const supabase = await createClient()
  let persisted = 0

  while (Date.now() < deadlineMs) {
    const { data: rows, error } = await supabase
      .from("social_comments")
      .select("external_id, text")
      .like("external_id", `${UNPACKED_ID_PREFIX}%`)
      .is("sentiment_analyzed_at", null)
      .not("text", "is", null)
      .limit(400)
    if (error) {
      console.error("[unpacked] analyze select failed:", error.message)
      break
    }

    const toAnalyze = (rows || [])
      .filter((r: any) => (r.text || "").trim().length > 0)
      .map((r: any) => ({ id: r.external_id as string, text: r.text as string }))
    if (toAnalyze.length === 0) break

    const now = new Date().toISOString()
    let successes = 0
    await analyzeComments(toAnalyze, {
      batchSize: 25,
      delayMs: 300,
      concurrency: 4,
      onBatch: async (batchResults) => {
        // Failed placeholders are skipped so those comments retry next sync.
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

    // Every batch failed (rate limit / outage) — stop instead of spinning on
    // the same rows until the deadline.
    if (successes === 0) break
  }

  return persisted
}
