// Update actor inputs in Apify schedule "my-schedule-5" for prev-day coverage.
// Run: node --env-file=.env.local scripts/update-schedule-inputs.mjs
const T = process.env.APIFY_API_TOKEN
const SCHEDULE_ID = "AzNWcc9ZQxFcie6el"

const NEW_INPUTS = {
  // X posts — no date filter on this actor; wider window + skip pinned
  Fo9GoU5wC270BgcBr: {
    profileUrls: ["https://x.com/samsunggulf"],
    resultsLimit: 15,
    skipPinnedPosts: true,
  },
  // TikTok posts — last 2 days, no pinned, lean input (search-only fields removed)
  GdWCkxBtKWOsKjdch: {
    profiles: ["samsunggulf"],
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
    excludePinnedPosts: true,
    oldestPostDateUnified: "2",
    resultsPerPage: 15,
  },
  // Facebook posts — rolling 2-day window instead of static 2025-05-01
  KoJrdxJCTtpon81KY: {
    startUrls: [{ url: "https://www.facebook.com/SamsungGulf/" }],
    onlyPostsNewerThan: "2 days",
    resultsLimit: 20,
    captionText: false,
  },
  // TikTok comments — unchanged behavior, explicit cap
  Zk4NL09KuDccV11Z4: {
    profileUrls: ["https://www.tiktok.com/@samsunggulf"],
    maxCommentsPerVideo: 500,
    includeReplies: false,
  },
  // Instagram comments — cover 12 most recent posts instead of 5
  dIKFJ95TN8YclK2no: {
    username: ["samsunggulf"],
    resultsLimitPosts: 12,
    resultsLimitComments: 500,
  },
  // Instagram posts — rolling 2-day window, skip pinned
  nH2AHrwxeTRJoN5hX: {
    username: ["samsunggulf"],
    onlyPostsNewerThan: "2 days",
    resultsLimit: 20,
    skipPinnedPosts: true,
    dataDetailLevel: "detailedData",
  },
}

const sched = (await (await fetch(`https://api.apify.com/v2/schedules/${SCHEDULE_ID}?token=${T}`)).json()).data
const actions = sched.actions.map((a) => {
  const input = NEW_INPUTS[a.actorId]
  if (!input) {
    console.log(`!! no new input defined for actor ${a.actorId} — leaving as is`)
    return a
  }
  return {
    ...a,
    runInput: {
      body: JSON.stringify(input),
      contentType: "application/json; charset=utf-8",
    },
  }
})

const res = await fetch(`https://api.apify.com/v2/schedules/${SCHEDULE_ID}?token=${T}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ actions }),
})
const out = await res.json()
if (!res.ok) {
  console.error("UPDATE FAILED:", res.status, JSON.stringify(out).slice(0, 500))
  process.exit(1)
}

console.log("Schedule updated. Verifying stored inputs:\n")
for (const a of out.data.actions) {
  console.log(`actor ${a.actorId}:`)
  console.log(`  ${a.runInput.body}`)
  console.log(`  runOptions: ${JSON.stringify(a.runOptions)}`)
}
console.log(`\nnextRunAt: ${out.data.nextRunAt}  enabled: ${out.data.isEnabled}`)
