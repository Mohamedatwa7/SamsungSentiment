// FF8 influencer roster sync — scrapes the 27 campaign influencers' profiles
// (exact handles provided by marketing), keeps ONLY their FF8-related videos
// from the launch window, then scrapes and sentiment-scores their comments.
//
// Rows share social_posts/social_comments with everything else, keyed with a
// "roster_" external_id prefix + raw_data._roster metadata. The brand
// dashboard excludes them automatically (non-brand authors); /api/roster
// selects only them.

import { createClient } from "@/lib/supabase/server"
import { getLatestRuns, getDatasetItems } from "@/lib/apify-sync"
import { instagramShortcodeToId, instagramShortcodeFromUrl } from "@/lib/instagram-id"
import { FF8_ROSTER, rosterByHandle, YT_WINDOW_START } from "@/lib/roster"

const APIFY_TOKEN = process.env.APIFY_API_TOKEN

// Distinct from every other pipeline's actors (the brand IG posts actor IS
// apify/instagram-post-scraper, so roster IG uses the profile scraper).
export const ROSTER_ACTORS = {
  instagramProfiles: "dSCLg0C3YEZ83HzYX", // apify/instagram-profile-scraper (latestPosts)
  tiktokProfiles: "0FXVyOXXEmdGcV88a", // clockworks/tiktok-profile-scraper
  instagramComments: "SbK00X0JYCPblD2wp", // shared public actor — parent-filtered ingest
  tiktokComments: "BDec00yAmCm1QbMEI", // shared public actor — parent-filtered ingest
  youtube: "h7sDV53CddomktSi5", // streamers/youtube-scraper
  youtubeComments: "p7UMdpQnjKmmpR21D", // streamers/youtube-comments-scraper
}

// The social tables have a CHECK constraint limiting platform to the four
// brand values, so YouTube rows are STORED under platform "twitter" with a
// roster_yt_ key and raw_data._platform = "youtube"; the APIs present them
// as YouTube. (roster_yt_* still matches the roster_% prefix everywhere —
// exclusions, analyzer, /api/roster.)
export const YT_STORAGE_PLATFORM = "twitter"

export function youtubeVideoId(url: string): string | null {
  const m = String(url || "").match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{6,})/)
  return m ? m[1] : null
}

export const ROSTER_ID_PREFIX = "roster_"

// Historical F7-launch posts by the same roster (July 2025) — kept separate
// from the current FF8 videos so they feed the launch-comparison pie without
// appearing in the FF8 roster cards.
export const F7_ROSTER_PREFIX = `${ROSTER_ID_PREFIX}f7_`

export function stripRosterPrefix(id: string): string {
  return id.startsWith(ROSTER_ID_PREFIX) ? id.slice(ROSTER_ID_PREFIX.length) : id
}

// FF8 launch window + content markers: only recent videos clearly about the
// Fold 8 / Flip 8 launch qualify — not the influencer's other content.
const FF8_WINDOW_START = new Date("2026-07-10T00:00:00+04:00")
const FF8_MARKERS =
  /fold|flip|فولد|فليب|فلب|galaxy\s*unpacked|galaxyunpacked|new\s*shape|newshape|\bff8\b|جالكسي|galaxy\s*z/i

export function isFF8Content(caption: string | null | undefined, publishedAt: string | Date | null | undefined): boolean {
  if (!publishedAt) return false
  const t = new Date(publishedAt).getTime()
  if (isNaN(t) || t < FF8_WINDOW_START.getTime()) return false
  return FF8_MARKERS.test(caption || "")
}

const RUNS_TO_SYNC = 6

async function getRecentRunsItems<T>(actorId: string, runCount = RUNS_TO_SYNC): Promise<T[]> {
  const runs = await getLatestRuns(actorId, runCount)
  const all: T[] = []
  for (const run of runs.reverse()) {
    all.push(...(await getDatasetItems<T>(run.defaultDatasetId)))
  }
  return all
}

async function startActorRun(actorId: string, input: Record<string, unknown>, maxTotalChargeUsd = 3): Promise<string | null> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}&maxTotalChargeUsd=${maxTotalChargeUsd}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
  )
  const out = await res.json().catch(() => null)
  if (!res.ok) {
    console.error(`[roster] Failed to start actor ${actorId}:`, out?.error?.message || res.status)
    return null
  }
  return out?.data?.id || null
}

