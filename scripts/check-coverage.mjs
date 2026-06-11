// What date range does each actor's latest run actually cover?
// Run: node --env-file=.env.local scripts/check-coverage.mjs
const T = process.env.APIFY_API_TOKEN

const ACTORS = {
  "twitter (posts)": "Fo9GoU5wC270BgcBr",
  "facebook (posts)": "KoJrdxJCTtpon81KY",
  "tiktok (comments)": "Zk4NL09KuDccV11Z4",
  "tiktok (posts, UNSYNCED)": "GdWCkxBtKWOsKjdch",
  "instagram (comments)": "dIKFJ95TN8YclK2no",
  "instagram (posts)": "nH2AHrwxeTRJoN5hX",
}

// Pull every date-looking field out of an item.
function itemDate(it) {
  const cands = [
    it.createdAt, it.created_at, it.timestamp, it.time, it.date,
    it.commentTimestamp, it.createTime, it.createTimeISO, it.publishedAt,
    it.postInfo?.timestamp,
  ]
  for (const c of cands) {
    if (c == null) continue
    const d = typeof c === "number" ? new Date(c < 1e12 ? c * 1000 : c) : new Date(c)
    if (!isNaN(d)) return d
  }
  return null
}

for (const [name, id] of Object.entries(ACTORS)) {
  const runs = await (await fetch(`https://api.apify.com/v2/acts/${id}/runs?token=${T}&limit=1&desc=true&status=SUCCEEDED`)).json()
  const r = runs.data?.items?.[0]
  if (!r) { console.log(`\n${name}: NO RUNS`); continue }
  const items = await (await fetch(`https://api.apify.com/v2/datasets/${r.defaultDatasetId}/items?token=${T}&limit=1000`)).json()
  const dates = items.map(itemDate).filter(Boolean).sort((a, b) => a - b)
  console.log(`\n${name} — run ${r.startedAt}, ${items.length} items`)
  if (!dates.length) {
    console.log(`  no parseable dates; first item keys: ${Object.keys(items[0] || {}).join(", ")}`)
    continue
  }
  // bucket by UTC day
  const byDay = {}
  for (const d of dates) {
    const day = d.toISOString().slice(0, 10)
    byDay[day] = (byDay[day] || 0) + 1
  }
  const days = Object.entries(byDay).sort()
  const shown = days.slice(-12)
  if (days.length > 12) console.log(`  (${days.length - 12} earlier days omitted, oldest ${days[0][0]})`)
  for (const [day, n] of shown) console.log(`  ${day}: ${n} item(s)`)
}
