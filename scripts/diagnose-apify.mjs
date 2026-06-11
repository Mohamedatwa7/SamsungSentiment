// Diagnostic: compare Apify actor runs/datasets against Supabase contents.
// Run: node --env-file=.env.local scripts/diagnose-apify.mjs
const TOKEN = process.env.APIFY_API_TOKEN

const ACTORS = {
  twitter: "Fo9GoU5wC270BgcBr",
  facebook: "KoJrdxJCTtpon81KY",
  tiktok: "Zk4NL09KuDccV11Z4",
  instagramComments: "dIKFJ95TN8YclK2no",
  instagram: "nH2AHrwxeTRJoN5hX",
}

async function api(path) {
  const res = await fetch(`https://api.apify.com/v2${path}${path.includes("?") ? "&" : "?"}token=${TOKEN}`)
  if (!res.ok) return { error: `${res.status} ${res.statusText}` }
  return res.json()
}

console.log("=== APIFY: last 5 runs per actor (any status) ===")
for (const [name, id] of Object.entries(ACTORS)) {
  const data = await api(`/acts/${id}/runs?limit=5&desc=true`)
  if (data.error) { console.log(`\n${name} (${id}): API ERROR ${data.error}`); continue }
  const actorInfo = await api(`/acts/${id}`)
  console.log(`\n${name} -> actor "${actorInfo.data?.name || "?"}" (${id})`)
  const runs = data.data?.items || []
  if (!runs.length) console.log("  NO RUNS FOUND")
  for (const r of runs) {
    const ds = await api(`/datasets/${r.defaultDatasetId}`)
    const clean = ds.data?.cleanItemCount ?? ds.data?.itemCount ?? "?"
    console.log(`  ${r.startedAt}  status=${r.status}  datasetItems=${clean}`)
  }
}

console.log("\n=== APIFY: schedule config ===")
const sched = await api(`/schedules/AzNWcc9ZQxFcie6el`)
if (sched.data) {
  console.log(`name="${sched.data.name}" cron="${sched.data.cronExpression}" enabled=${sched.data.isEnabled}`)
  for (const a of sched.data.actions || []) {
    console.log(`  action: type=${a.type} actorId=${a.actorId || a.actorTaskId}`)
  }
} else {
  console.log("schedule fetch failed:", JSON.stringify(sched).slice(0, 200))
}

console.log("\n=== SUPABASE: row counts by platform ===")
const SB_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
async function sbCount(table, filter = "") {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?select=*${filter}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: "count=exact", Range: "0-0" },
  })
  return res.headers.get("content-range")?.split("/")[1] ?? "?"
}
for (const platform of ["twitter", "instagram", "tiktok", "facebook"]) {
  const posts = await sbCount("social_posts", `&platform=eq.${platform}`)
  const comments = await sbCount("social_comments", `&platform=eq.${platform}`)
  console.log(`  ${platform}: posts=${posts} comments=${comments}`)
}

console.log("\n=== SUPABASE: last 10 sync log entries ===")
const logsRes = await fetch(`${SB_URL}/rest/v1/apify_sync_log?select=started_at,status,records_processed,records_inserted,completed_at&order=started_at.desc&limit=10`, {
  headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
})
const logs = await logsRes.json()
for (const l of Array.isArray(logs) ? logs : []) {
  console.log(`  ${l.started_at}  status=${l.status}  processed=${l.records_processed}  inserted=${l.records_inserted}  completed=${l.completed_at}`)
}
