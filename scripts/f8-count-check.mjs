// Replicates the F8 Launch Analysis corpus count against the LIVE APIs to
// see which data slice accounts for the number the dashboard shows.
const BASE = "https://samsungtrack.com"

const LAUNCH_DATE = new Date("2026-07-22T00:00:00+04:00")
const DEVICES = [
  { key: "fold8ultra", pattern: /(?:z\s*)?fold\s*8\s*ultra|fold8ultra|فولد\s*8\s*(?:الترا|ألترا)/i, genericPattern: /fold\s*ultra|فولد\s*(?:الترا|ألترا)/i },
  { key: "fold8", pattern: /(?:z\s*)?fold\s*8|zfold8|فولد\s*8/i, genericPattern: /\bz?\s*fold\b|فولد/i },
  { key: "flip8", pattern: /(?:z\s*)?flip\s*8|zflip8|فليب\s*8|فلب\s*8/i, genericPattern: /\bz?\s*flip\b|فليب/i },
]
const CAMPAIGN_GENERIC = /galaxy\s*unpacked|galaxyunpacked|new\s*shape|newshape|\bff8\b/i

function matchDevice(text, sinceLaunch) {
  for (const d of DEVICES) if (d.pattern.test(text)) return d.key
  if (sinceLaunch) for (const d of DEVICES) if (d.key !== "fold8ultra" && d.genericPattern.test(text)) return d.key
  return null
}

async function getJson(path) {
  const res = await fetch(BASE + path + (path.includes("?") ? "&" : "?") + "cb=" + Math.random())
  if (!res.ok) throw new Error(path + " -> " + res.status)
  return res.json()
}

const [comments, unpacked, roster] = await Promise.all([
  getJson("/api/comments"),
  getJson("/api/unpacked"),
  getJson("/api/roster"),
])

// Influencer comments, deduped like mapInfluencerComments
const seen = new Set()
let influencer = 0
for (const payload of [unpacked, roster]) {
  for (const v of payload.videos || []) {
    for (const c of v.comments) {
      const rawId = c.id.replace(/^(unpacked_|roster_)/, "")
      if (seen.has(rawId)) continue
      seen.add(rawId)
      influencer++
    }
  }
}

// Brand corpus per the component logic
let brandCorpus = 0
for (const c of comments.comments || []) {
  const created = new Date(c.createdAt)
  const sinceLaunch = !isNaN(created.getTime()) && created >= LAUNCH_DATE
  const own = matchDevice(c.text || "", sinceLaunch)
  if (own) { brandCorpus++; continue }
  if (sinceLaunch && c.postCaption) {
    const viaPost = matchDevice(c.postCaption, true)
    if (viaPost) brandCorpus++
    else if (CAMPAIGN_GENERIC.test(c.postCaption)) brandCorpus++
  }
}

console.log("brand comments total:", (comments.comments || []).length)
console.log("brand F8 corpus:", brandCorpus)
console.log("influencer comments (deduped):", influencer)
console.log("expected Launch Comments (combined):", brandCorpus + influencer)
