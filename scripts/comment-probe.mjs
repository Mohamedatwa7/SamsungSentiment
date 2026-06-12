// Comment-side Samsung detection: scrape ~10 comments per video for all
// S26-era videos of the four lifestyle accounts and search them for Samsung
// signals. Chunked capped runs.
// Run: node --env-file=.env.local scripts/comment-probe.mjs
const T = process.env.APIFY_API_TOKEN
const HANDLES = new Set(["husamkwaik", "leenjadaan", "danaindxb", "yourkuyamico"])

const items = []
for (const ds of ["TvDlKYa94QWjbM1w3", "bx5VrQrbiqlYX8U7c", "SsMAUaTaII2fOsUPU"]) {
  for (let o = 0; ; o += 1000) {
    const page = await (await fetch(`https://api.apify.com/v2/datasets/${ds}/items?token=${T}&limit=1000&offset=${o}`)).json()
    if (!Array.isArray(page) || !page.length) break
    items.push(...page)
    if (page.length < 1000) break
  }
}
const seen = new Set()
const urls = []
for (const p of items) {
  const u = (p.ownerUsername || "").toLowerCase()
  if (!HANDLES.has(u)) continue
  if ((p.timestamp || "") < "2026-02-01") continue
  if (!p.url || seen.has(p.url)) continue
  seen.add(p.url)
  urls.push(p.url)
}
console.log(`videos to probe: ${urls.length}`)

const runs = []
for (let i = 0; i < urls.length; i += 90) {
  const chunk = urls.slice(i, i + 90)
  const res = await fetch(`https://api.apify.com/v2/acts/apify~instagram-comment-scraper/runs?token=${T}&maxTotalChargeUsd=5`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ directUrls: chunk, resultsLimit: 10 }),
  })
  const out = await res.json()
  if (out.data?.id) { runs.push(out.data.id); console.log(`run ${out.data.id} (${chunk.length} urls)`) }
  else console.log("start failed:", JSON.stringify(out).slice(0, 150))
  await new Promise((r) => setTimeout(r, 400))
}
console.log(JSON.stringify(runs))
