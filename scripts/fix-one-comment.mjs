// Targeted sentiment correction for a single mislabeled comment text.
const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" }

const needle = "using AI in big 26 for content"
const sel = await fetch(
  `${U}/rest/v1/social_comments?select=id,text,sentiment&text=ilike.${encodeURIComponent(`*${needle}*`)}`,
  { headers: H },
)
const rows = await sel.json()
if (!Array.isArray(rows)) { console.error("select failed:", JSON.stringify(rows).slice(0, 200)); process.exit(1) }
console.log(`matched ${rows.length} rows`)
for (const r of rows) {
  const res = await fetch(`${U}/rest/v1/social_comments?id=eq.${r.id}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=minimal" },
    body: JSON.stringify({ sentiment: "negative", sentiment_score: 30, flags: ["ai_content_backlash"] }),
  })
  console.log(`${r.id}: ${res.ok ? "fixed" : "failed " + res.status + " " + (await res.text()).slice(0, 200)} | was ${r.sentiment} | ${(r.text || "").slice(0, 50)}`)
}
