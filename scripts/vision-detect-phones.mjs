// Vision pass: run S26-era (Feb 2026+) reel/post thumbnails from the four
// lifestyle accounts through gpt-4o-mini to find videos where a smartphone is
// being showcased — captions carry no Samsung signal, the product only
// appears IN the video.
// Run: node --env-file=.env.local scripts/vision-detect-phones.mjs
const T = process.env.APIFY_API_TOKEN
const OPENAI = process.env.OPENAI_API_KEY
const HANDLES = new Set(["husamkwaik", "leenjadaan", "danaindxb", "yourkuyamico"])

const items = []
for (const ds of ["TvDlKYa94QWjbM1w3", "bx5VrQrbiqlYX8U7c", "SsMAUaTaII2fOsUPU"]) {
  for (let o = 0; ; o += 1000) {
    const page = await (await fetch(`https://api.apify.com/v2/datasets/${ds}/items?token=${T}&limit=1000&offset=${o}`)).json()
    if (!Array.isArray(page) || !page.length) break
    items.push(...page)
    if (page.length < 1000) break
  }
}

const seen = new Set()
const candidates = items.filter((p) => {
  const u = (p.ownerUsername || "").toLowerCase()
  if (!HANDLES.has(u)) return false
  if ((p.timestamp || "") < "2026-02-01") return false
  if (!p.displayUrl) return false
  if (seen.has(p.url)) return false
  seen.add(p.url)
  return true
})
console.log(`thumbnails to scan: ${candidates.length}`)

async function classify(p) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "This is a video thumbnail from a lifestyle influencer. Answer in strict JSON: " +
                '{"phone_showcased": true/false, "samsung_likely": true/false, "detail": "<10 words>"} ' +
                "phone_showcased = a smartphone is visibly held up / presented / unboxed as the subject " +
                "(not just someone casually holding a phone). samsung_likely = the device or scene suggests " +
                "a Samsung Galaxy device (camera layout, packaging, S-Pen, foldable, Samsung logo/colors).",
            },
            { type: "image_url", image_url: { url: p.displayUrl, detail: "low" } },
          ],
        },
      ],
    }),
  })
  const out = await res.json()
  const txt = out.choices?.[0]?.message?.content || "{}"
  try {
    return JSON.parse(txt.replace(/```json|```/g, "").trim())
  } catch {
    return { phone_showcased: false, samsung_likely: false, detail: "parse-error" }
  }
}

const hits = []
let done = 0
const queue = [...candidates]
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const p = queue.shift()
      const r = await classify(p)
      done++
      if (done % 50 === 0) console.log(`scanned ${done}/${candidates.length}`)
      if (r.phone_showcased) {
        hits.push({ p, r })
        console.log(
          `HIT ${p.ownerUsername} ${(p.timestamp || "").slice(0, 10)} samsung_likely=${r.samsung_likely} | ${r.detail} | ${p.url}`,
        )
      }
    }
  }),
)
console.log(`\nphone-showcase candidates: ${hits.length} of ${candidates.length}`)
