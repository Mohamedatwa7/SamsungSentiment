// One-off: ingest a Samsung Gulf X timeline run (apidojo/tweet-scraper with
// twitterHandles) as posts — includes the brand's own thread replies, which
// the profile-posts scraper never returns.
// Usage: node --env-file=.env.local scripts/ingest-x-timeline.mjs <runId>
const T = process.env.APIFY_API_TOKEN
const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" }
const runId = process.argv[2]
if (!runId) { console.error("usage: ingest-x-timeline.mjs <runId>"); process.exit(1) }

const run = (await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${T}`)).json()).data
const items = []
for (let o = 0; ; o += 1000) {
  const page = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${T}&limit=1000&offset=${o}`)).json()
  if (!Array.isArray(page) || !page.length) break
  items.push(...page)
  if (page.length < 1000) break
}

const now = new Date().toISOString()
const rows = new Map()
for (const t of items) {
  if (!t?.id) continue
  if ((t.author?.userName || "").toLowerCase() !== "samsunggulf") continue
  if (t.isRetweet) continue
  const published = t.createdAt ? new Date(t.createdAt) : null
  rows.set(String(t.id), {
    platform: "twitter",
    external_id: String(t.id),
    post_url: t.url || t.twitterUrl || `https://x.com/SamsungGulf/status/${t.id}`,
    caption: t.text || t.fullText || "",
    media_type: "text",
    likes_count: t.likeCount || 0,
    comments_count: t.replyCount || 0,
    shares_count: t.retweetCount || 0,
    views_count: Number(t.viewCount) || 0,
    published_at: published && !isNaN(published.getTime()) ? published.toISOString() : now,
    scraped_at: now,
    raw_data: t,
  })
}

const all = [...rows.values()]
let ok = 0
for (let i = 0; i < all.length; i += 100) {
  const res = await fetch(`${U}/rest/v1/social_posts?on_conflict=platform,external_id`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(all.slice(i, i + 100)),
  })
  if (!res.ok) console.error(`batch ${i}: ${res.status} ${(await res.text()).slice(0, 150)}`)
  else ok += Math.min(100, all.length - i)
}
console.log(`timeline items: ${items.length}, own tweets upserted: ${ok}`)
