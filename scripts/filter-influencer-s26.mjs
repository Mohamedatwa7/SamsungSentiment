// Inspect the lifestyle-influencer post scrape: strictly S26-related posts
// only. Prints matches AND near-misses (samsung-related but not S26) so the
// selection can be sanity-checked before scraping comments.
const T = process.env.APIFY_API_TOKEN
const POSTS_DS = "TvDlKYa94QWjbM1w3"
const PROFILES_DS = "T2fXnxpD6hVmrDqkw"

const items = []
for (let o = 0; ; o += 1000) {
  const page = await (await fetch(`https://api.apify.com/v2/datasets/${POSTS_DS}/items?token=${T}&limit=1000&offset=${o}`)).json()
  if (!Array.isArray(page) || !page.length) break
  items.push(...page)
  if (page.length < 1000) break
}

const S26 = /s\s?26|galaxys26|galaxy\s?s\s?26|privacy\s?display|#galaxyai|galaxy\s?unpacked/i
const SAMSUNG = /samsung|galaxy|سامسونج|جالكسي/i

const byUser = {}
for (const p of items) {
  const u = (p.ownerUsername || "").toLowerCase()
  if (!byUser[u]) byUser[u] = { s26: [], samsungOther: [], total: 0 }
  byUser[u].total++
  const cap = p.caption || ""
  if (S26.test(cap)) byUser[u].s26.push(p)
  else if (SAMSUNG.test(cap)) byUser[u].samsungOther.push(p)
}

for (const [u, d] of Object.entries(byUser)) {
  console.log(`\n=== ${u} — ${d.total} posts scraped, ${d.s26.length} S26 matches, ${d.samsungOther.length} samsung-but-not-S26`)
  for (const p of d.s26) {
    console.log(`  [S26] ${(p.timestamp || "").slice(0, 10)} ${p.url} | ${(p.caption || "").replace(/\n/g, " ").slice(0, 90)}`)
  }
  for (const p of d.samsungOther) {
    console.log(`  [other-samsung] ${(p.timestamp || "").slice(0, 10)} ${p.url} | ${(p.caption || "").replace(/\n/g, " ").slice(0, 90)}`)
  }
}

const profiles = await (await fetch(`https://api.apify.com/v2/datasets/${PROFILES_DS}/items?token=${T}&limit=10`)).json()
console.log("\n=== profiles ===")
for (const pr of profiles) {
  console.log(`${pr.username}: followers=${pr.followersCount} fullName=${pr.fullName}`)
}
