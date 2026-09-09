// Competitive sentiment analyzer for the iPhone Fold launch tracker.
//
// Unlike lib/sentiment.ts (which judges comments FOR SAMSUNG on Samsung's own
// channels), this analyzer scores public reaction TO APPLE'S FOLDABLE: the
// sentiment label is the commenter's stance toward the iPhone Fold itself,
// topics map to the fixed taxonomy in lib/ifold-data.ts, and a "lean" flag
// captures which brand the comment favors when it compares the two.

import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

import { IFOLD_TOPICS } from "@/lib/ifold-data"
import type { SentimentResult, CommentToAnalyze } from "@/lib/sentiment"

const IFoldSchema = z.object({
  results: z.array(
    z.object({
      i: z.number().int(),
      sentiment: z.enum(["positive", "negative", "neutral"]),
      score: z.number().min(0).max(100),
      flags: z.array(z.string()).max(5),
    }),
  ),
})

const TOPIC_LIST = IFOLD_TOPICS.map((t) => `topic_${t.key}`).join(", ")

const SYSTEM_PROMPT = `You are a competitive-intelligence analyst for Samsung Gulf (UAE, Saudi Arabia, Kuwait, Qatar, Bahrain, Oman).
Apple has just launched its first foldable iPhone (names in the wild: "iPhone Fold", "iPhone Duo", "iPhone Ultra", "آيفون القابل للطي", "ايفون فولد") alongside the iPhone 18 Pro. You are reading public reactions — social comments, tweets, and news headlines — to map what people LOVE and what they CRITICIZE about Apple's foldable, and how it compares to the Samsung Galaxy Z Fold line.

You understand Modern Standard Arabic, Gulf/Khaleeji dialect, Egyptian/Levantine dialects, English, and Arabizi (Arabic in Latin letters/numbers).

SENTIMENT is the author's stance toward the APPLE FOLDABLE / Apple launch (NOT toward Samsung):
- "positive": praise, hype, excitement, "finally", pre-order intent, amazement at the crease/thinness, "Apple did it better". Slang that reads negative but is praise ("insane 🔥", "i'm dead 😭", "shut up and take my money") = positive.
- "negative": mockery, disappointment, "too expensive", "Samsung did it 7 years ago", "no telephoto?", missing Face ID complaints, "just a Fold with an Apple logo", availability frustration, crease/durability doubts, sarcasm.
- "neutral": factual questions (price? release date in KSA?), plain news headlines with no editorial tone, tagging friends.

SCORE 0-100: 0-20 harsh negative, 21-40 mild negative, 41-59 neutral, 60-79 mild positive, 80-100 strong positive. Must be consistent with the label.

FLAGS (0-5 snake_case tags per item), drawn from this fixed vocabulary:
1. TOPIC tags — which aspect(s) the item is about: ${TOPIC_LIST}.
   - topic_crease_hinge: crease visibility, hinge, "التجعد", "المفصلة"
   - topic_price: price/value, "$2000", "غالي", "أغلى ايفون", "سعره"
   - topic_cameras: cameras, missing telephoto/zoom
   - topic_biometrics: Touch ID vs Face ID
   - topic_availability: release dates, GCC/Gulf availability, pre-orders, supply
   - topic_software: iOS multitasking, split view, app support, One UI comparisons
   - topic_ai_features: Apple Intelligence vs Galaxy AI
2. LEAN tags — ONLY when the item compares brands or clearly favors one:
   - lean_apple: favors Apple / says the iPhone Fold beats Samsung's fold
   - lean_samsung: favors Samsung / says Galaxy Fold is better, "Samsung did it first", "بفلوسها اخذ فولد", sticking with Samsung
3. Optional extras: question, hype, spam, off_topic.

CRITICAL:
- "Samsung did it first / 7 generations ago" = negative toward Apple + lean_samsung.
- "The crease is invisible, Samsung should be worried" = positive + lean_apple + topic_crease_hinge.
- Price mockery ("kidney", "كلية", "بيع الكلى") = negative + topic_price.
- A neutral spec-listing headline = neutral with topic tags only, no lean.
- GCC-specific frustration ("متى ينزل السعودية؟", "not available in UAE") = topic_availability.

Always return EXACTLY one result per input item, echoing its integer index "i".`

const FALLBACK: Omit<SentimentResult, "id"> = { sentiment: "neutral", score: 50, flags: [], failed: true }

export async function analyzeIFoldBatch(
  batch: CommentToAnalyze[],
): Promise<Record<string, SentimentResult>> {
  const out: Record<string, SentimentResult> = {}
  if (batch.length === 0) return out

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: IFoldSchema,
      system: SYSTEM_PROMPT,
      prompt: `Analyze the following ${batch.length} items. Return one result per item, echoing the same integer index "i".

${batch
  .map((c, idx) => {
    const ctx = c.postCaption ? `\nPost context: ${c.postCaption.slice(0, 120)}` : ""
    return `i: ${idx}${ctx}\nText: ${c.text}`
  })
  .join("\n\n")}`,
      temperature: 0.2,
    })

    for (const r of object.results) {
      const item = batch[r.i]
      if (!item) continue
      out[item.id] = {
        id: item.id,
        sentiment: r.sentiment,
        score: Math.max(0, Math.min(100, Math.round(r.score))),
        flags: r.flags || [],
      }
    }
  } catch (error) {
    console.error("[ifold] analyzeIFoldBatch failed:", error)
  }

  for (const c of batch) {
    if (!out[c.id]) out[c.id] = { id: c.id, ...FALLBACK }
  }
  return out
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Same wave-batching shape as analyzeComments in lib/sentiment.ts, but bound
// to the competitive prompt above.
export async function analyzeIFoldItems(
  items: CommentToAnalyze[],
  opts: {
    batchSize?: number
    delayMs?: number
    concurrency?: number
    onBatch?: (results: SentimentResult[]) => Promise<void> | void
  } = {},
): Promise<SentimentResult[]> {
  const batchSize = opts.batchSize ?? 25
  const delayMs = opts.delayMs ?? 300
  const concurrency = Math.max(1, opts.concurrency ?? 4)

  const batches: CommentToAnalyze[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }

  const all: SentimentResult[] = []
  for (let i = 0; i < batches.length; i += concurrency) {
    if (i > 0 && delayMs > 0) await delay(delayMs)
    const wave = batches.slice(i, i + concurrency)
    const maps = await Promise.all(wave.map((b) => analyzeIFoldBatch(b)))
    for (const map of maps) {
      const results = Object.values(map)
      all.push(...results)
      if (opts.onBatch) await opts.onBatch(results)
    }
  }
  return all
}
