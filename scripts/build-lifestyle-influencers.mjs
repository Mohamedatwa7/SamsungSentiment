// Build per-influencer comment files from the S26-video comment scrape, and
// compute engagement rates (avg likes+comments on tracked S26 posts vs
// followers). Run: node --env-file=.env.local scripts/build-lifestyle-influencers.mjs <commentsRunId>
import { writeFileSync, unlinkSync, existsSync } from "fs"

const T = process.env.APIFY_API_TOKEN
const RUN = process.argv[2]

// shortcode -> influencer id
const POST_MAP = {
  "DVML4Rpk-lG": "pixels100",
  "DWGiyHaAiyf": "pixels100",
  "DW808prtyYd": "yazxan",
  "DVMK0P7DaM_": "yazxan",
  "DVGxosNEvv8": "yazxan",
  "DXo7hALjLb6": "farhaahmd",
  "DZAc1v2s6if": "farhaahmd",
  "DYuiQb4KFBd": "hazansasou",
  "DVMKsAkjLLB": "hazansasou",
  "DU-vIx4DJvs": "hazansasou",
  "DZam4RNNFzx": "basharkk",
  "DY7cWcathPe": "basharkk",
  "DXKJP8JDYtk": "basharkk",
  "DVMLB8aE_VK": "basharkk",
  "DU0tJT-k7uu": "basharkk",
}
const FOLLOWERS = {
  pixels100: 381452,
  yazxan: 457585,
  farhaahmd: 108053,
  hazansasou: 18173,
  basharkk: 747301,
}
const HANDLE_OWNER = {
  "100.pixels": "pixels100",
  yazxan: "yazxan",
  farhaahmd: "farhaahmd",
  "hazansasou_": "hazansasou",
  basharkk: "basharkk",
}

const run = (await (await fetch(`https://api.apify.com/v2/actor-runs/${RUN}?token=${T}`)).json()).data
console.log(`comments run: ${run.status}`)
const items = []
for (let o = 0; ; o += 1000) {
  const page = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${T}&limit=1000&offset=${o}`)).json()
  if (!Array.isArray(page) || !page.length) break
  items.push(...page)
  if (page.length < 1000) break
}
console.log(`comments fetched: ${items.length}`)

const byInfluencer = { pixels100: [], yazxan: [], farhaahmd: [], hazansasou: [], basharkk: [] }
for (const c of items) {
  if (!(c.text || "").trim()) continue
  const sc = (c.postUrl || "").match(/\/(?:p|reel)\/([A-Za-z0-9\-_]+)/)?.[1]
  const inf = POST_MAP[sc]
  if (!inf) continue
  // Skip the influencer's own replies — not audience sentiment.
  if (HANDLE_OWNER[(c.ownerUsername || "").toLowerCase()]) continue
  byInfluencer[inf].push({
    postUrl: c.postUrl,
    text: c.text,
    likes: c.likesCount || 0,
    ownerUsername: c.ownerUsername,
    timestamp: c.timestamp,
    id: c.id,
  })
}
for (const [inf, arr] of Object.entries(byInfluencer)) {
  writeFileSync(`data/influencer-${inf}.json`, JSON.stringify(arr))
  console.log(`${inf}: ${arr.length} comments -> data/influencer-${inf}.json`)
}

// Engagement rate from the tracked posts' likes+comments (from the post scrape datasets)
const postItems = []
for (const ds of ["rTPepmgefkYt7uwHd", "neLlHpofZuetZwez0"]) {
  for (let o = 0; ; o += 1000) {
    const page = await (await fetch(`https://api.apify.com/v2/datasets/${ds}/items?token=${T}&limit=1000&offset=${o}`)).json()
    if (!Array.isArray(page) || !page.length) break
    postItems.push(...page)
    if (page.length < 1000) break
  }
}
const eng = {}
const seen = new Set()
for (const p of postItems) {
  const sc = (p.url || "").match(/\/(?:p|reel)\/([A-Za-z0-9\-_]+)/)?.[1]
  const inf = POST_MAP[sc]
  if (!inf || seen.has(sc)) continue
  seen.add(sc)
  if (!eng[inf]) eng[inf] = []
  eng[inf].push((p.likesCount > 0 ? p.likesCount : 0) + (p.commentsCount || 0))
}
console.log("\nengagement rates (avg S26-post engagement / followers):")
for (const [inf, vals] of Object.entries(eng)) {
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
  const er = (avg / FOLLOWERS[inf]) * 100
  console.log(`${inf}: posts=${vals.length} avgEng=${Math.round(avg)} ER=${er.toFixed(1)}%`)
}

// remove the previous lifestyle data files
for (const old of ["osamaqaq", "husamkwaik", "leenjadaan", "danaindxb", "yourkuyamico"]) {
  const f = `data/influencer-${old}.json`
  if (existsSync(f)) { unlinkSync(f); console.log(`removed ${f}`) }
}
