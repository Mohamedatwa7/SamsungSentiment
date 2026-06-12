// Detect Samsung-linked influencer posts via caption OR tags/mentions/
// coauthors, across one or more datasets. Prints candidates for curation.
// Run: node --env-file=.env.local scripts/detect-samsung-posts.mjs <dsId> [dsId2...]
const T = process.env.APIFY_API_TOKEN
const HANDLES = new Set(["osamaqaq", "husamkwaik", "leenjadaan", "danaindxb", "yourkuyamico"])

const items = []
for (const ds of process.argv.slice(2)) {
  for (let o = 0; ; o += 1000) {
    const page = await (await fetch(`https://api.apify.com/v2/datasets/${ds}/items?token=${T}&limit=1000&offset=${o}`)).json()
    if (!Array.isArray(page) || !page.length) break
    items.push(...page)
    if (page.length < 1000) break
  }
}
console.log(`scanned ${items.length} items`)

const S26 = /s\s?26|galaxys26|galaxy\s?s\s?26|privacy\s?display|غالاكسي.?(اس)?.?٢٦|اس\s?٢٦/i
const SAMSUNG_HANDLE = /samsung/i

const seen = new Set()
for (const p of items) {
  const owner = (p.ownerUsername || "").toLowerCase()
  if (!HANDLES.has(owner)) continue
  const url = p.url || ""
  if (seen.has(url)) continue
  seen.add(url)

  const cap = p.caption || ""
  const tagged = (p.taggedUsers || []).map((u) => u.username || u.full_name || "").join(" ")
  const mentions = (p.mentions || []).join(" ")
  const coauthors = (p.coauthorProducers || []).map((c) => c.username || "").join(" ")
  const social = `${tagged} ${mentions} ${coauthors}`

  const s26Hit = S26.test(cap)
  const samsungLinked = SAMSUNG_HANDLE.test(social) || SAMSUNG_HANDLE.test(cap)
  if (!s26Hit && !samsungLinked) continue

  console.log(
    `${owner} | ${(p.timestamp || "").slice(0, 10)} | ${s26Hit ? "S26-caption" : "samsung-linked"} | ${url}`,
  )
  console.log(`   tags: ${social.trim().slice(0, 80) || "-"}`)
  console.log(`   cap:  ${cap.replace(/\n/g, " ").slice(0, 110)}`)
}
