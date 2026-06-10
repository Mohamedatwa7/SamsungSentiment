import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Get recent sync logs
    const { data: syncLogs, error: logsError } = await supabase
      .from("apify_sync_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20)

    if (logsError) {
      console.error("Error fetching sync logs:", logsError)
    }

    // Get counts by platform
    const { data: postCounts, error: postError } = await supabase
      .from("social_posts")
      .select("platform")
    
    const { data: commentCounts, error: commentError } = await supabase
      .from("social_comments")
      .select("platform")

    if (postError) console.error("Error fetching post counts:", postError)
    if (commentError) console.error("Error fetching comment counts:", commentError)

    // Aggregate counts by platform
    const platformStats: Record<string, { posts: number; comments: number }> = {}
    
    postCounts?.forEach(({ platform }) => {
      if (!platformStats[platform]) platformStats[platform] = { posts: 0, comments: 0 }
      platformStats[platform].posts++
    })
    
    commentCounts?.forEach(({ platform }) => {
      if (!platformStats[platform]) platformStats[platform] = { posts: 0, comments: 0 }
      platformStats[platform].comments++
    })

    return NextResponse.json({
      syncLogs: syncLogs || [],
      platformStats,
      totalPosts: postCounts?.length || 0,
      totalComments: commentCounts?.length || 0,
    })
  } catch (error) {
    console.error("Error fetching sync status:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch status" },
      { status: 500 }
    )
  }
}
