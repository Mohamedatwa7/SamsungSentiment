import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import normalizedData from "@/data/social-normalized.json"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { platform, batchSize = 100 } = await request.json()
    
    if (!platform || !["instagram", "tiktok", "facebook", "twitter"].includes(platform)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 })
    }
    
    const comments = (normalizedData as { comments: Array<{
      id: string
      platform: string
      text: string
      username: string
      postUrl: string
      sentiment: string
      sentimentFlags: string[]
      productModel: string
      productCategory: string
      department: string
      features: string[]
      likes: number
      createdAt: string
    }> }).comments.filter(c => c.platform === platform)
    
    console.log(`[v0] Importing ${comments.length} ${platform} comments...`)
    
    let inserted = 0
    let errors: string[] = []
    
    // Process in batches
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize)
      
      const records = batch.map(comment => ({
        platform: comment.platform,
        external_id: comment.id,
        external_post_id: comment.postUrl?.match(/\/p\/([^\/]+)/)?.[1] || comment.id,
        text: comment.text,
        author_username: comment.username,
        likes_count: comment.likes || 0,
        published_at: comment.createdAt ? new Date(comment.createdAt).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        sentiment: comment.sentiment,
        product_model: comment.productModel,
        department: comment.department,
        features: comment.features || [],
        flags: comment.sentimentFlags || [],
        raw_data: comment,
      }))
      
      const { error } = await supabase
        .from("social_comments")
        .upsert(records, { onConflict: "platform,external_id" })
      
      if (error) {
        errors.push(`Batch ${i / batchSize}: ${error.message}`)
        console.error(`[v0] Batch error:`, error)
      } else {
        inserted += batch.length
      }
      
      // Log progress every 1000 records
      if ((i + batchSize) % 1000 === 0) {
        console.log(`[v0] Imported ${Math.min(i + batchSize, comments.length)}/${comments.length} ${platform} comments`)
      }
    }
    
    return NextResponse.json({
      success: true,
      platform,
      total: comments.length,
      inserted,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    })
  } catch (error) {
    console.error("[v0] Import error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function GET() {
  // Show counts from static data
  const data = normalizedData as { comments: Array<{ platform: string }> }
  const counts = data.comments.reduce((acc, c) => {
    acc[c.platform] = (acc[c.platform] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  return NextResponse.json({
    message: "POST to this endpoint with {\"platform\": \"instagram\"} to import static data into Supabase",
    staticDataCounts: counts,
  })
}
