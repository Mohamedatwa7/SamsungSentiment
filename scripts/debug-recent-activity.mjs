// Replicates last-week-posts.tsx logic against the live API to debug why a
// platform tab shows no posts. Run: node scripts/debug-recent-activity.mjs <base>
const base = process.argv[2] || "https://v0-samsung-ai-platform.vercel.app"
const { posts, comments } = await (await fetch(`${base}/api/comments`)).json()

const byUrl = new Map()
for (const c of comments) {
  if (!c.postUrl) continue
  if (!byUrl.has(c.postUrl)) byUrl.set(c.postUrl, [])
  byUrl.get(c.postUrl).push(c)
}

// component logic: posts with >=1 comment, latestCommentDate computed
const withSentiment = posts
  .map((p) => {
    const pc = byUrl.get(p.url) || []
    let latest = p.timestamp
    let lt = 0
    for (const c of pc) {
      const t = new Date(c.createdAt).getTime()
      if (!Number.isNaN(t) && t > lt) { lt = t; latest = c.createdAt }
    }
    return { platform: p.platform, total: pc.length, latest }
  })
  .filter((p) => p.total > 0)

let maxDate = new Date(0)
for (const p of withSentiment) {
  const d = new Date(p.latest)
  if (d > maxDate) maxDate = d
}
console.log("anchor (latest comment):", maxDate.toISOString())

for (const days of [7, 30, 90]) {
  const cutoff = maxDate.getTime() - days * 86400000
  const counts = {}
  for (const p of withSentiment) {
    const t = new Date(p.latest).getTime()
    if (t >= cutoff) counts[p.platform] = (counts[p.platform] || 0) + 1
  }
  console.log(`last ${days}d:`, JSON.stringify(counts))
}

// twitter-specific: how many twitter comments resolve, recent ones
const tw = comments.filter((c) => c.platform === "twitter")
console.log(`twitter comments: ${tw.length}, with postUrl: ${tw.filter((c) => c.postUrl).length}`)
const d30 = Date.now() - 30 * 86400000
console.log("twitter comments newer than 30d:", tw.filter((c) => new Date(c.createdAt).getTime() >= d30).length)
