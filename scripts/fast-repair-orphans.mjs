// Batched version of the orphan repair: instead of one PATCH per row, read a
// page and upsert it back (merge-duplicates on platform,external_id) with the
// corrected external_post_id. Only payload columns are updated, so sentiment
// and everything else is untouched.
// Run: node --env-file=.env.local scripts/fast-repair-orphans.mjs
const U = process.env.SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" }

let repaired = 0
for (const prefix of ["tt-", "fb-", "ig-"]) {
  while (true) {
    const res = await fetch(
      `${U}/rest/v1/social_comments?select=platform,external_id,external_post_id,text,raw_post_ref:raw_data->>postId&external_post_id=like.${prefix}*&limit=500`,
      { headers: H },
    )
    const page = await res.json()
    if (!Array.isArray(page) || page.length === 0) break

    const rows = []
    for (const c of page) {
      const ref = String(c.raw_post_ref || "")
      if (!ref || ref === c.external_post_id) continue
      rows.push({
        platform: c.platform,
        external_id: c.external_id,
        external_post_id: ref,
        text: c.text || "",
      })
    }
    if (rows.length === 0) break // nothing repairable left under this prefix

    const up = await fetch(`${U}/rest/v1/social_comments?on_conflict=platform,external_id`, {
      method: "POST",
      headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    })
    if (!up.ok) {
      console.error(`upsert failed: ${up.status} ${(await up.text()).slice(0, 200)}`)
      process.exit(1)
    }
    repaired += rows.length
    console.log(`${prefix}: repaired ${rows.length} (total ${repaired})`)
  }
}
console.log(`DONE — repaired ${repaired}`)
