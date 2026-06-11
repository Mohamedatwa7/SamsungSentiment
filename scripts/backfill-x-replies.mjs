// Backfill X replies (Jan 2025 -> now) via apidojo/tweet-scraper.
// Giveaway mega-threads (thousands of contest-entry replies) are sampled at
// 300 replies each; normal conversations are fetched in batched runs.
// Run: node --env-file=.env.local scripts/backfill-x-replies.mjs
const T = process.env.APIFY_API_TOKEN
const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}` }
const ACTOR = "61RPP7dywgiy0JPD0"

const posts = []
for (let f = 0; ; f += 1000) {
  const rows = await (await fetch(
    `${U}/rest/v1/social_posts?select=external_id,comments_count&platform=eq.twitter&published_at=gte.2025-01-01&comments_count=gt.0&order=id.asc`,
    { headers: { ...H, Range: `${f}-${f + 999}` } },
  )).json()
  if (!Array.isArray(rows) || !rows.length) break
  posts.push(...rows)
  if (rows.length < 1000) break
}
const big = posts.filter((p) => p.comments_count > 300 && /^\d+$/.test(p.external_id))
const small = posts.filter((p) => p.comments_count <= 300 && /^\d+$/.test(p.external_id))
const smallSum = small.reduce((s, p) => s + p.comments_count, 0)
console.log(`tweets with replies: ${posts.length} (big>300: ${big.length}, small: ${small.length}, small reply sum: ${smallSum})`)

async function startRun(input, cap) {
  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${T}&maxTotalChargeUsd=${cap}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const out = await res.json()
  if (!res.ok) { console.error("run failed:", res.status, JSON.stringify(out).slice(0, 150)); return null }
  return out.data.id
}

const runs = []
// Big conversations: one run each, sampled at 300 replies.
for (const p of big) {
  const id = await startRun({ conversationIds: [p.external_id], maxItems: 300 }, 1)
  if (id) runs.push(id)
  await new Promise((r) => setTimeout(r, 300))
}
// Small conversations: batches of 80 ids per run.
for (let i = 0; i < small.length; i += 80) {
  const batch = small.slice(i, i + 80)
  const maxItems = Math.min(8000, batch.reduce((s, p) => s + p.comments_count, 0) + 200)
  const id = await startRun({ conversationIds: batch.map((p) => p.external_id), maxItems }, 5)
  if (id) runs.push(id)
  await new Promise((r) => setTimeout(r, 300))
}
console.log(`started ${runs.length} runs`)
console.log(JSON.stringify(runs))