export async function startRosterPostScrapes() {
  const started: Record<string, string | null> = {}
  const igHandles = FF8_ROSTER.filter((r) => r.platform === "instagram").map((r) => r.handle)
  const ttHandles = FF8_ROSTER.filter((r) => r.platform === "tiktok").map((r) => r.handle)
  const ytChannels = FF8_ROSTER.filter((r) => r.platform === "youtube")

  started.rosterInstagram = await startActorRun(ROSTER_ACTORS.instagramProfiles, {
    usernames: igHandles,
  })
  started.rosterTikTok = await startActorRun(ROSTER_ACTORS.tiktokProfiles, {
    profiles: ttHandles,
    resultsPerPage: 15,
    profileSorting: "latest",
    excludePinnedPosts: false,
  })
  started.rosterYouTube = await startActorRun(ROSTER_ACTORS.youtube, {
    startUrls: ytChannels.map((c) => ({ url: `${c.url}/videos` })),
    maxResults: 8,
    oldestPostDate: "2026-07-21",
  })
  return started
}

// apify/instagram-profile-scraper items: profile objects carrying latestPosts.
export async function syncRosterInstagramPosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const profiles = await getRecentRunsItems<any>(ROSTER_ACTORS.instagramProfiles, runCount)

  let inserted = 0
  let matched = 0
  const errors: string[] = []
  for (const profile of profiles) {
    const influencer = rosterByHandle(profile?.username)
    if (!influencer) continue
    const posts = [...(profile.latestPosts || []), ...(profile.latestIgtvVideos || [])]
    for (const post of posts) {
      const caption = post.caption || ""
      const publishedAt = post.timestamp || post.taken_at
      if (!isFF8Content(caption, publishedAt)) continue
      const externalId = post.id || post.shortCode
      if (!externalId) continue
      matched++
      const { error } = await supabase.from("social_posts").upsert(
        {
          platform: "instagram",
          external_id: ROSTER_ID_PREFIX + String(externalId),
          post_url: post.url || (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : ""),
          caption,
          media_type: post.type || "Video",
          media_url: post.displayUrl,
          likes_count: Math.max(0, post.likesCount || 0),
          comments_count: post.commentsCount || 0,
          views_count: post.videoPlayCount || post.videoViewCount || 0,
          published_at: new Date(publishedAt).toISOString(),
          scraped_at: new Date().toISOString(),
          raw_data: {
            ...post,
            ownerUsername: profile.username,
            _roster: true,
            _rosterId: influencer.id,
            _rosterName: influencer.name,
            _rosterCategory: influencer.category,
          },
        },
        { onConflict: "platform,external_id" },
      )
      if (error) errors.push(error.message)
      else inserted++
    }
  }
  if (errors.length > 0) console.error("[roster] IG post sync errors (first 5):", errors.slice(0, 5))
  return { inserted, matched, total: profiles.length }
}

export async function syncRosterTikTokPosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const items = await getRecentRunsItems<any>(ROSTER_ACTORS.tiktokProfiles, runCount)

  let inserted = 0
  let matched = 0
  const errors: string[] = []
  for (const post of items) {
    const influencer = rosterByHandle(post?.authorMeta?.name)
    if (!influencer || !post.id) continue
    const publishedAt = post.createTimeISO || (post.createTime ? new Date(post.createTime * 1000) : null)
    if (!isFF8Content(post.text, publishedAt)) continue
    matched++
    const { error } = await supabase.from("social_posts").upsert(
      {
        platform: "tiktok",
        external_id: ROSTER_ID_PREFIX + String(post.id),
        post_url: post.webVideoUrl || `https://www.tiktok.com/@${influencer.handle}/video/${post.id}`,
        caption: post.text || "",
        media_type: "video",
        media_url: post.videoMeta?.coverUrl,
        likes_count: Math.max(0, post.diggCount || 0),
        comments_count: post.commentCount || 0,
        shares_count: post.shareCount || 0,
        views_count: post.playCount || 0,
        published_at: new Date(publishedAt as any).toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: {
          ...post,
          _roster: true,
          _rosterId: influencer.id,
          _rosterName: influencer.name,
          _rosterCategory: influencer.category,
        },
      },
      { onConflict: "platform,external_id" },
    )
    if (error) errors.push(error.message)
    else inserted++
  }
  if (errors.length > 0) console.error("[roster] TikTok post sync errors (first 5):", errors.slice(0, 5))
  return { inserted, matched, total: items.length }
}

