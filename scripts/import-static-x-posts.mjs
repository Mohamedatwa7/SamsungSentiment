// Import the static X/Twitter posts file (812 posts back to Aug 2024) — the
// live actor caps at 200 results so deeper history only exists in this file.
// Run: node --env-file=.env.local scripts/import-static-x-posts.mjs
import { readFileSync } from "fs"

const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" }

const items = JSON.parse(readFileSync("data/twitter-posts.json", "utf8"))
const now = new Date().toISOString()

const rows = new Map()
for (const p of items) {
  const id = String(p.id || "").match(/^\d+$/)
    ? String(p.id)
    : (p.url || "").match(/status\/(\d+)/)?.[1]
  if (!id) continue
  rows.set(id, {
    platform: "twitter",
    external_id: id,
    post_url: p.url || `https://twitter.com/i/status/${id}`,
    caption: p.content || "",
    media_type: "text",
    likes_count: p.engagement?.likes || 0,
    comments_count: p.engagement?.comments || 0,
    shares_count: p.engagement?.shares || 0,
    views_count: p.engagement?.views || 0,
    published_at: p.timestamp ? new Date(p.timestamp).toISOString() : now,
    scraped_at: now,
    raw_data: p,
  })
}

const all = [...rows.values()]
console.log(`importing ${all.length} X posts (${items.length} in file)`)
let ok = 0
for (let i = 0; i < all.length; i += 100) {
  const batch = all.slice(i, i + 100)
  // ignore-duplicates: never overwrite fresher Apify data with the static file
  const res = await fetch(`${U}/rest/v1/social_posts?on_conflict=platform,external_id`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(batch),
  })
  if (!res.ok) console.error(`batch ${i}: ${res.status} ${(await res.text()).slice(0, 150)}`)
  else ok += batch.length
}
console.log(`done, attempted ${ok}`)
