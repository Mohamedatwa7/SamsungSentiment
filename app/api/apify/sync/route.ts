import { NextRequest, NextResponse } from "next/server"
import { syncAllPlatforms, getAllScheduledRuns } from "@/lib/apify-sync"
import { createClient } from "@/lib/supabase/server"
import { processAndNormalizeData, mergeNormalizedData } from "@/lib/process-synced-data"
import { promises as fs } from "fs"
import path from "path"

// Read existing normalized data
async function readExistingData() {
  try {
    const filePath = path.join(process.cwd(), "data", "social-normalized.json")
    const content = await fs.readFile(filePath, "utf-8")
    return JSON.parse(content)
  } catch {
    return { meta: {}, posts: [], comments: [] }
  }
}

// Write normalized data back to file
async function writeNormalizedData(data: unknown) {
  const filePath = path.join(process.cwd(), "data", "social-normalized.json")
  await fs.writeFile(filePath, JSON.stringify(data), "utf-8")
}

// Sync data from Apify to Supabase and process for dashboard
// Can be called manually or via Vercel Cron
export async function POST(request: NextRequest) {
  try {
    // Optional: verify cron secret for automated runs
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    
    // If CRON_SECRET is set, verify it (for Vercel Cron jobs)
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Allow requests without auth for manual triggers from admin page
      const body = await request.json().catch(() => ({}))
      if (!body.manual) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }
    
    const supabase = await createClient()
    
    // Log sync start
    const { data: logEntry } = await supabase
      .from("apify_sync_log")
      .insert({
        platform: "all",
        scraper_type: "scheduled_sync",
        status: "started",
      })
      .select()
      .single()
    
    // Sync all platforms
    const results = await syncAllPlatforms()
    
    // Calculate totals
    const totalInserted = Object.values(results).reduce((sum, r) => sum + (r.inserted || 0), 0)
    const totalProcessed = Object.values(results).reduce((sum, r) => sum + (r.total || 0), 0)
    
    // Update log entry
    if (logEntry) {
      await supabase
        .from("apify_sync_log")
        .update({
          status: "processing",
          records_processed: totalProcessed,
          records_inserted: totalInserted,
        })
        .eq("id", logEntry.id)
    }
    
    // Process synced data and update dashboard JSON
    let processedStats = { newPosts: 0, newComments: 0, totalPosts: 0, totalComments: 0 }
    try {
      console.log("[v0] Starting data processing for dashboard...")
      const processedData = await processAndNormalizeData()
      console.log("[v0] Processed data - posts:", processedData.posts.length, "comments:", processedData.comments.length)
      
      const existingData = await readExistingData()
      console.log("[v0] Existing data - posts:", existingData.posts?.length || 0, "comments:", existingData.comments?.length || 0)
      
      const mergedData = mergeNormalizedData(
        { posts: existingData.posts || [], comments: existingData.comments || [] },
        { posts: processedData.posts, comments: processedData.comments }
      )
      console.log("[v0] Merged data - posts:", mergedData.posts.length, "comments:", mergedData.comments.length)
      
      const finalData = {
        meta: {
          generatedAt: new Date().toISOString(),
          dateRange: processedData.meta.dateRange,
          totals: {
            posts: mergedData.posts.length,
            comments: mergedData.comments.length,
          },
        },
        posts: mergedData.posts,
        comments: mergedData.comments,
      }
      
      await writeNormalizedData(finalData)
      console.log("[v0] Wrote normalized data to file")
      
      processedStats = {
        newPosts: processedData.posts.length,
        newComments: processedData.comments.length,
        totalPosts: finalData.meta.totals.posts,
        totalComments: finalData.meta.totals.comments,
      }
    } catch (processError) {
      console.error("[v0] Processing error:", processError)
    }
    
    // Update log entry to completed
    if (logEntry) {
      await supabase
        .from("apify_sync_log")
        .update({
          status: "completed",
          records_processed: processedStats.totalPosts + processedStats.totalComments,
          records_inserted: processedStats.newPosts + processedStats.newComments,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logEntry.id)
    }
    
    return NextResponse.json({
      success: true,
      results,
      totals: {
        processed: totalProcessed,
        inserted: totalInserted,
      },
      dashboard: processedStats,
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Sync error:", error)
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// Get sync status and recent runs
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get latest sync logs
    const { data: logs } = await supabase
      .from("apify_sync_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10)
    
    // Get post counts by platform
    const { data: postCounts } = await supabase
      .from("social_posts")
      .select("platform")
    
    const counts: Record<string, number> = {}
    postCounts?.forEach(p => {
      counts[p.platform] = (counts[p.platform] || 0) + 1
    })
    
    // Get recent Apify runs
    const runs = await getAllScheduledRuns()
    
    return NextResponse.json({
      syncLogs: logs || [],
      postCounts: counts,
      apifyRuns: runs,
      lastChecked: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Status error:", error)
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    )
  }
}
