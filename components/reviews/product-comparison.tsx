"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CountUp } from "@/components/ui/count-up"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ArrowUp, ArrowDown, Minus, TrendingUp, Star, ThumbsUp, ThumbsDown, CalendarIcon, Rocket } from "lucide-react"
import { format } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import type { SentimentMetrics, AnalyzedReview } from "@/lib/reviews-data"
import { calculateSentimentMetrics, modelVariantPairs } from "@/lib/reviews-data"
import { useMemo, useState } from "react"

interface ProductComparisonProps {
  s26Metrics: SentimentMetrics
  s25Metrics: SentimentMetrics
  allReviews: AnalyzedReview[]
}

function ChangeIndicator({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value > 0) {
    return (
      <span className="flex items-center gap-0.5 text-positive text-sm font-medium">
        <ArrowUp className="h-3 w-3" />
        +{value.toFixed(1)}{suffix}
      </span>
    )
  } else if (value < 0) {
    return (
      <span className="flex items-center gap-0.5 text-negative text-sm font-medium">
        <ArrowDown className="h-3 w-3" />
        {value.toFixed(1)}{suffix}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-0.5 text-muted-foreground text-sm">
      <Minus className="h-3 w-3" />
      0{suffix}
    </span>
  )
}

// Launch dates
const S26_LAUNCH_DATE = new Date(2026, 2, 11) // March 11, 2026
const S25_LAUNCH_DATE = new Date(2025, 1, 7)  // February 7, 2025

export function ProductComparison({ s26Metrics, s25Metrics, allReviews }: ProductComparisonProps) {
  const [selectedVariant, setSelectedVariant] = useState<string>("all")
  
  // Date range states for S26 and S25 separately
  const [s26DateRange, setS26DateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  })
  const [s25DateRange, setS25DateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  })
  
  // Filter reviews by date range
  const filterByDateRange = (reviews: AnalyzedReview[], dateRange: { from: Date | undefined; to: Date | undefined }) => {
    if (!dateRange.from && !dateRange.to) return reviews
    return reviews.filter(r => {
      const reviewDate = r.parsedDate
      if (dateRange.from && reviewDate < dateRange.from) return false
      if (dateRange.to && reviewDate > dateRange.to) return false
      return true
    })
  }

  // Calculate metrics based on selected variant and date ranges
  const { currentMetrics, previousMetrics, s26Label, s25Label } = useMemo(() => {
    let s26Reviews = allReviews.filter(r => r.productLine.includes("S26"))
    let s25Reviews = allReviews.filter(r => r.productLine.includes("S25"))
    
    // Apply variant filter
    if (selectedVariant !== "all") {
      const pair = modelVariantPairs.find(p => p.label === selectedVariant)
      if (pair) {
        s26Reviews = allReviews.filter(r => r.productLine === pair.s26)
        s25Reviews = allReviews.filter(r => r.productLine === pair.s25)
      }
    }
    
    // Apply date range filters
    s26Reviews = filterByDateRange(s26Reviews, s26DateRange)
    s25Reviews = filterByDateRange(s25Reviews, s25DateRange)
    
    const pair = selectedVariant !== "all" ? modelVariantPairs.find(p => p.label === selectedVariant) : null
    
    return {
      currentMetrics: calculateSentimentMetrics(s26Reviews),
      previousMetrics: calculateSentimentMetrics(s25Reviews),
      s26Label: pair ? pair.s26 : "S26 Series",
      s25Label: pair ? pair.s25 : "S25 Series"
    }
  }, [selectedVariant, allReviews, s26DateRange, s25DateRange])
  
  // Calculate metrics for each model variant
  const modelComparison = useMemo(() => {
    const models = ["S26 Ultra", "S26+", "S26", "S25 Ultra", "S25+", "S25"]
    return models.map(model => {
      const reviews = allReviews.filter(r => r.productLine === model)
      const metrics = calculateSentimentMetrics(reviews)
      return {
        model,
        reviews: metrics.total,
        positive: metrics.positivePercent,
        neutral: metrics.neutralPercent,
        negative: metrics.negativePercent,
        avgRating: metrics.averageRating,
        brandHealth: metrics.brandHealthScore
      }
    }).filter(m => m.reviews > 0)
  }, [allReviews])
  
  const chartData = modelComparison.map(m => ({
    name: m.model,
    Positive: Math.round(m.positive),
    Neutral: Math.round(m.neutral),
    Negative: Math.round(m.negative)
  }))
  
  // Calculate YoY changes
  const changes = {
    positive: currentMetrics.positivePercent - previousMetrics.positivePercent,
    neutral: currentMetrics.neutralPercent - previousMetrics.neutralPercent,
    negative: currentMetrics.negativePercent - previousMetrics.negativePercent,
    brandHealth: currentMetrics.brandHealthScore - previousMetrics.brandHealthScore,
    avgRating: currentMetrics.averageRating - previousMetrics.averageRating
  }
  
  return (
    <div className="grid gap-6">
      {/* Filters Section */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Model Variant Filter */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">Compare Model Variants</h3>
                <p className="text-sm text-muted-foreground">Select specific S26 vs S25 model comparison</p>
              </div>
              <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                <SelectTrigger className="w-[200px] border-2 border-primary/50 bg-background">
                  <SelectValue placeholder="Select comparison" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All S26 vs All S25</SelectItem>
                  {modelVariantPairs.map(pair => (
                    <SelectItem key={pair.label} value={pair.label}>
                      {pair.s26} vs {pair.s25}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Date Range Filters */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Date Range Filters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* S26 Date Range */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary">S26 (2026)</Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Rocket className="h-3 w-3" />
                      Launch: Mar 11, 2026
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {s26DateRange.from ? format(s26DateRange.from, "MMM d, yyyy") : "From date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={s26DateRange.from}
                          onSelect={(date) => setS26DateRange(prev => ({ ...prev, from: date }))}
                          defaultMonth={S26_LAUNCH_DATE}
                          initialFocus
                        />
                        <div className="border-t p-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-xs"
                            onClick={() => setS26DateRange(prev => ({ ...prev, from: S26_LAUNCH_DATE }))}
                          >
                            <Rocket className="mr-1 h-3 w-3" /> Set to Launch Date (Mar 11)
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {s26DateRange.to ? format(s26DateRange.to, "MMM d, yyyy") : "To date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={s26DateRange.to}
                          onSelect={(date) => setS26DateRange(prev => ({ ...prev, to: date }))}
                          defaultMonth={S26_LAUNCH_DATE}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {(s26DateRange.from || s26DateRange.to) && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setS26DateRange({ from: undefined, to: undefined })}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* S25 Date Range */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">S25 (2025)</Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Rocket className="h-3 w-3" />
                      Launch: Feb 7, 2025
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {s25DateRange.from ? format(s25DateRange.from, "MMM d, yyyy") : "From date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={s25DateRange.from}
                          onSelect={(date) => setS25DateRange(prev => ({ ...prev, from: date }))}
                          defaultMonth={S25_LAUNCH_DATE}
                          initialFocus
                        />
                        <div className="border-t p-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-xs"
                            onClick={() => setS25DateRange(prev => ({ ...prev, from: S25_LAUNCH_DATE }))}
                          >
                            <Rocket className="mr-1 h-3 w-3" /> Set to Launch Date (Feb 7)
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {s25DateRange.to ? format(s25DateRange.to, "MMM d, yyyy") : "To date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={s25DateRange.to}
                          onSelect={(date) => setS25DateRange(prev => ({ ...prev, to: date }))}
                          defaultMonth={S25_LAUNCH_DATE}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {(s25DateRange.from || s25DateRange.to) && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setS25DateRange({ from: undefined, to: undefined })}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Active Date Filters Display */}
              {(s26DateRange.from || s26DateRange.to || s25DateRange.from || s25DateRange.to) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Active filters:</span>
                  {s26DateRange.from && (
                    <Badge variant="outline" className="gap-1">
                      S26 from {format(s26DateRange.from, "MMM d")}
                    </Badge>
                  )}
                  {s26DateRange.to && (
                    <Badge variant="outline" className="gap-1">
                      S26 to {format(s26DateRange.to, "MMM d")}
                    </Badge>
                  )}
                  {s25DateRange.from && (
                    <Badge variant="outline" className="gap-1">
                      S25 from {format(s25DateRange.from, "MMM d")}
                    </Badge>
                  )}
                  {s25DateRange.to && (
                    <Badge variant="outline" className="gap-1">
                      S25 to {format(s25DateRange.to, "MMM d")}
                    </Badge>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => {
                      setS26DateRange({ from: undefined, to: undefined })
                      setS25DateRange({ from: undefined, to: undefined })
                    }}
                  >
                    Clear all
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* YoY Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="accent-top hover-lift animate-in fade-in slide-in-from-bottom-2 duration-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-label">{s26Label} Reviews</p>
                <CountUp value={currentMetrics.total} className="kpi-value text-3xl" />
              </div>
              <Badge className="bg-primary">2026</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="accent-top hover-lift animate-in fade-in slide-in-from-bottom-2 duration-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-label">{s25Label} Reviews</p>
                <CountUp value={previousMetrics.total} className="kpi-value text-3xl" />
              </div>
              <Badge variant="secondary">2025</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="accent-top hover-lift animate-in fade-in slide-in-from-bottom-2 duration-500">
          <CardContent className="p-4">
            <div className="flex flex-col gap-1">
              <p className="section-label">Brand Health Change</p>
              <div className="flex items-center gap-2">
                <CountUp value={currentMetrics.brandHealthScore} format={(v) => `${Math.round(v)}`} className="kpi-value text-3xl" />
                <ChangeIndicator value={changes.brandHealth} suffix=" pts" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="accent-top hover-lift animate-in fade-in slide-in-from-bottom-2 duration-500">
          <CardContent className="p-4">
            <div className="flex flex-col gap-1">
              <p className="section-label">Rating Change</p>
              <div className="flex items-center gap-2">
                <CountUp value={currentMetrics.averageRating} format={(v) => v.toFixed(1)} className="kpi-value text-3xl" />
                <ChangeIndicator value={changes.avgRating} suffix="" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Comparison */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Sentiment by Model</CardTitle>
            <CardDescription>Comparison of sentiment distribution across product lines</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={80} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, ""]}
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--popover-foreground)",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgb(0 0 0 / 0.1)"
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Positive" stackId="a" fill="#22c55e" maxBarSize={48} />
                  <Bar dataKey="Neutral" stackId="a" fill="#6b7280" maxBarSize={48} />
                  <Bar dataKey="Negative" stackId="a" fill="#ef4444" maxBarSize={48} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* S26 vs S25 Table */}
        <Card>
          <CardHeader>
            <CardTitle>Year-over-Year Comparison</CardTitle>
            <CardDescription>{s26Label} vs {s25Label} performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 border-b pb-2 text-sm font-medium text-muted-foreground">
                <div>Metric</div>
                <div className="text-center">{s26Label.replace(" Series", "")}</div>
                <div className="text-center">{s25Label.replace(" Series", "")}</div>
                <div className="text-center">Change</div>
              </div>
              
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-positive" />
                  <span className="text-sm">Positive</span>
                </div>
                <div className="text-center font-medium">{currentMetrics.positivePercent.toFixed(1)}%</div>
                <div className="text-center font-medium">{previousMetrics.positivePercent.toFixed(1)}%</div>
                <div className="flex justify-center">
                  <ChangeIndicator value={changes.positive} />
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Neutral</span>
                </div>
                <div className="text-center font-medium">{currentMetrics.neutralPercent.toFixed(1)}%</div>
                <div className="text-center font-medium">{previousMetrics.neutralPercent.toFixed(1)}%</div>
                <div className="flex justify-center">
                  <ChangeIndicator value={changes.neutral} />
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-negative" />
                  <span className="text-sm">Negative</span>
                </div>
                <div className="text-center font-medium">{currentMetrics.negativePercent.toFixed(1)}%</div>
                <div className="text-center font-medium">{previousMetrics.negativePercent.toFixed(1)}%</div>
                <div className="flex justify-center">
                  <ChangeIndicator value={changes.negative} />
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4 items-center border-t pt-4">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm">Avg Rating</span>
                </div>
                <div className="text-center font-medium">{currentMetrics.averageRating.toFixed(2)}</div>
                <div className="text-center font-medium">{previousMetrics.averageRating.toFixed(2)}</div>
                <div className="flex justify-center">
                  <ChangeIndicator value={changes.avgRating} suffix="" />
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm">Brand Health</span>
                </div>
                <div className="text-center font-medium">{currentMetrics.brandHealthScore}</div>
                <div className="text-center font-medium">{previousMetrics.brandHealthScore}</div>
                <div className="flex justify-center">
                  <ChangeIndicator value={changes.brandHealth} suffix=" pts" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Model Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Model Performance Details</CardTitle>
          <CardDescription>Detailed sentiment metrics for each product model</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto nice-scroll">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left font-medium">Model</th>
                  <th className="pb-3 text-center font-medium">Reviews</th>
                  <th className="pb-3 text-center font-medium">Positive</th>
                  <th className="pb-3 text-center font-medium">Neutral</th>
                  <th className="pb-3 text-center font-medium">Negative</th>
                  <th className="pb-3 text-center font-medium">Avg Rating</th>
                  <th className="pb-3 text-center font-medium">Brand Health</th>
                </tr>
              </thead>
              <tbody>
                {modelComparison.map((model) => (
                  <tr key={model.model} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                    <td className="py-3 font-medium">{model.model}</td>
                    <td className="py-3 text-center">{model.reviews.toLocaleString()}</td>
                    <td className="py-3 text-center text-positive">{model.positive.toFixed(1)}%</td>
                    <td className="py-3 text-center text-muted-foreground">{model.neutral.toFixed(1)}%</td>
                    <td className="py-3 text-center text-negative">{model.negative.toFixed(1)}%</td>
                    <td className="py-3 text-center">{model.avgRating.toFixed(2)}</td>
                    <td className="py-3 text-center">
                      <Badge variant={model.brandHealth >= 70 ? "default" : model.brandHealth >= 50 ? "secondary" : "destructive"}>
                        {model.brandHealth}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
