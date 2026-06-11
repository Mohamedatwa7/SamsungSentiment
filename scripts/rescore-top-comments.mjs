// Flag the N most-liked comments for sentiment re-analysis (after a prompt
// upgrade). The standard analyze pipeline then re-scores them.
// Run: node --env-file=.env.local scripts/rescore-top-comments.mjs [N]
const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" }
const N = parseInt(process.argv[2] || "800", 10)

const rows = await (await fetch(
  `${U}/rest/v1/social_comments?select=id,text&order=likes_count.desc&limit=${N * 2}`,
  { headers: { ...H, Range: `0-${N * 2 - 1}` } },
)).json()
const targets = rows.filter((r) => (r.text || "").trim().length > 2).slice(0, N)
console.log(`flagging ${targets.length} comments for re-analysis`)

let n = 0
for (let i = 0; i < targets.length; i += 100) {
  const ids = targets.slice(i, i + 100).map((r) => `"${r.id}"`).join(",")
  const res = await fetch(`${U}/rest/v1/social_comments?id=in.(${ids})`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=minimal" },
    body: JSON.stringify({ sentiment_analyzed_at: null }),
  })
  if (res.ok) n += Math.min(100, targets.length - i)
  else console.error("patch failed:", res.status, (await res.text()).slice(0, 150))
}
console.log(`marked: ${n}`)
