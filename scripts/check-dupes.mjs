// Scan live Supabase tables for duplicate posts/comments:
// 1. key-level: same (platform, external_id) appearing twice
// 2. content-level: same (platform, text, author, published_at) under different external_ids
// Run: node --env-file=.env.local scripts/check-dupes.mjs
const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY

async function fetchAll(table, select) {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${U}/rest/v1/${table}?select=${select}&order=id.asc`, {
      headers: { apikey: K, Authorization: `Bearer ${K}`, Range: `${from}-${from + PAGE - 1}` },
    })
    const page = await res.json()
    if (!Array.isArray(page)) { console.error(table, "fetch error:", JSON.stringify(page).slice(0, 200)); break }
    rows.push(...page)
    if (page.length < PAGE) break
  }
  return rows
}

function report(label, rows, keyFn, contentFn) {
  const byKey = new Map()
  const byContent = new Map()
  for (const r of rows) {
    const k = keyFn(r)
    byKey.set(k, (byKey.get(k) || 0) + 1)
    const c = contentFn(r)
    if (c) {
      if (!byContent.has(c)) byContent.set(c, [])
      byContent.get(c).push(r.external_id)
    }
  }
  const keyDups = [...byKey.entries()].filter(([, n]) => n > 1)
  const contentDups = [...byContent.entries()].filter(([, ids]) => new Set(ids).size > 1)
  console.log(`\n${label}: ${rows.length} rows`)
  console.log(`  key-level dups (platform+external_id): ${keyDups.length}`)
  for (const [k, n] of keyDups.slice(0, 5)) console.log(`    ${k} x${n}`)
  console.log(`  content-level dups (same text/author/time, different ids): ${contentDups.length}`)
  for (const [c, ids] of contentDups.slice(0, 8)) console.log(`    [${[...new Set(ids)].join(" | ")}] ${c.slice(0, 90)}`)
  return contentDups
}

const posts = await fetchAll("social_posts", "external_id,platform,caption,published_at")
report("social_posts", posts,
  (r) => `${r.platform}:${r.external_id}`,
  (r) => (r.caption || "").trim() ? `${r.platform}|${(r.caption || "").trim()}` : null)

const comments = await fetchAll("social_comments", "external_id,platform,text,author_username,published_at")
report("social_comments", comments,
  (r) => `${r.platform}:${r.external_id}`,
  (r) => (r.text || "").trim() ? `${r.platform}|${r.author_username}|${(r.text || "").trim()}|${r.published_at}` : null)
