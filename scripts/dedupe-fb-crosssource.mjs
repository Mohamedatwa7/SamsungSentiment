// Cross-source dedupe: the June facebook-comments scrape re-ingested comments
// that the April static import stored under fb-* ids with author "Facebook
// User". Authors differ between the two copies, so the earlier author+text
// dedupe missed them. Group by (platform, normalized substantial text); only
// collapse a group when at least one copy is static-ish, keep the best copy
// (real id, real author, analyzed, more likes).
// Run: node --env-file=.env.local scripts/dedupe-fb-crosssource.mjs [--apply]
const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes("--apply")
const H = { apikey: K, Authorization: `Bearer ${K}` }

const rows = []
for (let f = 0; ; f += 1000) {
  const page = await (await fetch(
    `${U}/rest/v1/social_comments?select=id,external_id,platform,text,author_username,likes_count,sentiment_analyzed_at&order=id.asc`,
    { headers: { ...H, Range: `${f}-${f + 999}` } },
  )).json()
  if (!Array.isArray(page) || !page.length) break
  rows.push(...page)
  if (page.length < 1000) break
}
console.log(`fetched ${rows.length} comments`)

const isStatic = (r) =>
  /^(ig-p\d+-|tt-|fb-)/.test(r.external_id || "") || (r.author_username || "") === "Facebook User"

const norm = (s) =>
  String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim()

const groups = new Map()
for (const r of rows) {
  const n = norm(r.text)
  if (n.length < 20) continue // short/emoji texts are too generic to merge on
  const key = `${r.platform}|${n.slice(0, 120)}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(r)
}

const toDelete = []
let dupGroups = 0
for (const members of groups.values()) {
  if (members.length < 2) continue
  const staticRows = members.filter(isStatic)
  const freshRows = members.filter((m) => !isStatic(m))
  // A static row is only a duplicate if a FRESH copy of the same text exists —
  // and each fresh copy proves at most ONE duplicate. Groups of N identical
  // static comments with no fresh twin are N distinct (anonymized) users.
  if (staticRows.length === 0 || freshRows.length === 0) continue
  dupGroups++
  const removable = Math.min(staticRows.length, freshRows.length)
  // Remove the lowest-quality static copies first (unanalyzed, fewest likes).
  const ranked = [...staticRows].sort(
    (a, b) =>
      Number(!!a.sentiment_analyzed_at) - Number(!!b.sentiment_analyzed_at) ||
      (a.likes_count || 0) - (b.likes_count || 0),
  )
  toDelete.push(...ranked.slice(0, removable))
}
console.log(`cross-source dup groups: ${dupGroups}, rows to delete: ${toDelete.length}`)
for (const d of toDelete.slice(0, 8)) {
  console.log(`  delete ${d.platform}/${d.external_id} (${d.author_username}) "${(d.text || "").slice(0, 50)}"`)
}
if (!APPLY) { console.log("\nDRY RUN — rerun with --apply"); process.exit(0) }

let deleted = 0
for (let i = 0; i < toDelete.length; i += 50) {
  const ids = toDelete.slice(i, i + 50).map((d) => `"${d.id}"`).join(",")
  const res = await fetch(`${U}/rest/v1/social_comments?id=in.(${ids})`, { method: "DELETE", headers: H })
  if (!res.ok) { console.error("delete failed:", res.status); process.exit(1) }
  deleted += Math.min(50, toDelete.length - i)
}
console.log(`deleted ${deleted}`)
