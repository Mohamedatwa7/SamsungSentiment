"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RefreshCw, CheckCircle, XCircle, Clock, Database, Download } from "lucide-react"
import { cn } from "@/lib/utils"

interface SyncLog {
  id: string
  platform: string
  scraper_type: string
  status: string
  records_processed: number
  records_inserted: number
  records_updated: number
  error_message: string | null
  started_at: string
  completed_at: string | null
}

interface ApifyRun {
  id: string
  status: string
  startedAt: string
  finishedAt: string
  defaultDatasetId: string
}

interface SyncStatus {
  syncLogs: SyncLog[]
  postCounts: Record<string, number>
  apifyRuns: Record<string, ApifyRun[]>
  lastChecked: string
}

const PLATFORMS = [
  { id: "instagram", name: "Instagram", color: "bg-pink-500" },
  { id: "tiktok", name: "TikTok", color: "bg-black" },
  { id: "facebook", name: "Facebook", color: "bg-blue-600" },
  { id: "twitter", name: "X (Twitter)", color: "bg-sky-500" },
]

export default function AdminPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<any>(null)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/apify/sync")
      if (!res.ok) throw new Error("Failed to fetch status")
      const data = await res.json()
      setStatus(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch status")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const triggerSync = async () => {
    try {
      setSyncing(true)
      setSyncResult(null)
      const res = await fetch("/api/apify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual: true }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync")
      }
      
      setSyncResult(data)
      // Refresh status after sync
      setTimeout(fetchStatus, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync")
    } finally {
      setSyncing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "SUCCEEDED":
        return <Badge className="bg-emerald-500"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>
      case "failed":
      case "FAILED":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>
      case "started":
      case "RUNNING":
        return <Badge className="bg-amber-500"><Clock className="h-3 w-3 mr-1" /> Running</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  const totalPosts = status?.postCounts 
    ? Object.values(status.postCounts).reduce((sum, count) => sum + count, 0)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin - Apify Integration</h1>
          <p className="text-muted-foreground">
            Manage data sync between Apify scrapers and the dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={triggerSync} disabled={syncing}>
            <Download className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Sync All Data"}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {syncResult && (
        <Card className="border-emerald-500 bg-emerald-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-emerald-600">Sync Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {Object.entries(syncResult.results || {}).map(([platform, result]: [string, any]) => (
                <div key={platform} className="text-center">
                  <div className="font-semibold capitalize">{platform}</div>
                  <div className="text-2xl font-bold">{result.inserted || 0}</div>
                  <div className="text-xs text-muted-foreground">of {result.total || 0} processed</div>
                </div>
              ))}
            </div>
            {syncResult.dashboard && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2 text-emerald-600">Dashboard Updated</p>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold">New Posts</div>
                    <div className="text-xl font-bold">{syncResult.dashboard.newPosts}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">New Comments</div>
                    <div className="text-xl font-bold">{syncResult.dashboard.newComments}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">Total Posts</div>
                    <div className="text-xl font-bold">{syncResult.dashboard.totalPosts}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">Total Comments</div>
                    <div className="text-xl font-bold">{syncResult.dashboard.totalComments}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="apify">Apify Runs</TabsTrigger>
          <TabsTrigger value="logs">Sync Logs</TabsTrigger>
          <TabsTrigger value="setup">Setup Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalPosts}</div>
                <p className="text-xs text-muted-foreground">
                  Across all platforms in Supabase
                </p>
              </CardContent>
            </Card>
            
            {PLATFORMS.map((platform) => (
              <Card key={platform.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{platform.name}</CardTitle>
                  <div className={cn("h-3 w-3 rounded-full", platform.color)} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {status?.postCounts?.[platform.id] || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">posts synced</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="apify" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {PLATFORMS.map((platform) => (
              <Card key={platform.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className={cn("h-3 w-3 rounded-full", platform.color)} />
                    {platform.name} Runs
                  </CardTitle>
                  <CardDescription>Recent Apify actor runs</CardDescription>
                </CardHeader>
                <CardContent>
                  {status?.apifyRuns?.[platform.id]?.length ? (
                    <div className="space-y-3">
                      {status.apifyRuns[platform.id].slice(0, 3).map((run) => (
                        <div key={run.id} className="flex items-center justify-between text-sm border-b pb-2">
                          <div>
                            <div className="font-mono text-xs text-muted-foreground">{run.id}</div>
                            <div className="text-xs">{formatDate(run.startedAt)}</div>
                          </div>
                          {getStatusBadge(run.status)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent runs found</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>Recent data synchronization logs</CardDescription>
            </CardHeader>
            <CardContent>
              {status?.syncLogs?.length ? (
                <div className="space-y-3">
                  {status.syncLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between border-b pb-3">
                      <div>
                        <div className="font-medium capitalize">{log.platform} - {log.scraper_type}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(log.started_at)}
                          {log.completed_at && ` → ${formatDate(log.completed_at)}`}
                        </div>
                        {log.error_message && (
                          <div className="text-sm text-destructive mt-1">{log.error_message}</div>
                        )}
                      </div>
                      <div className="text-right">
                        {getStatusBadge(log.status)}
                        {log.status === "completed" && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {log.records_inserted} inserted / {log.records_processed} processed
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No sync logs yet. Click "Sync All Data" to start.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Setup</CardTitle>
              <CardDescription>How to connect Apify scrapers to this dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Your Scheduled Actors</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  The following actor IDs from your schedule are configured:
                </p>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
                  <div><span className="text-pink-500">Instagram:</span> nH2AHrwxeTRJoN5hX</div>
                  <div><span className="text-pink-500">Instagram Comments:</span> dIKFJ95TN8YclK2no</div>
                  <div><span className="text-black dark:text-white">TikTok:</span> Zk4NL09KuDccV11Z4</div>
                  <div><span className="text-blue-500">Facebook:</span> KoJrdxJCTtpon81KY</div>
                  <div><span className="text-sky-500">Twitter:</span> Fo9GoU5wC270BgcBr</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">How It Works</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Your Apify schedule runs daily</li>
                  <li>Each actor scrapes the latest posts from Samsung Gulf accounts</li>
                  <li>Click "Sync All Data" to pull the latest data from Apify datasets</li>
                  <li>Data is stored in Supabase and displayed in the Social Reviews Dashboard</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Automatic Sync (Optional)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Add a Vercel Cron job to automatically sync data daily:
                </p>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                  <div className="text-muted-foreground mb-2">// vercel.json</div>
                  <pre>{`{
  "crons": [{
    "path": "/api/apify/sync",
    "schedule": "0 1 * * *"
  }]
}`}</pre>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This runs the sync at 1:00 AM UTC daily (after your Apify schedule completes)
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Environment Variables</h3>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-1">
                  <div>APIFY_API_TOKEN=your_apify_token</div>
                  <div>CRON_SECRET=optional_secret_for_cron</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
