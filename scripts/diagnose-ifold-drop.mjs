// Why has Competition Watch (ifold_) ingest volume dropped? Inspect the
// last ~10 days of runs per ifold actor + daily DB row counts.
// Run: node scripts/diagnose-ifold-drop.mjs
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const PROJECT_ID = "prj_teP3ZI0Odxpfem8N7ANKVkQtqctX"
const TEAM_ID = "team_EklPmWoEmVVJEAJVBMJttdEA"
const vercelAuth = JSON.parse(
  readFileSync(join(homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json"), "utf8"),
)
async function vercelApi(path) {
  const res = await fetch(`https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${vercelAuth.token}` },
  })
  if (!res.ok) throw new Error(`Vercel API ${path}: ${res.status}`)
  return res.json()
}
const envList = await vercelApi(`/v9/projects/${PROJECT_ID}/env`)
async function envVal(key) {
  const v = envList.envs.find((e) => e.key === key)
  if (!v) return null
  return (await vercelApi(`/v1/projects/${PROJECT_ID}/env/${v.id}`)).value
}
const APIFY = await envVal("APIFY_API_TOKEN")
const SUPA_URL = await envVal("SUPABASE_URL") || await envVal("NEXT_PUBLIC_SUPABASE_URL")
const SUPA_KEY = await envVal("SUPABASE_SERVICE_ROLE_KEY")
console.log(`tokens: apify=${!!APIFY} supaUrl=${!!SUPA_URL} supaKey=${!!SUPA_KEY}`)

// ---- 1. Apify run history per ifold actor ----
const ACTORS = {
  instagramHashtag: "reGe1ST3OBgYZSsZJ",
  instagramComments: "SbK00X0JYCPblD2wp",
  instagramProfiles: "dSCLg0C3YEZ83HzYX",
  tiktokProfiles: "0FXVyOXXEmdGcV88a",
  tiktokHashtag: "f1ZeP0K58iwlqG2pY",
  tiktokSearch: "GdWCkxBtKWOsKjdch",
  tiktokComments: "BDec00yAmCm1QbMEI",
  youtubeSearch: "h7sDV53CddomktSi5",
  youtubeComments: "p7UMdpQnjKmmpR21D",
  twitterSearch: "apidojo~tweet-scraper",
}
async function apify(path) {
  const res = await fetch(`https://api.apify.com/v2${path}`, { headers: { Authorization: `Bearer ${APIFY}` } })
  if (!res.ok) return { error: `${res.status}` }
  return res.json()
}
for (const [name, id] of Object.entries(ACTORS)) {
  const runs = await apify(`/acts/${id}/runs?limit=14&desc=true`)
  if (runs.error) { console.log(`\n=== ${name}: runs fetch error ${runs.error}`); continue }
  console.log(`\n=== ${name} (${id})`)
  for (const r of runs.data.items) {
    const ds = await apify(`/datasets/${r.defaultDatasetId}`)
    const n = ds.data?.cleanItemCount ?? ds.data?.itemCount ?? "?"
    const usd = r.usageTotalUsd?.toFixed?.(2) ?? "?"
    console.log(`  ${r.startedAt}  ${String(r.status).padEnd(11)} items=${String(n).padEnd(5)} $${usd}`)
  }
}

// ---- 2. Daily DB counts for ifold_ rows ----
async function supa(pathAndQuery, headers = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, ...headers },
  })
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`)
  return { json: await res.json(), range: res.headers.get("content-range") }
}
async function countWhere(table, filters) {
  const { range } = await supa(`${table}?select=external_id&${filters}&limit=1`, { Prefer: "count=exact" })
  return Number(range?.split("/")[1] ?? -1)
}
const since = new Date("2026-09-02T00:00:00Z")
console.log("\n=== daily ifold_ rows (by published_at / by scraped_at) ===")
console.log("day        | posts pub | posts scr | comments pub | comments scr")
for (let d = new Date(since); d.getTime() < Date.now(); d.setUTCDate(d.getUTCDate() + 1)) {
  const day = d.toISOString().slice(0, 10)
  const next = new Date(d.getTime() + 86400000).toISOString().slice(0, 10)
  const [pp, ps, cp, cs] = await Promise.all([
    countWhere("social_posts", `external_id=like.ifold_*&published_at=gte.${day}&published_at=lt.${next}`),
    countWhere("social_posts", `external_id=like.ifold_*&scraped_at=gte.${day}&scraped_at=lt.${next}`),
    countWhere("social_comments", `external_id=like.ifold_*&published_at=gte.${day}&published_at=lt.${next}`),
    countWhere("social_comments", `external_id=like.ifold_*&scraped_at=gte.${day}&scraped_at=lt.${next}`),
  ])
  console.log(`${day} | ${String(pp).padStart(9)} | ${String(ps).padStart(9)} | ${String(cp).padStart(12)} | ${String(cs).padStart(12)}`)
}
