// Ingest the one-off historical Apify datasets (posts Jan 2025 → now, deep IG
// comments, the previously-aborted TikTok comments run) into Supabase, then
// repair orphaned comment->post references left by the old static import.
// Run: node --env-file=.env.local scripts/ingest-historical.mjs
const T = process.env.APIFY_API_TOKEN
const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" }

const DATASETS = {
  igPosts: "evf1dU1fcGLTuKB3O",
  fbPosts: "oOyGtrpkhHlIgxXTW",
  tiktokPosts: "A4Ff4YRUjvX98Xbzm",
  xPosts: "MkJUNbjMDHD5Ff51k",
  igComments: "2mcfVEdH0VJ9rwyp9",
}
const ABORTED_TIKTOK_COMMENTS_RUN = "nuwzGJBV3ZpGYQznm"

// --- helpers ---------------------------------------------------------------

async function getItems(datasetId) {
  const all = []
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${T}&limit=1000&offset=${offset}`)
    const page = await res.json()
    if (!Array.isArray(page) || page.length === 0) break
    all.push(...page)
    if (page.length < 1000) break
  }
  return all
}

async function upsertBatch(table, rows) {
  let ok = 0
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const res = await fetch(`${U}/rest/v1/${table}?on_conflict=platform,external_id`, {
      method: "POST",
      headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(batch),
    })
    if (!res.ok) {
      console.error(`  batch ${i}: ${res.status} ${(await res.text()).slice(0, 200)}`)
    } else ok += batch.length
  }
  return ok
}

// Dedupe rows by external_id (keep last occurrence = newest data).
function dedupe(rows) {
  const m = new Map()
  for (const r of rows) m.set(r.external_id, r)
  return [...m.values()]
}

const now = new Date().toISOString()

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
function shortcodeToId(s) {
  if (!/^[A-Za-z0-9\-_]{5,15}$/.test(s || "")) return null
  let n = 0n
  for (const c of s) {
    const i = ALPHABET.indexOf(c)
    if (i < 0) return null
    n = n * 64n + BigInt(i)
  }
  return n.toString()
}

// --- 1. Instagram posts ------------------------------------------------------

const igPosts = await getItems(DATASETS.igPosts)
console.log(`IG posts fetched: ${igPosts.length}`)
const igRows = dedupe(igPosts.filter((p) => p.id || p.shortCode).map((p) => ({
  platform: "instagram",
  external_id: String(p.id || shortcodeToId(p.shortCode) || p.shortCode),
  post_url: p.url || `https://www.instagram.com/p/${p.shortCode}/`,
  caption: p.caption || "",
  media_type: p.type || "image",
  media_url: p.displayUrl,
  likes_count: p.likesCount > 0 ? p.likesCount : 0,
  comments_count: p.commentsCount || 0,
  views_count: p.videoViewCount || p.videoPlayCount || 0,
  published_at: p.timestamp ? new Date(p.timestamp).toISOString() : now,
  scraped_at: now,
  raw_data: p,
})))
console.log(`IG posts upserted: ${await upsertBatch("social_posts", igRows)}`)

// --- 2. Facebook posts -------------------------------------------------------

const fbPosts = await getItems(DATASETS.fbPosts)
console.log(`FB posts fetched: ${fbPosts.length}`)
const fbRows = dedupe(fbPosts.filter((p) => p.postId).map((p) => ({
  platform: "facebook",
  external_id: String(p.postId),
  post_url: p.url || p.topLevelUrl || "",
  caption: p.text || "",
  media_type: "post",
  likes_count: p.likes || 0,
  comments_count: p.comments || 0,
  shares_count: p.shares || 0,
  published_at: p.time ? new Date(p.time).toISOString() : now,
  scraped_at: now,
  raw_data: p,
})))
console.log(`FB posts upserted: ${await upsertBatch("social_posts", fbRows)}`)

// --- 3. TikTok posts ----------------------------------------------------------

const ttPosts = await getItems(DATASETS.tiktokPosts)
console.log(`TikTok posts fetched: ${ttPosts.length}`)
const ttRows = dedupe(ttPosts.filter((p) => p.id).map((p) => ({
  platform: "tiktok",
  external_id: String(p.id),
  post_url: p.webVideoUrl || `https://www.tiktok.com/@samsunggulf/video/${p.id}`,
  caption: p.text || "",
  media_type: "video",
  media_url: p.videoMeta?.coverUrl,
  likes_count: p.diggCount || 0,
  comments_count: p.commentCount || 0,
  shares_count: p.shareCount || 0,
  views_count: p.playCount || 0,
  published_at: p.createTimeISO || (p.createTime ? new Date(p.createTime * 1000).toISOString() : now),
  scraped_at: now,
  raw_data: p,
})))
console.log(`TikTok posts upserted: ${await upsertBatch("social_posts", ttRows)}`)

// --- 4. X posts ----------------------------------------------------------------

