// Ingest the one-off Facebook reels dataset so reel comments can resolve
// their parent posts. Run: node --env-file=.env.local scripts/ingest-fb-reels.mjs
const T = process.env.APIFY_API_TOKEN
const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" }
const DATASET = "Q1a0W9gfOnSGL3VR7"

const items = []
for (let offset = 0; ; offset += 1000) {
  const res = await fetch(`https://api.apify.com/v2/datasets/${DATASET}/items?token=${T}&limit=1000&offset=${offset}`)
  const page = await res.json()
  if (!Array.isArray(page) || page.length === 0) break
  items.push(...page)
  if (page.length < 1000) break
}
console.log(`reels fetched: ${items.length}`)
if (items[0]) console.log("first item keys:", Object.keys(items[0]).join(","))

const now = new Date().toISOString()
const rows = new Map()
for (const r of items) {
  // apify/facebook-reels-scraper shape: video.id is the reel id, URL lives in
  // topLevelReelUrl / shareable_url, view count in playCountRounded.
  const id = String(
    r.video?.id ||
    (r.topLevelReelUrl || r.shareable_url || r.url || "").match(/\/reel\/(\d+)/)?.[1] ||
    "",
  )
  if (!id) continue
  rows.set(id, {
    platform: "facebook",
    external_id: id,
    post_url: r.shareable_url || r.topLevelReelUrl || `https://www.facebook.com/reel/${id}/`,
    caption: r.text || r.track_title || "",
    media_type: "reel",
    media_url: r.video?.first_frame_thumbnail || undefined,
    likes_count: r.likesCount || r.likes || 0,
    comments_count: r.commentsCount || r.comments || 0,
    shares_count: r.sharesCount || r.shares || 0,
    views_count: r.playCountRounded || r.playCount || 0,
    published_at: r.time ? new Date(r.time).toISOString() : now,
    scraped_at: now,
    raw_data: r,
  })
}
const all = [...rows.values()]
console.log(`upserting ${all.length} reels`)
let ok = 0
for (let i = 0; i < all.length; i += 100) {
  const batch = all.slice(i, i + 100)
  const res = await fetch(`${U}/rest/v1/social_posts?on_conflict=platform,external_id`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(batch),
  })
  if (!res.ok) console.error(`batch ${i}: ${res.status} ${(await res.text()).slice(0, 150)}`)
  else ok += batch.length
}
console.log(`done: ${ok}`)