// streamers/youtube-scraper items — one per video.
export async function syncRosterYouTubePosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const items = await getRecentRunsItems<any>(ROSTER_ACTORS.youtube, runCount)

  const norm = (v: unknown) => String(v || "").toLowerCase().replace(/[\s@_.-]/g, "")
  const ytChannels = FF8_ROSTER.filter((r) => r.platform === "youtube")
  const matchChannel = (item: any) => {
    const candidates = [item.channelName, item.channelUsername, item.channelUrl, item.aboutChannelInfo?.channelName]
      .map(norm)
      .filter(Boolean)
    return ytChannels.find((c) =>
      candidates.some((cand) => cand.includes(norm(c.handle)) || cand.includes(norm(c.name))),
    )
  }

  let inserted = 0
  let matched = 0
  const errors: string[] = []
  for (const item of items) {
    const url = item.url || (item.id ? `https://www.youtube.com/watch?v=${item.id}` : "")
    const videoId = item.id || youtubeVideoId(url)
    if (!videoId) continue
    const influencer = matchChannel(item)
    if (!influencer) continue
    const publishedAt = item.date || item.uploadDate
    const text = `${item.title || ""} ${item.text || item.description || ""}`
    if (!isFF8Content(text, publishedAt)) continue
    matched++
    const { error } = await supabase.from("social_posts").upsert(
      {
        platform: YT_STORAGE_PLATFORM,
        external_id: `${ROSTER_ID_PREFIX}yt_${videoId}`,
        post_url: url,
        caption: item.title || "",
        media_type: "video",
        media_url: item.thumbnailUrl,
        likes_count: Math.max(0, item.likes || 0),
        comments_count: item.commentsCount || 0,
        views_count: item.viewCount || 0,
        published_at: new Date(publishedAt).toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: {
          ...item,
          _roster: true,
          _platform: "youtube",
          _rosterId: influencer.id,
          _rosterName: influencer.name,
          _rosterCategory: influencer.category,
        },
      },
      { onConflict: "platform,external_id" },
    )
    if (error) errors.push(error.message)
    else inserted++
  }
  if (errors.length > 0) console.error("[roster] YouTube post sync errors (first 5):", errors.slice(0, 5))
  return { inserted, matched, total: items.length }
}

// ---------------------------------------------------------------------------
// F7-era roster posts (July 2025) for the launch-vs-launch comparison
// ---------------------------------------------------------------------------

const F7R_START = new Date("2025-07-08T20:00:00Z") // Jul 9, 2025 00:00 Gulf
const F7R_END = new Date("2025-07-20T20:00:00Z") // Jul 21, 2025 00:00 Gulf
const F7R_MARKERS = /fold|flip|فولد|فليب|فلب|unpacked|انباكد|أنباكد|galaxy\s*z|jointheflipside/i

// The brand sync's IG posts actor (apify/instagram-post-scraper) — sharing is
// safe because syncInstagramPosts keeps only samsunggulf-authored items and
// this ingest keeps only roster-authored ones.
const IG_POST_ACTOR = "nH2AHrwxeTRJoN5hX"

export async function startF7RosterScrapes() {
  const igHandles = FF8_ROSTER.filter((r) => r.platform === "instagram").map((r) => r.handle)
  const ttHandles = FF8_ROSTER.filter((r) => r.platform === "tiktok").map((r) => r.handle)
  const started: Record<string, string | null> = {}

  // Instagram cannot date-bound a profile scrape: page newest-first back to
  // July 2025 with a floor date and a hard charge cap.
  started.f7RosterInstagram = await startActorRun(
    IG_POST_ACTOR,
    { username: igHandles, resultsLimit: 400, onlyPostsNewerThan: "2025-07-05" },
    10,
  )
  started.f7RosterTikTok = await startActorRun(
    ROSTER_ACTORS.tiktokProfiles,
    {
      profiles: ttHandles,
      resultsPerPage: 60,
      profileSorting: "latest",
      oldestPostDateUnified: "2025-07-01",
      newestPostDate: "2025-07-21",
    },
    5,
  )
  return started
}

