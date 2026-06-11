import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

export type Sentiment = "positive" | "negative" | "neutral"

export interface SentimentResult {
  id: string
  sentiment: Sentiment
  // 0-100 where 0 = most negative, 50 = neutral, 100 = most positive
  score: number
  // short machine-readable tags describing the comment, e.g. "price_complaint", "green_line", "praise"
  flags: string[]
  // true when the LLM call failed and this is a placeholder, NOT a real analysis.
  // Callers must not persist failed results as analyzed, so they get retried.
  failed?: boolean
}

export interface CommentToAnalyze {
  id: string
  text: string
  platform?: string
  postCaption?: string
}

// Zod schema the LLM must return. We use a short integer index ("i") instead of
// the real comment id, because LLMs frequently mangle long UUIDs in their output.
const SentimentSchema = z.object({
  results: z.array(
    z.object({
      i: z.number().int(),
      sentiment: z.enum(["positive", "negative", "neutral"]),
      score: z.number().min(0).max(100),
      flags: z.array(z.string()).max(5),
    }),
  ),
})

const SYSTEM_PROMPT = `You are a senior social media analyst for Samsung Gulf (Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman).
Your job is to read each comment the way BOTH a human reader AND a Samsung brand manager would, then judge whether it is good or bad FOR SAMSUNG.

You understand Modern Standard Arabic, Gulf/Khaleeji dialect, Egyptian/Levantine dialects, English, and "Arabizi" (Arabic written in Latin letters/numbers, e.g. "7elo", "msha2allah").

HOW TO JUDGE (think like a human, not a keyword matcher):
- Read the FULL comment and infer the real intent, including sarcasm, rhetorical questions, and implied complaints.
- "positive": genuine praise, excitement, love, satisfaction, loyalty, gratitude, hype, or pure celebratory emojis (❤️🔥👏😍🙌✨💙👍). Pre-orders/"I bought it"/"best phone" = positive.
- "negative": complaints, frustration, defects, disappointment, anger, sarcasm, mockery, price/service criticism, comparisons where Samsung loses, or warnings to others. Hidden/sarcastic complaints count as negative.
- "neutral": genuine factual questions with no emotion, asking for price/specs/availability without complaint, tagging a friend, or ambiguous one-word/emoji-less remarks with no clear stance.

SCORE (0-100):
- 0-20 = strongly negative (defect, scam accusation, rage)
- 21-40 = mildly negative (minor complaint, disappointment)
- 41-59 = neutral
- 60-79 = mildly positive (likes it, soft praise)
- 80-100 = strongly positive (love, hype, loyalty, evangelizing)
The score MUST be consistent with the sentiment label.

FLAGS (0-5 short snake_case tags) describing the substance, e.g.:
price_complaint, green_line_defect, battery_issue, camera_praise, service_complaint, shipping_delay, software_bug, comparison_iphone, comparison_huawei, feature_request, praise, hype, question, spam, off_topic, warranty_issue, overheating, support_complaint.

CRITICAL CONTEXT:
- "green line" / "الخط الأخضر" = screen defect → negative + flag green_line_defect.
- Repeated "???" or "متى/وين/ليش" with frustration = complaint → negative.
- "غالي/expensive" = price complaint → negative + price_complaint.
- Pure emoji ❤️/🔥 = positive. Asking price/specs calmly = neutral.
- Sarcasm like "يعني؟ طيب وبعدين" or "wow great job 🙄" = negative.
- AI BACKLASH is negative: complaints about Samsung using AI-generated content
  ("no AI", "stop using AI", "this is AI 💀", "press F no AI", "AI slop") =
  negative + flag ai_content_backlash. Praise of AI features remains positive.
- Competitor-favoring memes/jokes = negative: "New iPhone 17 🗿", "switching to
  Apple", "iPhone better" → negative + comparison_iphone. A joke at APPLE'S
  expense that favors Samsung = positive.
- Mockery of the product or the ad = negative even when phrased as a joke:
  "just make it a TV at this point", "that's a tablet not a phone", clown/moai
  emojis (🤡🗿💀 used mockingly), "who asked".
- INTERNET SLANG that reads negative literally but is PRAISE: "i'm dead 😭",
  "this ate", "cooked them", "insane 🔥", "no way this is real" (amazement),
  "shut up and take my money" = positive.
- Demanding/impatient release questions ("one ui 9???", "when in my country??",
  "still waiting...") = mildly negative (frustration), not neutral.

Always return EXACTLY one result object per input item, echoing back its integer index "i".`

function buildUserPrompt(batch: CommentToAnalyze[]): string {
  return `Analyze the following ${batch.length} comments. Return one result per item, echoing the same integer index "i".

${batch
  .map((c, idx) => {
    const ctx = c.postCaption ? `\nPost context: ${c.postCaption.slice(0, 120)}` : ""
    return `i: ${idx}${ctx}\nComment: ${c.text}`
  })
  .join("\n\n")}`
}

const FALLBACK: Omit<SentimentResult, "id"> = { sentiment: "neutral", score: 50, flags: [], failed: true }

/**
 * Analyze a single batch of comments with the LLM.
 * Returns a map keyed by comment id. Missing/failed ids fall back to neutral.
 */
export async function analyzeBatch(batch: CommentToAnalyze[]): Promise<Record<string, SentimentResult>> {
  const out: Record<string, SentimentResult> = {}
  if (batch.length === 0) return out

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: SentimentSchema,
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(batch),
      temperature: 0.2,
    })

    for (const r of object.results) {
      const comment = batch[r.i]
      if (!comment) continue
      out[comment.id] = {
        id: comment.id,
        sentiment: r.sentiment,
        score: Math.max(0, Math.min(100, Math.round(r.score))),
        flags: r.flags || [],
      }
    }
  } catch (error) {
    console.error("[v0] analyzeBatch failed:", error)
  }

  // Ensure every id has a result (fallback to neutral)
  for (const c of batch) {
    if (!out[c.id]) out[c.id] = { id: c.id, ...FALLBACK }
  }

  return out
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Analyze many comments in sequential batches with a delay to avoid rate limits.
 * onBatch is invoked after each batch so callers can persist incrementally.
 */
export async function analyzeComments(
  comments: CommentToAnalyze[],
  opts: {
    batchSize?: number
    delayMs?: number
    concurrency?: number
    onBatch?: (results: SentimentResult[]) => Promise<void> | void
  } = {},
): Promise<SentimentResult[]> {
  const batchSize = opts.batchSize ?? 20
  const delayMs = opts.delayMs ?? 1000
  // Number of LLM batches to run in parallel. The calls are network/IO bound,
  // so a small pool dramatically increases throughput for large backfills.
  const concurrency = Math.max(1, opts.concurrency ?? 1)

  const batches: CommentToAnalyze[][] = []
  for (let i = 0; i < comments.length; i += batchSize) {
    batches.push(comments.slice(i, i + batchSize))
  }

  const all: SentimentResult[] = []

  // Process the batches in waves of `concurrency`.
  for (let i = 0; i < batches.length; i += concurrency) {
    if (i > 0 && delayMs > 0) await delay(delayMs)
    const wave = batches.slice(i, i + concurrency)
    const maps = await Promise.all(wave.map((b) => analyzeBatch(b)))
    for (const map of maps) {
      const results = Object.values(map)
      all.push(...results)
      if (opts.onBatch) await opts.onBatch(results)
    }
  }

  return all
}
