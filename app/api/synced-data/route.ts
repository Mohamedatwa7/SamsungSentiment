import { NextResponse } from "next/server"
import { getSupabaseCounts, getSupabaseComments } from "@/lib/supabase-data"

export async function GET() {
  try {
    const counts = await getSupabaseCounts()
    const comments = await getSupabaseComments()
    
    // Get platform breakdown
    const platformCounts = comments.reduce((acc, comment) => {
      acc[comment.platform] = (acc[comment.platform] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return NextResponse.json({
      success: true,
      counts,
      platformBreakdown: platformCounts,
      lastComment: comments[0] || null,
    })
  } catch (error) {
    console.error("Error fetching synced data:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch synced data" },
      { status: 500 }
    )
  }
}