export async function syncF7RosterPosts(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const inWindow = (ts: unknown) => {
    const t = new Date(ts as string).getTime()
    return !isNaN(t) && t >= F7R_START.getTime() && t < F7R_END.getTime()
  }
  let inserted = 0
  let matched = 0
  const errors: string[] = []

  const igItems = await getRecentRunsItems<any>(IG_POST_ACTOR, runCount)
  for (const post of igItems) {
    const influencer = rosterByHandle(post?.ownerUsername)
    if (!influencer) continue
    if (!inWindow(post.timestamp) || !F7R_MARKERS.test(post.caption || "")) continue
    const externalId = post.id || post.shortCode
    if (!externalId) continue
    matched++
    const { error } = await supabase.from("social_posts").upsert(
      {
        platform: "instagram",
        external_id: F7_ROSTER_PREFIX + String(externalId),
        post_url: post.url || (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : ""),
        caption: post.caption || "",
        media_type: post.type || "Video",
        media_url: post.displayUrl,
        likes_count: Math.max(0, post.likesCount || 0),
        comments_count: post.commentsCount || 0,
        views_count: post.videoPlayCount || post.videoViewCount || 0,
        published_at: new Date(post.timestamp).toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: {
          ...post,
          _roster: true,
          _f7: true,
          _rosterId: influencer.id,
          _rosterName: influencer.name,
          _rosterCategory: influencer.category,
        },
      },
      { onConflict: "platform,external_id" },
    )
    if (error) errors.push(error.message)
    else inserted++
  }

  const ttItems = await getRecentRunsItems<any>(ROSTER_ACTORS.tiktokProfiles, runCount)
  for (const post of ttItems) {
    const influencer = rosterByHandle(post?.authorMeta?.name)
    if (!influencer || !post.id) continue
    const publishedAt = post.createTimeISO || (post.createTime ? new Date(post.createTime * 1000) : null)
    if (!inWindow(publishedAt) || !F7R_MARKERS.test(post.text || "")) continue
    matched++
    const { error } = await supabase.from("social_posts").upsert(
      {
        platform: "tiktok",
        external_id: F7_ROSTER_PREFIX + String(post.id),
        post_url: post.webVideoUrl || `https://www.tiktok.com/@${influencer.handle}/video/${post.id}`,
        caption: post.text || "",
        media_type: "video",
        media_url: post.videoMeta?.coverUrl,
        likes_count: Math.max(0, post.diggCount || 0),
        comments_count: post.commentCount || 0,
        shares_count: post.shareCount || 0,
        views_count: post.playCount || 0,
        published_at: new Date(publishedAt as any).toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: {
          ...post,
          _roster: true,
          _f7: true,
          _rosterId: influencer.id,
          _rosterName: influencer.name,
          _rosterCategory: influencer.category,
        },
      },
      { onConflict: "platform,external_id" },
    )
    if (error) errors.push(error.message)
    else inserted++
  }

  if (errors.length > 0) console.error("[roster] F7 post sync errors (first 5):", errors.slice(0, 5))
  return { inserted, matched, total: igItems.length + ttItems.length }
}

interface RosterPostRow {
  external_id: string
  platform: string
  post_url: string | null
}

async function getRosterPostRows(): Promise<RosterPostRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("social_posts")
    .select("external_id,platform,post_url")
    .like("external_id", `${ROSTER_ID_PREFIX}%`)
  if (error) {
    console.error("[roster] Failed to read roster posts:", error.message)
    return []
  }
  return (data as RosterPostRow[]) || []
}

function buildRosterKeySet(rows: RosterPostRow[]): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    const extId = stripRosterPrefix(String(row.external_id || ""))
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

export async function startRosterCommentScrapes() {
  const rows = await getRosterPostRows()
  const started: Record<string, string | null> = { rosterIgComments: null, rosterTtComments: null }

  const igUrls = [...new Set(rows.filter((r) => r.platform === "instagram" && r.post_url).map((r) => String(r.post_url)))]
  if (igUrls.length > 0) {
    started.rosterIgComments = await startActorRun(ROSTER_ACTORS.instagramComments, {
      directUrls: igUrls,
      resultsLimit: 300,
    })
  }
  const ttUrls = [...new Set(rows.filter((r) => r.platform === "tiktok" && r.post_url).map((r) => String(r.post_url)))]
  if (ttUrls.length > 0) {
    started.rosterTtComments = await startActorRun(ROSTER_ACTORS.tiktokComments, {
      postURLs: ttUrls,
      commentsPerPost: 300,
    })
  }

  const ytUrls = [...new Set(
    rows
      .filter((r) => String(r.external_id).startsWith(`${ROSTER_ID_PREFIX}yt_`) && r.post_url)
      .map((r) => String(r.post_url)),
  )]
  if (ytUrls.length > 0) {
    started.rosterYtComments = await startActorRun(ROSTER_ACTORS.youtubeComments, {
      startUrls: ytUrls.map((url) => ({ url })),
      maxComments: 300,
    })
  }
  return started
}

