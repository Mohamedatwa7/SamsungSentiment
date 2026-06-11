// Hit /api/comments like the dashboard does and verify the joins that feed
// "Recent Activity" (posts with comments per platform) and link integrity.
// Run: node scripts/verify-dashboard-data.mjs [baseUrl]  (default localhost:3000)
const base = process.argv[2] || "http://localhost:3000"
const res = await fetch(`${base}/api/comments`)
const { posts, comments, meta } = await res.json()

console.log(`posts: ${posts.length}  comments: ${comments.length}`)
console.log("meta:", JSON.stringify(meta))

const postYears = {}
for (const p of posts) {
  const y = (p.timestamp || "").slice(0, 4) || "?"
  postYears[`${p.platform} ${y}`] = (postYears[`${p.platform} ${y}`] || 0) + 1
}
console.log("\nposts by platform+year:")
for (const [k, v] of Object.entries(postYears).sort()) console.log(`  ${k}: ${v}`)

// Comment -> post resolution rate per platform (the Recent Activity join)
const stats = {}
for (const c of comments) {
  if (!stats[c.platform]) stats[c.platform] = { total: 0, withUrl: 0 }
  stats[c.platform].total++
  if (c.postUrl) stats[c.platform].withUrl++
}
console.log("\ncomment -> post URL resolution:")
for (const [p, s] of Object.entries(stats)) {
  console.log(`  ${p}: ${s.withUrl}/${s.total} (${Math.round((s.withUrl / s.total) * 100)}%)`)
}

// Recent Activity simulation: posts that have >=1 comment via URL join
const byUrl = new Map()
for (const c of comments) {
  if (c.postUrl) byUrl.set(c.postUrl, (byUrl.get(c.postUrl) || 0) + 1)
}
const withComments = { instagram: 0, tiktok: 0, facebook: 0, twitter: 0 }
for (const p of posts) {
  if (byUrl.has(p.url) && withComments[p.platform] !== undefined) withComments[p.platform]++
}
console.log("\nposts with comment activity (Recent Activity tabs):", JSON.stringify(withComments))

// Empty-feed check: posts with no caption AND no engagement
const empty = posts.filter((p) => !(p.caption || "").trim() && !p.likes && !p.views)
console.log(`\nposts with no caption and no engagement (hidden from feed): ${empty.length}`)
