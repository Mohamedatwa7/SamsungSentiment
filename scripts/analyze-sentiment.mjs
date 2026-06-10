import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

const openai = new OpenAI()

// Read comments from JSON files
const dataDir = path.join(process.cwd(), 'data')

const instagramComments = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'instagram-comments.json'), 'utf-8')
)
const tiktokComments = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'tiktok-comments.json'), 'utf-8')
)

console.log(`Loaded ${instagramComments.length} Instagram comments`)
console.log(`Loaded ${tiktokComments.length} TikTok comments`)

// Prepare comments for analysis
const allComments = []

// Process Instagram comments
for (let i = 0; i < instagramComments.length; i++) {
  const c = instagramComments[i]
  const text = c.commentText || ''
  if (text.length < 2) continue
  
  allComments.push({
    id: `ig-${i}`,
    platform: 'instagram',
    text: text,
    username: c.commentatorUserName || 'unknown',
    postUrl: c['postInfo.url'] || '',
    postCaption: c['postInfo.caption'] || '',
  })
}

// Process TikTok comments
for (let i = 0; i < tiktokComments.length; i++) {
  const c = tiktokComments[i]
  const text = c.comment || ''
  if (text.length < 2) continue
  if (text === '[Sticker] ' || text === '[Sticker]') continue
  
  allComments.push({
    id: `tt-${i}`,
    platform: 'tiktok',
    text: text,
    username: c.author_username || 'unknown',
    postUrl: c.video_url || '',
    postCaption: '',
    likes: c.likes || 0,
  })
}

console.log(`Total comments to analyze: ${allComments.length}`)

// Analyze in batches using OpenAI
async function analyzeBatch(comments) {
  const commentTexts = comments.map((c, i) => `${i}: ${c.text}`).join('\n')
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a sentiment analysis expert for Samsung Gulf social media. Analyze each comment and classify as:
- "positive": Happy customers, praise, excitement, love for products
- "negative": Complaints, frustration, issues, problems, disappointment  
- "neutral": Questions, general statements, unclear sentiment

Comments are from Arabic and English speakers in the Gulf region (UAE, Kuwait, Qatar, Bahrain, Oman).

IMPORTANT:
- Single emojis like ❤️🔥😍 are POSITIVE
- Questions asking about price/availability without complaint are NEUTRAL
- Any mention of problems, issues, defects, bad service is NEGATIVE
- Sarcasm criticizing the product is NEGATIVE

Return ONLY a JSON array of sentiments in order, like: ["positive", "neutral", "negative", ...]`
      },
      {
        role: 'user',
        content: commentTexts
      }
    ],
    temperature: 0,
  })
  
  const content = response.choices[0].message.content || '[]'
  // Extract JSON array from response
  const match = content.match(/\[[\s\S]*\]/)
  if (match) {
    return JSON.parse(match[0])
  }
  return comments.map(() => 'neutral')
}

// Process in batches of 50
const BATCH_SIZE = 50
const results = []

console.log('Starting sentiment analysis...')

for (let i = 0; i < allComments.length; i += BATCH_SIZE) {
  const batch = allComments.slice(i, i + BATCH_SIZE)
  console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allComments.length / BATCH_SIZE)}`)
  
  try {
    const sentiments = await analyzeBatch(batch)
    
    for (let j = 0; j < batch.length; j++) {
      results.push({
        ...batch[j],
        sentiment: sentiments[j] || 'neutral'
      })
    }
  } catch (error) {
    console.error(`Error processing batch: ${error.message}`)
    // Mark as neutral on error
    for (const comment of batch) {
      results.push({
        ...comment,
        sentiment: 'neutral'
      })
    }
  }
  
  // Small delay to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 500))
}

// Save results
const outputPath = path.join(dataDir, 'analyzed-comments.json')
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))

// Calculate stats
const positive = results.filter(r => r.sentiment === 'positive').length
const negative = results.filter(r => r.sentiment === 'negative').length
const neutral = results.filter(r => r.sentiment === 'neutral').length

console.log('\n=== Sentiment Analysis Complete ===')
console.log(`Total: ${results.length}`)
console.log(`Positive: ${positive} (${(positive / results.length * 100).toFixed(1)}%)`)
console.log(`Negative: ${negative} (${(negative / results.length * 100).toFixed(1)}%)`)
console.log(`Neutral: ${neutral} (${(neutral / results.length * 100).toFixed(1)}%)`)
console.log(`\nSaved to: ${outputPath}`)
