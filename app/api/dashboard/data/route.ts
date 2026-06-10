import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Sentiment analysis
function analyzeSentiment(text: string): { sentiment: "positive" | "negative" | "neutral"; flags: string[] } {
  const lowerText = text.toLowerCase()
  const flags: string[] = []
  
  const positivePatterns = [
    /love|amazing|awesome|excellent|fantastic|great|best|perfect|beautiful|stunning/i,
    /impressed|happy|excited|recommend|worth|incredible|brilliant/i,
    /thank|appreciate|satisfied|pleased|delighted/i,
  ]
  
  const negativePatterns = [
    /hate|terrible|worst|awful|horrible|disappointing|waste|garbage|trash/i,
    /broken|defective|useless|poor|bad|fail|sucks|regret/i,
    /angry|frustrated|annoyed|upset|unhappy|dissatisfied/i,
    /refund|return|complaint|issue|problem|bug|error|crash/i,
  ]
  
  let positiveScore = 0
  let negativeScore = 0
  
  for (const pattern of positivePatterns) {
    if (pattern.test(lowerText)) positiveScore++
  }
  
  for (const pattern of negativePatterns) {
    if (pattern.test(lowerText)) negativeScore++
  }
  
  // Check for specific flags
  if (/refund|return|money back/i.test(lowerText)) flags.push("refund_request")
  if (/bug|crash|error|freeze|not working/i.test(lowerText)) flags.push("technical_issue")
  if (/customer service|support|help/i.test(lowerText)) flags.push("support_mention")
  if (/competitor|iphone|pixel|xiaomi|oppo/i.test(lowerText)) flags.push("competitor_mention")
  
  let sentiment: "positive" | "negative" | "neutral" = "neutral"
  if (positiveScore > negativeScore) sentiment = "positive"
  else if (negativeScore > positiveScore) sentiment = "negative"
  
  return { sentiment, flags }
}

// Feature extraction
function extractFeatures(text: string): string[] {
  const features: string[] = []
  const lowerText = text.toLowerCase()
  
  const featurePatterns: Record<string, RegExp> = {
    camera: /camera|photo|picture|nightography|zoom|lens|portrait/i,
    battery: /battery|charge|charging|power|mah/i,
    display: /display|screen|amoled|refresh|hz|brightness/i,
    performance: /performance|speed|fast|lag|processor|chip|snapdragon|exynos/i,
    design: /design|look|beautiful|premium|build|color/i,
    ai: /galaxy ai|ai feature|circle to search|live translate|ai/i,
    spen: /s.?pen|stylus|note/i,
    foldable: /fold|flip|foldable|hinge/i,
  }
  
  for (const [feature, pattern] of Object.entries(featurePatterns)) {
    if (pattern.test(lowerText)) features.push(feature)
  }
  
  return features
}

// Language detection (simplified)
function detectLanguage(text: string): string {
  const arabicPattern = /[\u0600-\u06FF]/
  const koreanPattern = /[\uAC00-\uD7AF]/
  const chinesePattern = /[\u4E00-\u9FFF]/
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/
  
  if (arabicPattern.test(text)) return "ar"
  if (koreanPattern.test(text)) return "ko"
  if (chinesePattern.test(text)) return "zh"
  if (japanesePattern.test(text)) return "ja"
  return "en"
}

