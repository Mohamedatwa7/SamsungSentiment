// Fetch each actor's input schema (from its default build) + current run input.
// Run: node --env-file=.env.local scripts/get-input-schemas.mjs
const T = process.env.APIFY_API_TOKEN

const ACTORS = {
  twitter: "Fo9GoU5wC270BgcBr",
  facebook: "KoJrdxJCTtpon81KY",
  tiktokComments: "Zk4NL09KuDccV11Z4",
  tiktokPosts: "GdWCkxBtKWOsKjdch",
  instagramComments: "dIKFJ95TN8YclK2no",
  instagramPosts: "nH2AHrwxeTRJoN5hX",
}

for (const [name, id] of Object.entries(ACTORS)) {
  const act = (await (await fetch(`https://api.apify.com/v2/acts/${id}?token=${T}`)).json()).data
  console.log(`\n########## ${name}: ${act?.username}/${act?.name} ##########`)

  // current input of latest run
  const runs = await (await fetch(`https://api.apify.com/v2/acts/${id}/runs?token=${T}&limit=1&desc=true&status=SUCCEEDED`)).json()
  const r = runs.data?.items?.[0]
  if (r) {
    const inp = await (await fetch(`https://api.apify.com/v2/key-value-stores/${r.defaultKeyValueStoreId}/records/INPUT?token=${T}`)).json().catch(() => null)
    console.log("CURRENT INPUT:", JSON.stringify(inp))
  }

  // input schema from default build
  const tag = act?.defaultRunOptions?.build || "latest"
  const buildId = act?.taggedBuilds?.[tag]?.buildId
  if (!buildId) { console.log("no tagged build found"); continue }
  const build = (await (await fetch(`https://api.apify.com/v2/actor-builds/${buildId}?token=${T}`)).json()).data
  let schema = build?.inputSchema
  if (typeof schema === "string") { try { schema = JSON.parse(schema) } catch {} }
  if (!schema?.properties) { console.log("no input schema on build"); continue }
  console.log("INPUT SCHEMA FIELDS:")
  for (const [field, def] of Object.entries(schema.properties)) {
    const desc = (def.description || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").slice(0, 180)
    console.log(`  ${field} (${def.type}${def.default !== undefined ? `, default=${JSON.stringify(def.default)}` : ""}): ${desc}`)
  }
}
