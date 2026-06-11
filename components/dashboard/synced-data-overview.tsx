"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageSquare, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CountUp } from "@/components/ui/count-up"

interface SyncedDataStats {
  counts: {
    posts: number
    comments: number
  }
  platformBreakdown: Record<string, number>
  lastComment: {
    text: string
    author_username: string
    platform: string
    published_at: string
  } | null
}

export function SyncedDataOverview() {
  const [data, setData] = useState<SyncedDataStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/synced-data")
      const json = await res.json()
      if (json.success) {
        setData(json)
      } else {
        setError(json.error || "Failed to fetch")
      }
    } catch (err) {
      setError("Failed to fetch synced data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <Card className="animate-in fade-in duration-500">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Synced Data from Apify
          </CardTitle>
          <CardDescription className="text-destructive">{error || "No data available"}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const platformColors: Record<string, string> = {
    instagram: "border-border bg-transparent text-foreground",
    tiktok: "border-border bg-transparent text-foreground",
    facebook: "border-border bg-transparent text-foreground",
    twitter: "border-border bg-transparent text-foreground",
  }

  return (
    <Card className="animate-in fade-in duration-500">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Synced Data from Apify
          </CardTitle>
          <CardDescription>
            Live data synced from your Apify scrapers
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="stat-rail divide-none grid grid-cols-2 mb-4 text-center">
          <div className="py-2">
            <div className="kpi-value text-4xl"><CountUp value={data.counts.posts} format={(v) => `${Math.round(v)}`} /></div>
            <div className="section-label mt-1">Synced Posts</div>
          </div>
          <div className="py-2">
            <div className="kpi-value text-4xl"><CountUp value={data.counts.comments} format={(v) => `${Math.round(v)}`} /></div>
            <div className="section-label mt-1">Synced Comments</div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="section-label">Comments by Platform</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.platformBreakdown).map(([platform, count]) => (
              <Badge
                key={platform}
                variant="outline"
                className={platformColors[platform] || "border-border bg-transparent text-muted-foreground"}
              >
                {platform}: {count}
              </Badge>
            ))}
          </div>
        </div>

        {data.lastComment && (
          <div className="rule-t mt-4 pt-3">
            <p className="text-xs text-muted-foreground mb-1">Latest synced comment:</p>
            <p className="text-sm line-clamp-2">{data.lastComment.text}</p>
            <p className="text-xs text-muted-foreground mt-1">
              by @{data.lastComment.author_username} on {data.lastComment.platform}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
