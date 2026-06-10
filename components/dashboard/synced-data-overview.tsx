"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageSquare, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

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
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
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
    instagram: "bg-pink-500",
    tiktok: "bg-black",
    facebook: "bg-blue-600",
    twitter: "bg-sky-500",
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
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
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-3xl font-bold">{data.counts.posts}</div>
            <div className="text-sm text-muted-foreground">Synced Posts</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-3xl font-bold">{data.counts.comments}</div>
            <div className="text-sm text-muted-foreground">Synced Comments</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-medium">Comments by Platform</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.platformBreakdown).map(([platform, count]) => (
              <Badge 
                key={platform} 
                variant="secondary"
                className={`${platformColors[platform] || "bg-gray-500"} text-white`}
              >
                {platform}: {count}
              </Badge>
            ))}
          </div>
        </div>
        
        {data.lastComment && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
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
