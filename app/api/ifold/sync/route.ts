import { NextRequest, NextResponse } from "next/server"
import { analyzeIFoldComments, analyzeIFoldPosts, syncIFold } from "@/lib/ifold-sync"
import { ifoldTrackingEnded, IFOLD_TRACKING_END } from "@/lib/ifold-data"
import { isAuthorizedCron } from "@/lib/cron-auth"

// Two Apify scrape waves + RSS + LLM analysis need headroom, same as the
// unpacked sync.
export const maxDuration = 300

// Manual trigger (admin / first-time setup). `wait: true` polls the fresh
// scrape runs and ingests them in the same call, so the section has data
// immediately instead of after the next scheduled cycle.
export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedCron(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))

    // LLM analysis only, with a fresh time budget — the full sync's ingest
    // phase can consume the whole invocation before analysis gets a turn, so
    // the scheduled workflow calls this as its own step to drain the backlog.
    if (body.analyzeOnly === true) {
      const deadline = Date.now() + 240000
      const postsAnalyzed = await analyzeIFoldPosts(deadline)
      const commentsAnalyzed = await analyzeIFoldComments(deadline)
      return NextResponse.json({ success: true, postsAnalyzed, commentsAnalyzed })
    }

    if (ifoldTrackingEnded() && !body.force) {
      return NextResponse.json({
        skipped: true,
        reason: `iPhone Duo tracking ended on ${IFOLD_TRACKING_END.toISOString()}. Pass { "force": true } to sync anyway.`,
      })
    }

    const result = await syncIFold({
      wait: body.wait !== false,
      // Harvest completed Apify runs without starting new paid actor runs.
      ingestOnly: body.ingestOnly === true,
      runsToSync:
        typeof body.runsToSync === "number"
          ? Math.max(1, Math.min(100, Math.floor(body.runsToSync)))
          : undefined,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("[ifold] Sync error:", error)
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

// Cron entry point (GitHub Actions ifold-sync.yml). Self-disables once the
// 3-week tracking window closes on Oct 1st, 2026.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({
      campaign: "iPhone Duo Competition Watch",
      schedule: "09:00 Gulf time, daily until Oct 1st 2026",
      trackingEnded: ifoldTrackingEnded(),
      endsAt: IFOLD_TRACKING_END.toISOString(),
    })
  }

  if (ifoldTrackingEnded()) {
    return NextResponse.json({
      skipped: true,
      reason: `Tracking ended on ${IFOLD_TRACKING_END.toISOString()}`,
    })
  }

  try {
    const result = await syncIFold()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("[ifold] Cron sync error:", error)
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
