import OpenAI from "openai";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const openai = new OpenAI();

// Read comments from JSON files - use absolute path
const dataDir = "/vercel/share/v0-project/data";

let instagramComments = [];
let tiktokComments = [];

try {
  instagramComments = JSON.parse(readFileSync(join(dataDir, "instagram-comments.json"), "utf-8"));
  console.log(`Loaded ${instagramComments.length} Instagram comments`);
} catch (e) {
  console.log("Could not load Instagram comments:", e.message);
}

try {
  tiktokComments = JSON.parse(readFileSync(join(dataDir, "tiktok-comments.json"), "utf-8"));
  console.log(`Loaded ${tiktokComments.length} TikTok comments`);
} catch (e) {
  console.log("Could not load TikTok comments:", e.message);
}

// Prepare comments for analysis
const allComments = [
  ...instagramComments.map((c, i) => ({
    id: `ig-${i}`,
    platform: "instagram",
    text: c.commentText || "",
    username: c.commentatorUserName || "unknown",
    postCaption: c["postInfo.caption"] || "",
    postUrl: c["postInfo.url"] || "",
  })),
  ...tiktokComments
    .filter((c) => {
      const text = c.comment || "";
      return text.length >= 2 && !text.startsWith("[Sticker]");
    })
    .map((c, i) => ({
      id: `tt-${i}`,
      platform: "tiktok",
      text: c.comment || "",
      username: c.author_username || "unknown",
      postCaption: "",
      postUrl: c.video_url || "",
    })),
];

console.log(`Total comments to analyze: ${allComments.length}`);

// Batch comments for API calls (50 per batch to stay within token limits)
const BATCH_SIZE = 50;
const batches = [];
for (let i = 0; i < allComments.length; i += BATCH_SIZE) {
  batches.push(allComments.slice(i, i + BATCH_SIZE));
}

console.log(`Processing ${batches.length} batches...`);

async function analyzeBatch(comments, batchNum) {
  const commentsText = comments
    .map((c, i) => `${i + 1}. [${c.id}] "${c.text}"`)
    .join("\n");

  const prompt = `Analyze the sentiment of each comment below. These are social media comments about Samsung products from the Gulf region (may be in English or Arabic).

For each comment, classify as:
- "positive" - Happy, praising, excited, thankful, satisfied
- "negative" - Complaining, frustrated, disappointed, angry, reporting issues
- "neutral" - Questions, factual statements, unclear sentiment, off-topic

Respond with ONLY a JSON array of objects with "id" and "sentiment" fields. Example:
[{"id":"ig-0","sentiment":"positive"},{"id":"ig-1","sentiment":"negative"}]

Comments:
${commentsText}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 4000,
    });

    const content = response.choices[0].message.content.trim();
    // Extract JSON from response (handle potential markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error(`Error in batch ${batchNum}:`, error.message);
    return [];
  }
}

async function main() {
  const results = [];
  
  for (let i = 0; i < batches.length; i++) {
    console.log(`Processing batch ${i + 1}/${batches.length}...`);
    const batchResults = await analyzeBatch(batches[i], i + 1);
    results.push(...batchResults);
    
    // Small delay to avoid rate limits
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Create a map of id -> sentiment
  const sentimentMap = {};
  for (const r of results) {
    sentimentMap[r.id] = r.sentiment;
  }

  // Build final analyzed comments
  const analyzedComments = allComments.map((c) => ({
    ...c,
    sentiment: sentimentMap[c.id] || "neutral",
  }));

  // Calculate stats
  const positive = analyzedComments.filter((c) => c.sentiment === "positive").length;
  const negative = analyzedComments.filter((c) => c.sentiment === "negative").length;
  const neutral = analyzedComments.filter((c) => c.sentiment === "neutral").length;
  const total = analyzedComments.length;

  console.log("\n=== Sentiment Analysis Results ===");
  console.log(`Total: ${total}`);
  console.log(`Positive: ${positive} (${((positive / total) * 100).toFixed(1)}%)`);
  console.log(`Negative: ${negative} (${((negative / total) * 100).toFixed(1)}%)`);
  console.log(`Neutral: ${neutral} (${((neutral / total) * 100).toFixed(1)}%)`);

  // Save results
  writeFileSync(
    join(dataDir, "analyzed-comments.json"),
    JSON.stringify(analyzedComments, null, 2)
  );
  console.log("\nResults saved to data/analyzed-comments.json");
}

main().catch(console.error);
