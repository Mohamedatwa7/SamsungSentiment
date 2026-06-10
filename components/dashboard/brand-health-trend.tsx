"use client"

import { useMemo, useState } from "react"
import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { type CommentPlatform, type Segmentation } from "@/lib/comments-data"
import { useDashboardData } from "@/contexts/dashboard-data-context"
import { calculateWeeklyBrandHealth } from "@/lib/brand-health"
import { type DateRange } from "@/components/dashboard/date-filter"
import { useSegmentation } from "@/components/dashboard/segmentation-filter"
import { cn } from "@/lib/utils"

interface BrandHealthTrendProps {
  platformFilter?: CommentPlatform[]
  dateRange?: DateRange
}

type WeekRange = "4" | "8" | "12" | "all"

export function BrandHealthTrend({ platformFilter, dateRange }: BrandHealthTrendProps) {
  const { segmentation } = useSegmentation()
  const { getFilteredComments } = useDashboardData()
  const [weekRange, setWeekRange] = useState<WeekRange>("12")
  
  const allWeeklyData = useMemo(() => {
    const comments = getFilteredComments(platformFilter, dateRange, segmentation)
    return calculateWeeklyBrandHealth(comments)
  }, [getFilteredComments, platformFilter, dateRange, segmentation])

  // Filter to show only the selected number of recent weeks
  const weeklyData = useMemo(() => {
    if (weekRange === "all") return allWeeklyData
    const numWeeks = parseInt(weekRange)
    return allWeeklyData.slice(-numWeeks)
  }, [allWeeklyData, weekRange])

  // Calculate week-on-week change
  const currentWeek = weeklyData[weeklyData.length - 1]
  const previousWeek = weeklyData[weeklyData.length - 2]
  
  const weekChange = currentWeek && previousWeek 
    ? currentWeek.score - previousWeek.score 
    : null
  
  const averageScore = weeklyData.length > 0 
    ? Math.round(weeklyData.reduce((sum, w) => sum + w.score, 0) / weeklyData.length)
    : 50

  // Format data for chart
  const chartData = weeklyData.map(w => ({
    ...w,
    // Add color coding based on score
    fill: w.score >= 70 ? "oklch(0.65 0.18 150)" : w.score >= 50 ? "oklch(0.7 0.15 85)" : "oklch(0.6 0.2 30)"
  }))

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Comment Health Trend</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Week-on-week comment health score based on sentiment analysis
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {/* Week range selector */}
            <Select value={weekRange} onValueChange={(v) => setWeekRange(v as WeekRange)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">Last 4 weeks</SelectItem>
                <SelectItem value="8">Last 8 weeks</SelectItem>
                <SelectItem value="12">Last 12 weeks</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            {weekChange !== null && (
              <Badge 
                variant="outline" 
                className={cn(
                  "flex items-center gap-1",
                  weekChange > 0 ? "border-positive text-positive" :
                  weekChange < 0 ? "border-negative text-negative" : "border-muted-foreground"
                )}
              >
                {weekChange > 0 ? <TrendingUp className="h-3 w-3" /> :
                 weekChange < 0 ? <TrendingDown className="h-3 w-3" /> :
                 <Minus className="h-3 w-3" />}
                <span>
                  {weekChange > 0 ? "+" : ""}{weekChange} pts vs last week
                </span>
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {weeklyData.length > 1 ? (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis 
                  dataKey="weekLabel" 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0].payload
                    return (
                      <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md text-popover-foreground">
                        <p className="text-sm font-medium">Week of {data.weekStart}</p>
                        <p className="kpi-value text-2xl">{data.score}</p>
                        <p className="text-xs text-muted-foreground">
                          Based on {data.commentCount.toLocaleString()} comments
                        </p>
                      </div>
                    )
                  }}
                />
                <ReferenceLine 
                  y={averageScore} 
                  stroke="oklch(0.6 0.1 250)" 
                  strokeDasharray="5 5"
                  label={{ 
                    value: `Avg: ${averageScore}`, 
                    position: "right",
                    fontSize: 10,
                    fill: "oklch(0.6 0.1 250)"
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="oklch(0.6 0.2 250)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Not enough data to show weekly trends. Need at least 2 weeks of comments.
            </p>
          </div>
        )}
        
        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
          <div className="text-center">
            <p className="kpi-value text-2xl">{weeklyData.length}</p>
            <p className="text-xs text-muted-foreground">Weeks tracked</p>
          </div>
          <div className="text-center">
            <p className="kpi-value text-2xl">{averageScore}</p>
            <p className="text-xs text-muted-foreground">Average score</p>
          </div>
          <div className="text-center">
            <p className="kpi-value text-2xl">
              {currentWeek?.score ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">Current week</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