// The comment actors are shared across pipelines — keep ONLY comments whose
// parent is a roster post.
export async function syncRosterComments(runCount = RUNS_TO_SYNC) {
  const supabase = await createClient()
  const keys = buildRosterKeySet(await getRosterPostRows())
  let inserted = 0

  const igItems = await getRecentRunsItems<any>(ROSTER_ACTORS.instagramComments, runCount)
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
        external_id: ROSTER_ID_PREFIX + String(commentId),
        external_post_id: numeric || sc,
        text,
        author_username: c.ownerUsername || "unknown",
        likes_count: c.likesCount || 0,
        published_at: c.timestamp ? new Date(c.timestamp).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: { ...c, _roster: true },
      },
      { onConflict: "platform,external_id" },
    )
    if (!error) inserted++
  }

  const ttItems = await getRecentRunsItems<any>(ROSTER_ACTORS.tiktokComments, runCount)
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
        external_id: ROSTER_ID_PREFIX + String(commentId),
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
        raw_data: { ...c, _roster: true },
      },
      { onConflict: "platform,external_id" },
    )
    if (!error) inserted++
  }

  // YouTube — streamers/youtube-comments-scraper items.
  const ytIds = new Set(
    (await getRosterPostRows())
      .filter((r) => String(r.external_id).startsWith(`${ROSTER_ID_PREFIX}yt_`))
      .map((r) => stripRosterPrefix(String(r.external_id)).replace(/^yt_/, "")),
  )
  const ytItems = ytIds.size > 0 ? await getRecentRunsItems<any>(ROSTER_ACTORS.youtubeComments, runCount) : []
  const ytSeen = new Set<string>()
  for (const c of [...ytItems].reverse()) {
    const text = (c.comment || c.text || "").trim()
    if (!text) continue
    const videoId = c.videoId || youtubeVideoId(c.videoUrl || c.url || c.pageUrl || "")
    if (!videoId || !ytIds.has(videoId)) continue
    const commentId = c.cid || c.commentId || c.id || `${videoId}_${(c.author || "user")}_${text.slice(0, 40)}`
    if (ytSeen.has(String(commentId))) continue
    ytSeen.add(String(commentId))
    const { error } = await supabase.from("social_comments").upsert(
      {
        platform: YT_STORAGE_PLATFORM,
        external_id: `${ROSTER_ID_PREFIX}yt_${commentId}`,
        external_post_id: videoId,
        text,
        author_username: (c.author || c.authorName || "unknown").replace(/^@/, ""),
        likes_count: c.voteCount || c.likesCount || 0,
        published_at: c.date ? new Date(c.date).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        raw_data: { ...c, _roster: true, _platform: "youtube" },
      },
      { onConflict: "platform,external_id" },
    )
    if (!error) inserted++
  }

  return { inserted, total: igItems.length + ttItems.length + ytItems.length }
}

// Full roster cycle — mirrors the unpacked pipeline's fire-then-harvest model
// and is invoked from syncUnpacked so it rides the same twice-daily schedule.
export async function syncRoster(opts: { ingestOnly?: boolean } = {}) {
  const instagramPosts = await syncRosterInstagramPosts()
  const tiktokPosts = await syncRosterTikTokPosts()
  const youtubePosts = await syncRosterYouTubePosts()
  // F7-era roster posts (July 2025); no-op when no historical runs exist.
  // Their comment scrapes ride startRosterCommentScrapes automatically —
  // roster_f7_ rows match the roster_% selection there.
  const f7Posts = await syncF7RosterPosts()
  const comments = await syncRosterComments()
  const startedRuns = opts.ingestOnly
    ? {}
    : { ...(await startRosterPostScrapes()), ...(await startRosterCommentScrapes()) }
  return { instagramPosts, tiktokPosts, youtubePosts, f7Posts, comments, startedRuns }
}
