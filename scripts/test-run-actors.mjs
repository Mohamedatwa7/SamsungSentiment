// Start all six actors with the inputs now stored in the schedule, then poll
// until they finish and report item counts + date coverage.
// Run: node --env-file=.env.local scripts/test-run-actors.mjs
const T = process.env.APIFY_API_TOKEN
const SCHEDULE_ID = "AzNWcc9ZQxFcie6el"

const NAMES = {
  Fo9GoU5wC270BgcBr: "x-posts",
  GdWCkxBtKWOsKjdch: "tiktok-posts",
  KoJrdxJCTtpon81KY: "facebook-posts",
  Zk4NL09KuDccV11Z4: "tiktok-comments",
  dIKFJ95TN8YclK2no: "instagram-comments",
  nH2AHrwxeTRJoN5hX: "instagram-posts",
}

const sched = (await (await fetch(`https://api.apify.com/v2/schedules/${SCHEDULE_ID}?token=${T}`)).json()).data

const started = []
for (const a of sched.actions) {
  const res = await fetch(`https://api.apify.com/v2/acts/${a.actorId}/runs?token=${T}`, {
    method: "POST",
    headers: { "Content-Type": a.runInput.contentType },
    body: a.runInput.body,
  })
  const out = await res.json()
  if (!res.ok) {
    console.log(`${NAMES[a.actorId]}: START FAILED ${res.status} ${JSON.stringify(out).slice(0, 200)}`)
    continue
  }
  started.push({ name: NAMES[a.actorId], runId: out.data.id, datasetId: out.data.defaultDatasetId })
  console.log(`${NAMES[a.actorId]}: started run ${out.data.id}`)
}

function itemDate(it) {
  const cands = [it.createdAt, it.created_at, it.timestamp, it.time, it.date,
    it.commentTimestamp, it.createTime, it.createTimeISO, it.publishedAt, it.postInfo?.timestamp]
  for (const c of cands) {
    if (c == null) continue
    const d = typeof c === "number" ? new Date(c < 1e12 ? c * 1000 : c) : new Date(c)
    if (!isNaN(d)) return d
  }
  return null
}

// poll until all finish (max ~8 min)
const pending = new Set(started.map((s) => s.runId))
const deadline = Date.now() + 8 * 60 * 1000
while (pending.size && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 15000))
  for (const s of started) {
    if (!pending.has(s.runId)) continue
    const run = (await (await fetch(`https://api.apify.com/v2/actor-runs/${s.runId}?token=${T}`)).json()).data
    if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) {
      pending.delete(s.runId)
      s.status = run.status
      console.log(`${s.name}: ${run.status}`)
    }
  }
}

console.log("\n=== RESULTS ===")
for (const s of started) {
  if (s.status !== "SUCCEEDED") { console.log(`\n${s.name}: ${s.status || "STILL RUNNING"}`); continue }
  const items = await (await fetch(`https://api.apify.com/v2/datasets/${s.datasetId}/items?token=${T}&limit=1000`)).json()
  const byDay = {}
  for (const it of items) {
    const d = itemDate(it)
    const day = d ? d.toISOString().slice(0, 10) : "no-date"
    byDay[day] = (byDay[day] || 0) + 1
  }
  const days = Object.entries(byDay).sort()
  console.log(`\n${s.name}: ${items.length} items`)
  for (const [day, n] of days.slice(-8)) console.log(`  ${day}: ${n}`)
  if (days.length > 8) console.log(`  (+${days.length - 8} earlier days)`)
}
