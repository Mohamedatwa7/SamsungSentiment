import { NextRequest, NextResponse } from "next/server"
import {
  syncUnpacked,
  campaignEnded,
  CAMPAIGN_END,
  repairUnavailableTikTokVideos,
} from "@/lib/unpacked-sync"
import { startF7RosterScrapes } from "@/lib/roster-sync"

// Two Apify scrape waves + LLM sentiment need headroom, same as /api/apify/sync.
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

    // One-off: fire historical scrapes for the roster's F7-era posts
    // (July 2025); results are harvested by subsequent ingest passes.
    if (body.f7Roster === true) {
      const started = await startF7RosterScrapes()
      return NextResponse.json({ success: true, started })
    }

    // Recovery: re-probe _unavailable-flagged TikTok videos and unhide the
    // ones that are actually live (rate-limited availability passes falsely
    // flagged live videos, hiding their comments). Re-run until restored
    // stops growing.
    if (body.repairAvailability === true) {
      const repair = await repairUnavailableTikTokVideos()
      return NextResponse.json({ success: true, repair })
    }

    if (campaignEnded() && !body.force) {
      return NextResponse.json({
        skipped: true,
        reason: `Galaxy Unpacked campaign tracking ended on ${CAMPAIGN_END.toISOString()}. Pass { "force": true } to sync anyway.`,
      })
    }

    const result = await syncUnpacked({
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
    console.error("[unpacked] Sync error:", error)
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

// Vercel Cron entry point (vercel.json → "0 5,10 * * *" UTC = 9AM & 2PM Gulf).
// The schedule itself lives in vercel.json without an end date, so the route
// self-disables once the campaign window closes on Aug 1st, 2026.
export async function GET(request: NextRequest) {
  const isVercelCron =
    request.headers.get("x-vercel-cron-schedule") !== null ||
    (request.headers.get("user-agent") || "").startsWith("vercel-cron")
  const cronSecret = process.env.CRON_SECRET
  const hasCronSecret =
    !!cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`

  if (!isVercelCron && !hasCronSecret) {
    return NextResponse.json({
      campaign: "Galaxy Unpacked",
      schedule: "09:00 and 14:00 Gulf time, daily until Aug 1st 2026",
      campaignEnded: campaignEnded(),
      endsAt: CAMPAIGN_END.toISOString(),
    })
  }

  if (campaignEnded()) {
    return NextResponse.json({
      skipped: true,
      reason: `Campaign tracking ended on ${CAMPAIGN_END.toISOString()}`,
    })
  }

  try {
    const result = await syncUnpacked()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("[unpacked] Cron sync error:", error)
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
