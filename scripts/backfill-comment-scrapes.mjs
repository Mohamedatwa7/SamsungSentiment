// One-off: scrape FB comments + X replies for posts from the last 90 days.
// The daily sync's ingestion (last-7-runs window) picks these datasets up.
// Run: node --env-file=.env.local scripts/backfill-comment-scrapes.mjs
const T = process.env.APIFY_API_TOKEN
const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}` }

const since = new Date(Date.now() - 90 * 86400000).toISOString()

async function postUrls(platform) {
  const urls = new Set()
  for (let f = 0; ; f += 1000) {
    const rows = await (await fetch(
      `${U}/rest/v1/social_posts?select=post_url&platform=eq.${platform}&published_at=gte.${since}&order=id.asc`,
      { headers: { ...H, Range: `${f}-${f + 999}` } },
    )).json()
    if (!Array.isArray(rows) || !rows.length) break
    for (const r of rows) if (r.post_url) urls.add(String(r.post_url).replace(/\/+$/, ""))
    if (rows.length < 1000) break
  }
  return [...urls]
}

const fbUrls = await postUrls("facebook")
const xUrls = await postUrls("twitter")
console.log(`fb posts last 90d: ${fbUrls.length}, x posts last 90d: ${xUrls.length}`)

const fbRes = await (await fetch(
  `https://api.apify.com/v2/acts/us5srxAYnsrkgUv2v/runs?token=${T}&maxTotalChargeUsd=15`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startUrls: fbUrls.map((url) => ({ url })),
      resultsLimit: 500,
      includeNestedComments: false,
    }),
  },
)).json()
console.log("fb-comments backfill run:", fbRes.data?.id || JSON.stringify(fbRes).slice(0, 200))

const xRes = await (await fetch(
  `https://api.apify.com/v2/acts/qhybbvlFivx7AP0Oh/runs?token=${T}&maxTotalChargeUsd=10`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postUrls: xUrls, resultsLimit: 300 }),
  },
)).json()
console.log("x-replies backfill run:", xRes.data?.id || JSON.stringify(xRes).slice(0, 200))
