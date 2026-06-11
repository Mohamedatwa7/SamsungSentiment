// Facebook pfbid URLs are session-rotating encrypted ids, so comments scraped
// in April reference URLs that can never string-match posts scraped today.
// Bridge: data/facebook-posts.json came from the SAME April session as the
// comments (same pfbid URLs) and carries each post's caption — match captions
// against the freshly scraped posts to map pfbid URL -> real external_id, then
// patch the unresolved comments. Run AFTER ingest-historical's repair phase.
// Run: node --env-file=.env.local scripts/bridge-fb-pfbid.mjs
import { readFileSync } from "fs"

const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" }

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120)

// 1. DB facebook posts -> caption index
const dbPosts = []
for (let f = 0; ; f += 1000) {
  const p = await (await fetch(`${U}/rest/v1/social_posts?select=external_id,post_url,caption&platform=eq.facebook&order=id.asc`, {
    headers: { ...H, Range: `${f}-${f + 999}` },
  })).json()
  if (!Array.isArray(p) || !p.length) break
  dbPosts.push(...p)
  if (p.length < 1000) break
}
const byCaption = new Map()
for (const p of dbPosts) {
  const key = norm(p.caption)
  if (key.length < 20) continue // too short to be a unique fingerprint
  if (!byCaption.has(key)) byCaption.set(key, p)
}
console.log(`db fb posts: ${dbPosts.length}, caption-indexable: ${byCaption.size}`)

// 2. static file: pfbid/april URL -> caption -> db post
const fileItems = JSON.parse(readFileSync("data/facebook-posts.json", "utf8"))
const urlToPost = new Map()
let bridged = 0
for (const it of fileItems) {
  const key = norm(it.content)
  if (key.length < 20) continue
  const hit = byCaption.get(key)
  if (!hit) continue
  const aprilUrl = String(it.url || "").replace(/\/+$/, "")
  if (aprilUrl) { urlToPost.set(aprilUrl, hit); bridged++ }
}
console.log(`bridged ${bridged} april URLs to scraped posts`)

// 3. patch unresolved fb comments whose raw postId matches a bridged URL
let patched = 0, scanned = 0
for (let f = 0; ; f += 1000) {
  const rows = await (await fetch(
    `${U}/rest/v1/social_comments?select=id,external_post_id,raw_data->>postId&platform=eq.facebook&order=id.asc`,
    { headers: { ...H, Range: `${f}-${f + 999}` } },
  )).json()
  if (!Array.isArray(rows) || !rows.length) break
  for (const r of rows) {
    scanned++
    const cur = String(r.external_post_id || "")
    if (/^\d+$/.test(cur)) continue // already a real id
    const ref = String(r.postId || "").replace(/\/+$/, "")
    const hit = urlToPost.get(ref)
    if (!hit) continue
    const res = await fetch(`${U}/rest/v1/social_comments?id=eq.${r.id}`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ external_post_id: hit.external_id }),
    })
    if (res.ok) patched++
  }
  if (rows.length < 1000) break
}
console.log(`scanned ${scanned} fb comments, patched ${patched}`)
