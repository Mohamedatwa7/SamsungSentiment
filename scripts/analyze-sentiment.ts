import OpenAI from "openai"
import fs from "fs"
import path from "path"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface CommentWithSentiment {
  id: string
  platform: "instagram" | "tiktok"
  text: string
  username: string
  postUrl: string
  sentiment: "positive" | "neutral" | "negative"
  product: string
}

// Batch comments for efficient API calls
async function analyzeBatch(comments: string[]): Promise<("positive" | "neutral" | "negative")[]> {
  const prompt = `Analyze the sentiment of each comment below. Respond with ONLY a JSON array of sentiments.
Each sentiment must be exactly one of: "positive", "neutral", or "negative".

Rules for classification:
- "positive": Praise, excitement, love, appreciation, compliments, happy emojis (❤️🔥😍👏)
- "negative": Complaints, frustration, disappointment, problems, issues, requests for help, angry emojis, questions about problems, pricing complaints
- "neutral": Simple questions, tags (@username), single emojis that aren't clearly positive/negative, short unclear responses

Comments to analyze:
${comments.map((c, i) => `${i + 1}. "${c}"`).join("\n")}

Respond with ONLY a JSON array like: ["positive", "negative", "neutral", ...]`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    })

    const content = response.choices[0]?.message?.content || "[]"
    // Extract JSON array from response
    const match = content.match(/\[[\s\S]*\]/)
    if (match) {
      return JSON.parse(match[0])
    }
    return comments.map(() => "neutral")
  } catch (error) {
    console.error("Error analyzing batch:", error)
    return comments.map(() => "neutral")
  }
}

// Detect product from text
function detectProduct(text: string): string {
  const productPatterns = [
    { pattern: /S26\s*Ultra|Galaxy\s*S26\s*Ultra/i, product: "Galaxy S26 Ultra" },
    { pattern: /S26\+|S26\s*Plus|Galaxy\s*S26\+/i, product: "Galaxy S26+" },
    { pattern: /S26(?!\+|Ultra|\s*Ultra|\s*Plus)/i, product: "Galaxy S26" },
    { pattern: /S25\s*Ultra|Galaxy\s*S25\s*Ultra/i, product: "Galaxy S25 Ultra" },
    { pattern: /S25(?!\+|Ultra)/i, product: "Galaxy S25" },
    { pattern: /S24\s*Ultra|Galaxy\s*S24\s*Ultra/i, product: "Galaxy S24 Ultra" },
    { pattern: /S24(?!\+|Ultra)/i, product: "Galaxy S24" },
    { pattern: /Z\s*Fold|Fold\s*\d/i, product: "Galaxy Z Fold" },
    { pattern: /Z\s*Flip|Flip\s*\d/i, product: "Galaxy Z Flip" },
    { pattern: /Galaxy\s*Buds|Buds/i, product: "Galaxy Buds" },
    { pattern: /Galaxy\s*Watch|Watch\s*\d/i, product: "Galaxy Watch" },
    { pattern: /Galaxy\s*Tab|Tab\s*S/i, product: "Galaxy Tab" },
    { pattern: /Galaxy\s*Ring/i, product: "Galaxy Ring" },
    { pattern: /A\d{2}|Galaxy\s*A/i, product: "Galaxy A Series" },
  ]

  for (const { pattern, product } of productPatterns) {
    if (pattern.test(text)) {
      return product
    }
  }
  return "General"
}

async function main() {
  console.log("Loading comment data...")

  // Load Instagram comments
  const instagramPath = path.join(process.cwd(), "data", "instagram-comments.json")
  const instagramRaw = JSON.parse(fs.readFileSync(instagramPath, "utf-8"))

  // Load TikTok comments
  const tiktokPath = path.join(process.cwd(), "data", "tiktok-comments.json")
  const tiktokRaw = JSON.parse(fs.readFileSync(tiktokPath, "utf-8"))

  console.log(`Found ${instagramRaw.length} Instagram comments`)
  console.log(`Found ${tiktokRaw.length} TikTok comments`)

  // Process Instagram comments
  const instagramComments = instagramRaw.map((c: any, i: number) => ({
    id: `ig-${i}`,
    platform: "instagram" as const,
    text: c.commentText || "",
    username: c.commentatorUserName || "unknown",
    postUrl: c["postInfo.url"] || "",
    postCaption: c["postInfo.caption"] || "",
  })).filter((c: any) => c.text.length > 0)

  // Process TikTok comments
  const tiktokComments = tiktokRaw
    .filter((c: any) => {
      const text = c.comment || ""
      return text.length > 1 && !text.startsWith("[Sticker]")
    })
    .map((c: any, i: number) => ({
      id: `tt-${i}`,
      platform: "tiktok" as const,
      text: c.comment || "",
      username: c.author_username || "unknown",
      postUrl: c.video_url || "",
      postCaption: "",
    }))

  const allComments = [...instagramComments, ...tiktokComments]
  console.log(`Total comments to analyze: ${allComments.length}`)

  // Process in batches of 30
  const batchSize = 30
  const results: CommentWithSentiment[] = []
  
  for (let i = 0; i < allComments.length; i += batchSize) {
    const batch = allComments.slice(i, i + batchSize)
    const texts = batch.map((c) => c.text.slice(0, 200)) // Limit text length
    
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allComments.length / batchSize)}...`)
    
    const sentiments = await analyzeBatch(texts)
    
    batch.forEach((comment, idx) => {
      const productFromCaption = detectProduct(comment.postCaption)
      const productFromText = detectProduct(comment.text)
      
      results.push({
        id: comment.id,
        platform: comment.platform,
        text: comment.text,
        username: comment.username,
        postUrl: comment.postUrl,
        sentiment: sentiments[idx] || "neutral",
        product: productFromCaption !== "General" ? productFromCaption : productFromText,
      })
    })

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  // Save results
  const outputPath = path.join(process.cwd(), "data", "analyzed-comments.json")
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
  
  // Calculate stats
  const positive = results.filter((r) => r.sentiment === "positive").length
  const negative = results.filter((r) => r.sentiment === "negative").length
  const neutral = results.filter((r) => r.sentiment === "neutral").length
  
  console.log("\n=== Analysis Complete ===")
  console.log(`Total: ${results.length}`)
  console.log(`Positive: ${positive} (${((positive / results.length) * 100).toFixed(1)}%)`)
  console.log(`Negative: ${negative} (${((negative / results.length) * 100).toFixed(1)}%)`)
  console.log(`Neutral: ${neutral} (${((neutral / results.length) * 100).toFixed(1)}%)`)
  console.log(`\nSaved to: ${outputPath}`)
}

main().catch(console.error)
