// One-time cleanup of content-duplicate comments.
// A duplicate = same (platform, author_username, text, published_at) under
// different external_ids. Keeper preference:
//   1. non-static external_id (NOT ig-p*/tt-* from the one-time static import),
//      because the daily Apify sync regenerates those ids — deleting them would
//      just re-create the duplicate on the next sync
//   2. already sentiment-analyzed
//   3. oldest created_at (stable tiebreak)
// Run: node --env-file=.env.local scripts/dedupe-comments.mjs [--apply]
const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes("--apply")
const H = { apikey: K, Authorization: `Bearer ${K}` }

const rows = []
const PAGE = 1000
for (let from = 0; ; from += PAGE) {
  const res = await fetch(
    `${U}/rest/v1/social_comments?select=id,external_id,platform,text,author_username,published_at,sentiment_analyzed_at,created_at&order=id.asc`,
    { headers: { ...H, Range: `${from}-${from + PAGE - 1}` } },
  )
  const page = await res.json()
  if (!Array.isArray(page)) { console.error("fetch error:", JSON.stringify(page).slice(0, 200)); process.exit(1) }
  rows.push(...page)
  if (page.length < PAGE) break
}
console.log(`fetched ${rows.length} comments`)

const isStatic = (extId) => /^(ig-p\d+-|tt-)/.test(extId || "")

const groups = new Map()
for (const r of rows) {
  const text = (r.text || "").trim()
  if (!text) continue
  const key = `${r.platform}|${r.author_username}|${text}|${r.published_at}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(r)
}

const toDelete = []
let dupGroups = 0
for (const members of groups.values()) {
  if (members.length < 2) continue
  dupGroups++
  const ranked = [...members].sort((a, b) => {
    const s = Number(isStatic(a.external_id)) - Number(isStatic(b.external_id))
    if (s !== 0) return s
    const an = Number(!a.sentiment_analyzed_at) - Number(!b.sentiment_analyzed_at)
    if (an !== 0) return an
    return (a.created_at || "").localeCompare(b.created_at || "")
  })
  toDelete.push(...ranked.slice(1))
}

console.log(`duplicate groups: ${dupGroups}, rows to delete: ${toDelete.length}`)
for (const d of toDelete.slice(0, 10)) {
  console.log(`  delete ${d.platform}/${d.external_id}  "${(d.text || "").slice(0, 50)}"`)
}
if (!APPLY) { console.log("\nDRY RUN — rerun with --apply to delete"); process.exit(0) }

let deleted = 0
for (let i = 0; i < toDelete.length; i += 50) {
  const ids = toDelete.slice(i, i + 50).map((d) => `"${d.id}"`).join(",")
  const res = await fetch(`${U}/rest/v1/social_comments?id=in.(${ids})`, { method: "DELETE", headers: H })
  if (!res.ok) { console.error("delete failed:", res.status, await res.text()); process.exit(1) }
  deleted += Math.min(50, toDelete.length - i)
}
console.log(`deleted ${deleted} duplicate rows`)
