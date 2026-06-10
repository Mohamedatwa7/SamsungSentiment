import { NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"
import { writeFileSync } from "fs"
import { join } from "path"

import instagramCommentsRaw from "@/data/instagram-comments.json"
import tiktokCommentsRaw from "@/data/tiktok-comments.json"

const SentimentSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    sentiment: z.enum(["positive", "negative", "neutral"]),
  }))
})

export async function POST() {
  try {
    // Process Instagram comments
    const instagramComments = (instagramCommentsRaw as any[]).map((c, i) => ({
      id: `ig-${i}`,
      text: c.commentText || "",
      platform: "instagram" as const,
      username: c.commentatorUserName || "unknown",
      postUrl: c["postInfo.url"] || "",
      postCaption: c["postInfo.caption"] || "",
    })).filter(c => c.text.length > 1)

    // Process TikTok comments
    const tiktokComments = (tiktokCommentsRaw as any[])
      .filter(c => {
        const text = c.comment || ""
        return text.length > 1 && !text.startsWith("[Sticker]")
      })
      .map((c, i) => ({
        id: `tt-${i}`,
        text: c.comment || "",
        platform: "tiktok" as const,
        username: c.author_username || "unknown",
        postUrl: c.video_url || "",
        postCaption: "",
      }))

    const allComments = [...instagramComments, ...tiktokComments]
    
    // Use smaller batches and gpt-4o-mini to avoid rate limits
    const batchSize = 15
    const batches = []
    for (let i = 0; i < allComments.length; i += batchSize) {
      batches.push(allComments.slice(i, i + batchSize))
    }

    const analyzedComments: any[] = []
    
    // Helper function to delay between batches
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      
      // Wait 2 seconds between batches to avoid rate limits
      if (i > 0) {
        await delay(2000)
      }
      
      const prompt = `You are a sentiment analysis expert for Samsung Gulf social media, specializing in Arabic (including Gulf/Khaleeji dialect) and English.

CLASSIFICATION RULES:
- "positive": Praise, excitement, satisfaction, love, gratitude, compliments, celebratory emojis (❤️🔥👏😍🙌✨💙👍)
- "negative": Complaints, frustration, problems, disappointment, anger, sarcasm, criticism, negative emojis (😤😡👎😞😢💔😒)
- "neutral": Simple questions without emotion, factual statements, unclear intent, just tags/mentions, single word responses

ARABIC SENTIMENT INDICATORS:
Positive: ممتاز، رائع، جميل، احبه، مبدع، حلو، روعة، يجنن، الله يعطيكم العافية، ماشاء الله، تحفة، جنان
Negative: سيء، مخيب، خيبة، للأسف، مشكلة، غالي، بطيء، فاشل، زفت، ندمت، وين الخدمة، ليش ما، متى، كذب، نصب، حرام، عيب، تعبان
Sarcasm/Hidden complaints: يعني؟، طيب وبعدين، الحين صار، وش ذا، كيف يعني، الله يعينا

IMPORTANT CONTEXT:
- Long comments with multiple question marks (???) are usually complaints
- "green line" or "الخط الأخضر" mentions = negative (screen defect)
- Service/support complaints, waiting, delays = negative
- Price complaints (غالي، expensive) = negative
- Simple emoji-only (just ❤️ or 🔥) = positive
- Asking for prices/specs without complaint = neutral

Comments to analyze:
${batch.map(c => `ID: ${c.id}\nText: ${c.text}`).join("\n\n")}

Classify each comment.`

      try {
        const { object } = await generateObject({
          model: openai("gpt-4o-mini"),
          schema: SentimentSchema,
          prompt,
        })

        // Merge results with original comment data
        for (const result of object.results) {
          const originalComment = batch.find(c => c.id === result.id)
          if (originalComment) {
            analyzedComments.push({
              ...originalComment,
              sentiment: result.sentiment,
            })
          }
        }
      } catch (error) {
        console.error(`Batch ${i + 1} failed:`, error)
        // Fallback to neutral for failed batch
        for (const comment of batch) {
          analyzedComments.push({
            ...comment,
            sentiment: "neutral",
          })
        }
      }
    }

    // Calculate stats
    const positive = analyzedComments.filter(c => c.sentiment === "positive").length
    const negative = analyzedComments.filter(c => c.sentiment === "negative").length
    const neutral = analyzedComments.filter(c => c.sentiment === "neutral").length
    const total = analyzedComments.length

    // Save to file
    const outputPath = join(process.cwd(), "data", "analyzed-comments.json")
    writeFileSync(outputPath, JSON.stringify(analyzedComments, null, 2))

    return NextResponse.json({
      success: true,
      total,
      positive,
      negative,
      neutral,
      positivePercent: ((positive / total) * 100).toFixed(1),
      negativePercent: ((negative / total) * 100).toFixed(1),
      neutralPercent: ((neutral / total) * 100).toFixed(1),
    })
  } catch (error) {
    console.error("Sentiment analysis failed:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