const xPosts = await getItems(DATASETS.xPosts)
console.log(`X posts fetched: ${xPosts.length}`)
const xRows = dedupe(xPosts.map((p) => {
  const externalId =
    p.id || p.postId || p.tweetId || p.id_str || p.rest_id ||
    (p.postUrl ? String(p.postUrl).match(/status\/(\d+)/)?.[1] : undefined)
  if (!externalId) return null
  const publishedAt = p.createdAt
    ? new Date(p.createdAt).toISOString()
    : typeof p.timestamp === "number"
      ? new Date(p.timestamp).toISOString()
      : now
  return {
    platform: "twitter",
    external_id: String(externalId),
    post_url: p.url || p.tweetUrl || p.postUrl || `https://twitter.com/i/status/${externalId}`,
    caption: p.fullText || p.text || p.full_text || p.postText || "",
    media_type: "text",
    likes_count: p.likeCount || p.favorite_count || p.favouriteCount || 0,
    comments_count: p.replyCount || p.reply_count || 0,
    shares_count: p.retweetCount || p.retweet_count || p.repostCount || 0,
    views_count: p.viewCount || p.views_count || 0,
    published_at: publishedAt,
    scraped_at: now,
    raw_data: p,
  }
}).filter(Boolean))
console.log(`X posts upserted: ${await upsertBatch("social_posts", xRows)}`)

// --- 5. Deep IG comments (same key scheme as lib/apify-sync) -------------------

const igComments = await getItems(DATASETS.igComments)
console.log(`IG comments fetched: ${igComments.length}`)
const igcRows = dedupe(igComments.map((c) => {
  const postInfo = c.postInfo || {}
  const text = c.commentText || c.text || ""
  const ts = c.commentTimestamp || c.timestamp
  const user = c.commentatorUserName || c.ownerUsername || "unknown"
  const legacyRef = String(
    postInfo.shortCode || postInfo.id || c.postId || c.shortCode ||
    (c.postUrl ? (String(c.postUrl).match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9\-_]+)/) || [])[1] : "") ||
    "",
  )
  const externalPostId = /^\d+$/.test(legacyRef) ? legacyRef : shortcodeToId(legacyRef) || legacyRef || "unknown"
  const uniqueKey = `${legacyRef || "unknown"}_${user}_${ts || text.slice(0, 40)}`
  const commentId = c.id || c.pk || c.cid || uniqueKey
  return {
    platform: "instagram",
    external_id: String(commentId),
    external_post_id: externalPostId,
    text,
    author_username: user,
    likes_count: Number(c.likesCount) || 0,
    published_at: ts ? new Date(ts).toISOString() : now,
    scraped_at: now,
    raw_data: c,
  }
}))
console.log(`IG comments upserted: ${await upsertBatch("social_comments", igcRows)}`)

// --- 6. TikTok comments from the aborted (already paid) run --------------------

const run = (await (await fetch(`https://api.apify.com/v2/actor-runs/${ABORTED_TIKTOK_COMMENTS_RUN}?token=${T}`)).json()).data
const ttComments = await getItems(run.defaultDatasetId)
console.log(`TikTok comments (aborted run) fetched: ${ttComments.length}`)
const ttcRows = dedupe(ttComments.filter((c) => c.comment_id).map((c) => {
  const videoIdMatch = c.video_url?.match(/video\/(\d+)/)
  return {
    platform: "tiktok",
    external_id: String(c.comment_id),
    external_post_id: videoIdMatch ? videoIdMatch[1] : c.video_url || "unknown",
    text: c.comment || "",
    author_username: c.author_username || c.author_display_name || "unknown",
    author_display_name: c.author_display_name,
    likes_count: c.likes || 0,
    replies_count: c.reply_count || 0,
    published_at: c.created_at ? new Date(c.created_at).toISOString() : now,
    scraped_at: now,
    raw_data: c,
  }
}))
console.log(`TikTok comments upserted: ${await upsertBatch("social_comments", ttcRows)}`)

// --- 7. Repair orphaned external_post_id from the old static import ------------

console.log("\nRepairing orphaned comment->post references...")
const PAGE = 1000
let repaired = 0
for (const platform of ["instagram", "tiktok", "facebook"]) {
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(
      `${U}/rest/v1/social_comments?select=id,external_post_id,raw_data&platform=eq.${platform}&order=id.asc`,
      { headers: { ...H, Range: `${from}-${from + PAGE - 1}` } },
    )
    const page = await res.json()
    if (!Array.isArray(page) || page.length === 0) break
    const updates = []
    for (const c of page) {
      const cur = String(c.external_post_id || "")
      const isOrphanKey = /^(ig-|tt-|fb-)/.test(cur)
      if (!isOrphanKey) continue
      const ref = String(c.raw_data?.postId || "")
      if (!ref || ref === cur) continue
      // numeric ids can be written directly; URLs are resolved at read time by
      // the /api/comments alias index, but store them anyway — better than a
      // dangling synthetic key.
      updates.push({ id: c.id, external_post_id: ref })
    }
    for (const u of updates) {
      const r = await fetch(`${U}/rest/v1/social_comments?id=eq.${u.id}`, {
        method: "PATCH",
        headers: { ...H, Prefer: "return=minimal" },
        body: JSON.stringify({ external_post_id: u.external_post_id }),
      })
      if (r.ok) repaired++
    }
    if (page.length < PAGE) break
  }
}
console.log(`repaired external_post_id on ${repaired} comments`)
console.log("\nDONE")
