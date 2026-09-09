import { NextRequest, NextResponse } from "next/server"
import { syncIFold } from "@/lib/ifold-sync"
import { ifoldTrackingEnded, IFOLD_TRACKING_END } from "@/lib/ifold-data"

// Two Apify scrape waves + RSS + LLM analysis need headroom, same as the
// unpacked sync.
export const maxDuration = 300

// Manual trigger (admin / first-time setup). `wait: true` polls the fresh
// scrape runs and ingests them in the same call, so the section has data
// immediately instead of after the next scheduled cycle.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get("authorization")
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !body.manual) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (ifoldTrackingEnded() && !body.force) {
      return NextResponse.json({
        skipped: true,
        reason: `iPhone Fold tracking ended on ${IFOLD_TRACKING_END.toISOString()}. Pass { "force": true } to sync anyway.`,
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
  const isVercelCron =
    request.headers.get("x-vercel-cron-schedule") !== null ||
    (request.headers.get("user-agent") || "").startsWith("vercel-cron")
  const cronSecret = process.env.CRON_SECRET
  const hasCronSecret =
    !!cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`

  if (!isVercelCron && !hasCronSecret) {
    return NextResponse.json({
      campaign: "iPhone Fold Competition Watch",
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
