import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { analyzeComments, type CommentToAnalyze } from "@/lib/sentiment"

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface CommentRow {
  id: string
  text: string | null
  platform: string
  external_post_id: string | null
}

/**
 * Resumable sentiment backfill.
 *
 * POST body:
 *   { limit?: number, batchSize?: number, reanalyze?: boolean }
 *
 * - reanalyze=false (default): only processes comments where sentiment_analyzed_at IS NULL
 * - reanalyze=true: re-processes ALL comments (resets progress by ignoring analyzed flag)
 *
 * Call repeatedly until `remaining` is 0 to backfill the whole table.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit: number = Math.min(body.limit ?? 200, 500)
    const batchSize: number = body.batchSize ?? 20
    const concurrency: number = Math.min(body.concurrency ?? 1, 6)
    const reanalyze: boolean = body.reanalyze ?? false

    // Build the query for comments that still need analysis.
    let query = supabase
      .from("social_comments")
      .select("id, text, platform, external_post_id")
      .not("text", "is", null)
      .neq("text", "")

    if (!reanalyze) {
      query = query.is("sentiment_analyzed_at", null)
    }

    const { data: rows, error } = await query.limit(limit)

    if (error) {
      console.error("[v0] Failed to fetch comments for analysis:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const comments = (rows || []) as CommentRow[]

    if (comments.length === 0) {
      return NextResponse.json({
        message: "No comments left to analyze",
        processed: 0,
        remaining: 0,
        done: true,
      })
    }

    const toAnalyze: CommentToAnalyze[] = comments.map((c) => ({
      id: c.id,
      text: c.text || "",
      platform: c.platform,
    }))

    let persisted = 0
    let updateErrors = 0
    let firstError: string | null = null
    const now = new Date().toISOString()

    await analyzeComments(toAnalyze, {
      batchSize,
      concurrency,
      delayMs: 300,
      onBatch: async (results) => {
        // Persist each batch immediately so progress survives timeouts.
        const updates = await Promise.all(
          results.map((r) =>
            supabase
              .from("social_comments")
              .update({
                sentiment: r.sentiment,
                sentiment_score: r.score,
                flags: r.flags,
                sentiment_analyzed_at: now,
              })
              .eq("id", r.id),
          ),
        )
        for (const u of updates) {
          if (u.error) {
            updateErrors++
            if (!firstError) firstError = u.error.message
          } else {
            persisted++
          }
        }
      },
    })

    // Count how many still need analysis.
    let remainingQuery = supabase
      .from("social_comments")
      .select("id", { count: "exact", head: true })
      .not("text", "is", null)
      .neq("text", "")
      .is("sentiment_analyzed_at", null)

    const { count: remaining } = await remainingQuery

    return NextResponse.json({
      processed: persisted,
      updateErrors,
      firstError,
      remaining: remaining ?? 0,
      done: (remaining ?? 0) === 0,
    })
  } catch (error) {
    console.error("[v0] analyze-sentiment/run error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

// GET returns progress without doing any work.
export async function GET() {
  try {
    const { count: total } = await supabase
      .from("social_comments")
      .select("id", { count: "exact", head: true })
      .not("text", "is", null)
      .neq("text", "")

    const { count: analyzed } = await supabase
      .from("social_comments")
      .select("id", { count: "exact", head: true })
      .not("text", "is", null)
      .neq("text", "")
      .not("sentiment_analyzed_at", "is", null)

    return NextResponse.json({
      total: total ?? 0,
      analyzed: analyzed ?? 0,
      remaining: (total ?? 0) - (analyzed ?? 0),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
