import { NextRequest, NextResponse } from "next/server"

// Apify Actor IDs for social media scrapers
const APIFY_ACTORS = {
  instagram: {
    posts: "apify/instagram-profile-scraper",
    comments: "apify/instagram-comment-scraper",
  },
  tiktok: {
    posts: "clockworks/tiktok-scraper",
    comments: "clockworks/tiktok-comments-scraper",
  },
  facebook: {
    posts: "apify/facebook-pages-scraper",
  },
  twitter: {
    posts: "apidojo/tweet-scraper",
  },
}

export async function POST(request: NextRequest) {
  try {
    const { platform, type = "posts", targetUsername = "samsunggulf" } = await request.json()

    const apiToken = process.env.APIFY_API_TOKEN
    if (!apiToken) {
      return NextResponse.json({ error: "APIFY_API_TOKEN not configured" }, { status: 500 })
    }

    const actorId = APIFY_ACTORS[platform as keyof typeof APIFY_ACTORS]?.[type as "posts" | "comments"]
    if (!actorId) {
      return NextResponse.json({ error: `No scraper found for ${platform} ${type}` }, { status: 400 })
    }

    // Build input based on platform
    let input: Record<string, unknown> = {}
    
    switch (platform) {
      case "instagram":
        input = type === "posts" 
          ? { usernames: [targetUsername], resultsLimit: 50 }
          : { directUrls: [], resultsLimit: 100 }
        break
      case "tiktok":
        input = type === "posts"
          ? { profiles: [targetUsername], resultsPerPage: 50 }
          : { postURLs: [], commentsPerPost: 100 }
        break
      case "facebook":
        input = { startUrls: [{ url: `https://www.facebook.com/${targetUsername}` }], maxPosts: 50 }
        break
      case "twitter":
        input = { searchTerms: [`from:${targetUsername}`], maxTweets: 50 }
        break
    }

    // Get webhook URL from request origin
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || ""
    const webhookUrl = `${origin}/api/webhook/apify`
    const webhookSecret = process.env.APIFY_WEBHOOK_SECRET

    // Start the Apify actor run
    const response = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          webhooks: webhookSecret ? [
            {
              eventTypes: ["ACTOR.RUN.SUCCEEDED"],
              requestUrl: webhookUrl,
              payloadTemplate: JSON.stringify({
                platform,
                type,
                runId: "{{runId}}",
                actorId: "{{actorId}}",
                datasetId: "{{defaultDatasetId}}",
                secret: webhookSecret,
              }),
            },
          ] : [],
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: `Apify API error: ${error}` }, { status: response.status })
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: `Started ${platform} ${type} scraper`,
      runId: result.data?.id,
      actorId,
      status: result.data?.status,
    })
  } catch (error) {
    console.error("Error triggering Apify scraper:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to trigger scraper" },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Return available scrapers
  return NextResponse.json({
    scrapers: APIFY_ACTORS,
    configured: !!process.env.APIFY_API_TOKEN,
  })
}
