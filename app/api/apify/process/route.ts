import { NextResponse } from "next/server"
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

export async function POST() {
  try {
    // Process synced data from Supabase
    const processedData = await processAndNormalizeData()
    
    // Read existing data
    const existingData = await readExistingData()
    
    // Merge new data with existing
    const mergedData = mergeNormalizedData(
      { posts: existingData.posts || [], comments: existingData.comments || [] },
      { posts: processedData.posts, comments: processedData.comments }
    )
    
    // Update meta with new totals
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
    
    // Write back to file
    await writeNormalizedData(finalData)
    
    return NextResponse.json({
      success: true,
      message: "Data processed and merged successfully",
      stats: {
        newPosts: processedData.posts.length,
        newComments: processedData.comments.length,
        totalPosts: finalData.meta.totals.posts,
        totalComments: finalData.meta.totals.comments,
      },
    })
  } catch (error) {
    console.error("Error processing synced data:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const existingData = await readExistingData()
    
    return NextResponse.json({
      success: true,
      meta: existingData.meta,
      stats: {
        posts: existingData.posts?.length || 0,
        comments: existingData.comments?.length || 0,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to read data" },
      { status: 500 }
    )
  }
}
