// Ingest ALL runs of the two new comment actors (FB comments, X replies) —
// used for the 90-day backfill where the run count exceeds the daily sync's
// run window. Batched upserts; brand-authored comments skipped.
// Run: node --env-file=.env.local scripts/ingest-comment-backfill.mjs
const T = process.env.APIFY_API_TOKEN
const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" }

async function allRunItems(actorId) {
  const runs = await (await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${T}&limit=100&status=SUCCEEDED`)).json()
  const items = []
  for (const r of runs.data?.items || []) {
    for (let o = 0; ; o += 1000) {
      const page = await (await fetch(`https://api.apify.com/v2/datasets/${r.defaultDatasetId}/items?token=${T}&limit=1000&offset=${o}`)).json()
      if (!Array.isArray(page) || !page.length) break
      items.push(...page)
      if (page.length < 1000) break
    }
  }
  return items
}

async function upsert(rows) {
  let ok = 0
  for (let i = 0; i < rows.length; i += 100) {
    const res = await fetch(`${U}/rest/v1/social_comments?on_conflict=platform,external_id`, {
      method: "POST",
      headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 100)),
    })
    if (!res.ok) console.error(`batch ${i}: ${res.status} ${(await res.text()).slice(0, 150)}`)
    else ok += Math.min(100, rows.length - i)
  }
  return ok
}

const now = new Date().toISOString()

// FB comments
const fbItems = await allRunItems("us5srxAYnsrkgUv2v")
const fbMap = new Map()
for (const c of fbItems) {
  if (c?.error || !c?.commentId) continue
  if ((c.profileName || "").trim().toLowerCase() === "samsung gulf") continue
  const parentUrl = String(c.facebookUrl || c.inputUrl || "")
  fbMap.set(String(c.commentId), {
    platform: "facebook",
    external_id: String(c.commentId),
    external_post_id: parentUrl.match(/\/(\d{10,})/)?.[1] || parentUrl || "unknown",
    text: c.text || "",
    author_username: c.profileName || "Facebook User",
    likes_count: c.likesCount || 0,
    published_at: c.date ? new Date(c.date).toISOString() : now,
    scraped_at: now,
    raw_data: c,
  })
}
console.log(`fb comments: ${fbItems.length} items -> ${fbMap.size} unique, upserted ${await upsert([...fbMap.values()])}`)

// X replies — apidojo/tweet-scraper (conversationIds mode)
const xItems = await allRunItems("61RPP7dywgiy0JPD0")
const xMap = new Map()
for (const r of xItems) {
  if (!r?.id || !r?.isReply) continue
  if ((r.author?.userName || "").toLowerCase() === "samsunggulf") continue
  const published = r.createdAt ? new Date(r.createdAt) : null
  xMap.set(String(r.id), {
    platform: "twitter",
    external_id: String(r.id),
    external_post_id: String(r.conversationId || r.inReplyToId || "unknown"),
    text: r.text || r.fullText || "",
    author_username: r.author?.userName || "unknown",
    author_display_name: r.author?.name,
    likes_count: r.likeCount || 0,
    replies_count: r.replyCount || 0,
    published_at: published && !isNaN(published.getTime()) ? published.toISOString() : now,
    scraped_at: now,
    raw_data: r,
  })
}
console.log(`x replies: ${xItems.length} items -> ${xMap.size} unique, upserted ${await upsert([...xMap.values()])}`)
