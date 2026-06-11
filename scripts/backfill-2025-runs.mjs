// One-off historical scrapes: posts Jan 2025 → now for IG/FB/TikTok (real
// dates + engagement), X posts (max the actor allows), deeper IG comments.
// Charge caps on everything. Run: node --env-file=.env.local scripts/backfill-2025-runs.mjs
const T = process.env.APIFY_API_TOKEN

const RUNS = [
  {
    name: "ig-posts-2025",
    actorId: "nH2AHrwxeTRJoN5hX",
    cap: 15,
    input: {
      username: ["samsunggulf"],
      onlyPostsNewerThan: "2025-01-01",
      resultsLimit: 1500,
      skipPinnedPosts: false,
      dataDetailLevel: "detailedData",
    },
  },
  {
    name: "fb-posts-2025",
    actorId: "KoJrdxJCTtpon81KY",
    cap: 15,
    input: {
      startUrls: [{ url: "https://www.facebook.com/SamsungGulf/" }],
      onlyPostsNewerThan: "2025-01-01",
      resultsLimit: 1500,
      captionText: false,
    },
  },
  {
    name: "tiktok-posts-2025",
    actorId: "GdWCkxBtKWOsKjdch",
    cap: 15,
    input: {
      profiles: ["samsunggulf"],
      profileScrapeSections: ["videos"],
      profileSorting: "latest",
      excludePinnedPosts: false,
      oldestPostDateUnified: "2025-01-01",
      resultsPerPage: 800,
    },
  },
  {
    name: "x-posts-max",
    actorId: "Fo9GoU5wC270BgcBr",
    cap: 10,
    input: {
      profileUrls: ["https://x.com/samsunggulf"],
      resultsLimit: 200, // actor max
      skipPinnedPosts: false,
    },
  },
  {
    name: "ig-comments-deep",
    actorId: "dIKFJ95TN8YclK2no",
    cap: 20,
    input: {
      username: ["samsunggulf"],
      resultsLimitPosts: 150,
      resultsLimitComments: 300,
    },
  },
]

for (const r of RUNS) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${r.actorId}/runs?token=${T}&maxTotalChargeUsd=${r.cap}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r.input) },
  )
  const out = await res.json()
  if (!res.ok) {
    console.log(`${r.name}: FAILED ${res.status} ${JSON.stringify(out).slice(0, 200)}`)
  } else {
    console.log(`${r.name}: run ${out.data.id} dataset ${out.data.defaultDatasetId}`)
  }
}