// Product classification
function classifyProduct(text: string): { department: string; productCategory: string; productModel: string } {
  const lowerText = text.toLowerCase()
  
  // Mobile (MX)
  if (/galaxy\s*s\d{2}|s24|s25|s26/i.test(lowerText)) {
    const match = lowerText.match(/galaxy\s*s(\d{2})\s*(ultra|plus|\+)?/i)
    return {
      department: "MX",
      productCategory: "Smartphone",
      productModel: match ? `Galaxy S${match[1]}${match[2] ? ` ${match[2].replace('+', 'Plus')}` : ''}` : "Galaxy S Series"
    }
  }
  
  if (/galaxy\s*a\d{2}/i.test(lowerText)) {
    return { department: "MX", productCategory: "Smartphone", productModel: "Galaxy A Series" }
  }
  
  if (/galaxy\s*z\s*fold|z\s*fold/i.test(lowerText)) {
    return { department: "MX", productCategory: "Foldable", productModel: "Galaxy Z Fold" }
  }
  
  if (/galaxy\s*z\s*flip|z\s*flip/i.test(lowerText)) {
    return { department: "MX", productCategory: "Foldable", productModel: "Galaxy Z Flip" }
  }
  
  if (/galaxy\s*watch|watch\s*\d|watch\s*ultra/i.test(lowerText)) {
    return { department: "MX", productCategory: "Wearable", productModel: "Galaxy Watch" }
  }
  
  if (/galaxy\s*buds|buds\s*\d|buds\s*pro|buds\s*fe/i.test(lowerText)) {
    return { department: "MX", productCategory: "Audio", productModel: "Galaxy Buds" }
  }
  
  if (/galaxy\s*tab|tab\s*s\d/i.test(lowerText)) {
    return { department: "MX", productCategory: "Tablet", productModel: "Galaxy Tab" }
  }
  
  if (/galaxy\s*ring/i.test(lowerText)) {
    return { department: "MX", productCategory: "Wearable", productModel: "Galaxy Ring" }
  }
  
  // Visual Display (VD)
  if (/neo\s*qled|qled|oled\s*tv|samsung\s*tv|smart\s*tv|the\s*frame/i.test(lowerText)) {
    return { department: "VD", productCategory: "TV", productModel: "Samsung TV" }
  }
  
  if (/soundbar|hw-|dolby\s*atmos/i.test(lowerText)) {
    return { department: "VD", productCategory: "Audio", productModel: "Soundbar" }
  }
  
  if (/monitor|odyssey|viewfinity/i.test(lowerText)) {
    return { department: "VD", productCategory: "Monitor", productModel: "Samsung Monitor" }
  }
  
  // Digital Appliances (DA)
  if (/refrigerator|fridge|bespoke.*fridge/i.test(lowerText)) {
    return { department: "DA", productCategory: "Kitchen", productModel: "Refrigerator" }
  }
  
  if (/washer|washing\s*machine|dryer|laundry/i.test(lowerText)) {
    return { department: "DA", productCategory: "Laundry", productModel: "Washing Machine" }
  }
  
  if (/air\s*conditioner|ac\s*unit|wind.?free/i.test(lowerText)) {
    return { department: "DA", productCategory: "Climate", productModel: "Air Conditioner" }
  }
  
  if (/vacuum|jet\s*bot|robot\s*cleaner/i.test(lowerText)) {
    return { department: "DA", productCategory: "Cleaning", productModel: "Vacuum" }
  }
  
  // Default to MX/Smartphone if Samsung mentioned but no specific product
  if (/samsung|galaxy/i.test(lowerText)) {
    return { department: "MX", productCategory: "Smartphone", productModel: "Galaxy" }
  }
  
  return { department: "Unknown", productCategory: "Unknown", productModel: "Unknown" }
}

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Fetch posts
    const { data: rawPosts, error: postsError } = await supabase
      .from("social_posts")
      .select("*")
      .order("published_at", { ascending: false })
    
    if (postsError) throw postsError
    
    // Fetch comments
    const { data: rawComments, error: commentsError } = await supabase
      .from("social_comments")
      .select("*")
      .order("published_at", { ascending: false })
    
    if (commentsError) throw commentsError
    
    // Process posts
    const posts = (rawPosts || []).map(post => {
      const classification = classifyProduct(post.caption || "")
      const features = extractFeatures(post.caption || "")
      
      return {
        id: post.external_id,
        platform: post.platform,
        url: post.post_url,
        caption: post.caption || "",
        mediaType: post.media_type || "text",
        mediaUrl: post.media_url,
        likes: post.likes_count || 0,
        comments: post.comments_count || 0,
        shares: post.shares_count || 0,
        views: post.views_count || 0,
        createdAt: post.published_at,
        department: classification.department,
        productCategory: classification.productCategory,
        productModel: classification.productModel,
        features,
      }
    })
    
    // Process comments
    const comments = (rawComments || []).map(comment => {
      const sentimentResult = analyzeSentiment(comment.text || "")
      const features = extractFeatures(comment.text || "")
      
      return {
        id: comment.external_id,
        postId: comment.external_post_id || "unknown",
        platform: comment.platform,
        text: comment.text || "",
        username: comment.author_username || "anonymous",
        createdAt: comment.published_at,
        sentiment: sentimentResult.sentiment,
        sentimentFlags: sentimentResult.flags,
        likes: comment.likes_count || 0,
        language: detectLanguage(comment.text || ""),
        features,
      }
    })
    
    return NextResponse.json({
      posts,
      comments,
      meta: {
        generatedAt: new Date().toISOString(),
        totals: {
          posts: posts.length,
          comments: comments.length,
        }
      }
    })
  } catch (error) {
    console.error("Error fetching dashboard data:", error)
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}
