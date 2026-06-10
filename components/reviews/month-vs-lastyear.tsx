"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CountUp } from "@/components/ui/count-up"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ArrowUp, ArrowDown, Minus, Calendar, ChevronDown, Filter, X } from "lucide-react"
import { 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend
} from "recharts"
import type { AnalyzedReview } from "@/lib/reviews-data"
import { getMonthVsLastYearComparison, getWeekVsLastYearComparison, modelVariantPairs } from "@/lib/reviews-data"

interface MonthVsLastYearProps {
  allReviews: AnalyzedReview[]
}

const monthOptions = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]

function ChangeIndicator({ value, suffix = "%", inverse = false }: { value: number; suffix?: string; inverse?: boolean }) {
  const isPositive = inverse ? value < 0 : value > 0
  const isNegative = inverse ? value > 0 : value < 0
  
  if (isPositive) {
    return (
      <span className="flex items-center gap-0.5 text-positive text-sm font-medium">
        <ArrowUp className="h-3 w-3" />
        +{Math.abs(value).toFixed(1)}{suffix}
      </span>
    )
  } else if (isNegative) {
    return (
      <span className="flex items-center gap-0.5 text-negative text-sm font-medium">
        <ArrowDown className="h-3 w-3" />
        -{Math.abs(value).toFixed(1)}{suffix}
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

export function MonthVsLastYear({ allReviews }: MonthVsLastYearProps) {
  const [selectedVariant, setSelectedVariant] = useState<string>("all")
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])
  
  // Get available months from data
  const availableMonths = useMemo(() => {
    const s26Months = new Set<number>()
    allReviews
      .filter(r => r.productLine.includes("S26"))
      .forEach(r => s26Months.add(r.month))
    return Array.from(s26Months).sort((a, b) => a - b)
  }, [allReviews])
  
  // Toggle month selection
  const toggleMonth = (month: number) => {
    setSelectedMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month]
    )
  }
  
  const clearMonths = () => setSelectedMonths([])
  const selectAllMonths = () => setSelectedMonths([...availableMonths])
  
  // Get labels and filtered comparisons based on selected variant
  const { comparisons, s26Label, s25Label, s26Model, s25Model } = useMemo(() => {
    if (selectedVariant === "all") {
      return {
        comparisons: getMonthVsLastYearComparison(allReviews),
        s26Label: "S26 Series",
        s25Label: "S25 Series",
        s26Model: undefined,
        s25Model: undefined
      }
    }
    
    const pair = modelVariantPairs.find(p => p.label === selectedVariant)
    if (!pair) {
      return {
        comparisons: getMonthVsLastYearComparison(allReviews),
        s26Label: "S26 Series",
        s25Label: "S25 Series",
        s26Model: undefined,
        s25Model: undefined
      }
    }
    
    return {
      comparisons: getMonthVsLastYearComparison(allReviews, pair.s26, pair.s25),
      s26Label: pair.s26,
      s25Label: pair.s25,
      s26Model: pair.s26,
      s25Model: pair.s25
    }
  }, [selectedVariant, allReviews])
  
  // Get Week on Week comparison
  const weekComparisons = useMemo(() => {
    return getWeekVsLastYearComparison(allReviews, selectedMonths, s26Model, s25Model)
  }, [allReviews, selectedMonths, s26Model, s25Model])

  // Prepare chart data with proper year labels
  const chartData = comparisons.map(c => ({
    month: `${c.monthName}`,
    s26Positive: Math.round(c.s26.positivePercent),
    s25Positive: Math.round(c.s25.positivePercent),
    change: c.change.positive
  }))
  
  // Prepare Week on Week chart data
  const weekChartData = weekComparisons.map(w => ({
    week: `${w.monthName.slice(0, 3)} W${w.week}`,
    s26Positive: Math.round(w.s26.positivePercent),
    s25Positive: Math.round(w.s25.positivePercent),
    s26Reviews: w.s26.total,
    s25Reviews: w.s25.total
  }))
  
  // Summary metrics
  const totalS26 = comparisons.reduce((sum, c) => sum + c.s26.total, 0)
  const totalS25 = comparisons.reduce((sum, c) => sum + c.s25.total, 0)
  const avgS26Positive = comparisons.length > 0 
    ? comparisons.reduce((sum, c) => sum + c.s26.positivePercent, 0) / comparisons.length 
    : 0
  const avgS25Positive = comparisons.length > 0 
    ? comparisons.reduce((sum, c) => sum + c.s25.positivePercent, 0) / comparisons.length 
    : 0

  return (
    <div className="grid gap-6">
      {/* Model Variant Filter */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold">Compare Model Variants (MoM)</h3>
              <p className="text-sm text-muted-foreground">Compare same month: S26 (2026) vs S25 (2025)</p>
            </div>
            <Select value={selectedVariant} onValueChange={setSelectedVariant}>
              <SelectTrigger className="w-[220px] border-2 border-primary/50 bg-background">
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
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="accent-top hover-lift animate-in fade-in slide-in-from-bottom-2 duration-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-label">{s26Label} Total</p>
                <CountUp value={totalS26} className="kpi-value text-3xl" />
              </div>
              <Badge className="bg-primary">2026</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="accent-top hover-lift animate-in fade-in slide-in-from-bottom-2 duration-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-label">{s25Label} Total</p>
                <CountUp value={totalS25} className="kpi-value text-3xl" />
              </div>
              <Badge variant="secondary">2025</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="accent-top hover-lift animate-in fade-in slide-in-from-bottom-2 duration-500">
          <CardContent className="p-4">
            <div className="flex flex-col gap-1">
              <p className="section-label">Volume Change</p>
              <div className="flex items-center gap-2">
                <CountUp
                  value={totalS26 - totalS25}
                  format={(v) => `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString()}`}
                  className="kpi-value text-3xl"
                />
                <ChangeIndicator value={totalS25 > 0 ? ((totalS26 - totalS25) / totalS25) * 100 : 0} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="accent-top hover-lift animate-in fade-in slide-in-from-bottom-2 duration-500">
          <CardContent className="p-4">
            <div className="flex flex-col gap-1">
              <p className="section-label">Avg Positive Change</p>
              <div className="flex items-center gap-2">
                <CountUp value={avgS26Positive} format={(v) => `${v.toFixed(1)}%`} className="kpi-value text-3xl" />
                <ChangeIndicator value={avgS26Positive - avgS25Positive} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Positive Sentiment Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Month vs Last Year: Positive Sentiment
          </CardTitle>
          <CardDescription>
            {s26Label} (2026) vs {s25Label} (2025) - Same month comparison
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value}
                />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value}%`,
                    name
                  ]}
                  labelFormatter={(label) => `${label}`}
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
                <Line type="monotone" dataKey="s26Positive" name={`${s26Label} (2026)`} stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="s25Positive" name={`${s25Label} (2025)`} stroke="#94a3b8" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Week on Week Line Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Week-over-Week: Positive Sentiment
              </CardTitle>
              <CardDescription>
                {s26Label} (2026) vs {s25Label} (2025) - Weekly trend comparison
              </CardDescription>
            </div>
            
            {/* Month Filter for Chart */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="min-w-[200px] justify-between gap-2 border-2 border-primary/50"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    <span>
                      {selectedMonths.length === 0 
                        ? "All Months" 
                        : `${selectedMonths.length} Month${selectedMonths.length > 1 ? "s" : ""}`}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="end">
                <div className="border-b p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Filter Months</h4>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={selectAllMonths} className="h-6 text-xs px-2">
                        All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearMonths} className="h-6 text-xs px-2">
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="max-h-[250px] overflow-y-auto nice-scroll p-2">
                  {monthOptions
                    .filter(m => availableMonths.includes(m.value))
                    .map(month => (
                    <label
                      key={month.value}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
                    >
                      <Checkbox 
                        checked={selectedMonths.includes(month.value)}
                        onCheckedChange={() => toggleMonth(month.value)}
                      />
                      <span className="text-sm">{month.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {selectedMonths.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">Showing:</span>
              {selectedMonths.sort((a, b) => a - b).map(month => (
                <Badge key={`chart-${month}`} variant="secondary" className="gap-1 py-0.5 text-xs">
                  {monthOptions.find(m => m.value === month)?.label}
                  <button onClick={() => toggleMonth(month)} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {weekChartData.length === 0 ? (
            <div className="flex h-[350px] items-center justify-center text-muted-foreground">
              {selectedMonths.length === 0 
                ? "Select months above to view week-over-week trend"
                : "No data available for selected months"}
            </div>
          ) : (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weekChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="week"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value}%`, name]}
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
                  <Line type="monotone" dataKey="s26Positive" name={`${s26Label} (2026)`} stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="s25Positive" name={`${s25Label} (2025)`} stroke="#94a3b8" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Week on Week Comparison Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Week on Week Details
              </CardTitle>
              <CardDescription>
                {s26Label} Week X (2026) vs {s25Label} Week X (2025) - Same week of month comparison
              </CardDescription>
            </div>
            
            {/* Month Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="min-w-[200px] justify-between gap-2 border-2 border-primary/50"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    <span>
                      {selectedMonths.length === 0 
                        ? "All Months" 
                        : `${selectedMonths.length} Month${selectedMonths.length > 1 ? "s" : ""}`}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="end">
                <div className="border-b p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Filter Months</h4>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={selectAllMonths} className="h-6 text-xs px-2">
                        All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearMonths} className="h-6 text-xs px-2">
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="max-h-[250px] overflow-y-auto nice-scroll p-2">
                  {monthOptions
                    .filter(m => availableMonths.includes(m.value))
                    .map(month => (
                    <label
                      key={month.value}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
                    >
                      <Checkbox 
                        checked={selectedMonths.includes(month.value)}
                        onCheckedChange={() => toggleMonth(month.value)}
                      />
                      <span className="text-sm">{month.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Selected months badges */}
          {selectedMonths.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">Showing:</span>
              {selectedMonths.sort((a, b) => a - b).map(month => (
                <Badge key={month} variant="secondary" className="gap-1 py-0.5 text-xs">
                  {monthOptions.find(m => m.value === month)?.label}
                  <button onClick={() => toggleMonth(month)} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto nice-scroll">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left font-medium">Week</th>
                  <th className="pb-3 text-center font-medium" colSpan={2}>Reviews</th>
                  <th className="pb-3 text-center font-medium" colSpan={2}>Positive %</th>
                  <th className="pb-3 text-center font-medium" colSpan={2}>Avg Rating</th>
                  <th className="pb-3 text-center font-medium">Change</th>
                </tr>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2"></th>
                  <th className="pb-2 text-center">{s26Label.replace(" Series", "")} &apos;26</th>
                  <th className="pb-2 text-center">{s25Label.replace(" Series", "")} &apos;25</th>
                  <th className="pb-2 text-center">{s26Label.replace(" Series", "")} &apos;26</th>
                  <th className="pb-2 text-center">{s25Label.replace(" Series", "")} &apos;25</th>
                  <th className="pb-2 text-center">{s26Label.replace(" Series", "")} &apos;26</th>
                  <th className="pb-2 text-center">{s25Label.replace(" Series", "")} &apos;25</th>
                  <th className="pb-2 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {weekComparisons.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      {selectedMonths.length === 0 
                        ? "Select months to view week-by-week comparison"
                        : "No data available for selected months"}
                    </td>
                  </tr>
                ) : (
                  weekComparisons.map((w, idx) => (
                    <tr key={`${w.month}-${w.week}-${idx}`} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                      <td className="py-3 font-medium">
                        {w.monthName} Week {w.week}
                      </td>
                      <td className="py-3 text-center font-medium">{w.s26.total.toLocaleString()}</td>
                      <td className="py-3 text-center text-muted-foreground">{w.s25.total.toLocaleString()}</td>
                      <td className="py-3 text-center">
                        <span className="text-positive font-medium">{w.s26.positivePercent.toFixed(1)}%</span>
                      </td>
                      <td className="py-3 text-center text-muted-foreground">{w.s25.positivePercent.toFixed(1)}%</td>
                      <td className="py-3 text-center font-medium">{w.s26.averageRating.toFixed(2)}</td>
                      <td className="py-3 text-center text-muted-foreground">{w.s25.averageRating.toFixed(2)}</td>
                      <td className="py-3">
                        <div className="flex justify-center">
                          <ChangeIndicator value={w.change.brandHealth} suffix=" pts" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Month-by-Month Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Month-by-Month Comparison Details</CardTitle>
          <CardDescription>
            {s26Label} Feb 2026 vs {s25Label} Feb 2025, {s26Label} Mar 2026 vs {s25Label} Mar 2025, etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto nice-scroll">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left font-medium">Month Comparison</th>
                  <th className="pb-3 text-center font-medium" colSpan={2}>Reviews</th>
                  <th className="pb-3 text-center font-medium" colSpan={2}>Positive %</th>
                  <th className="pb-3 text-center font-medium" colSpan={2}>Avg Rating</th>
                  <th className="pb-3 text-center font-medium">Health Change</th>
                </tr>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2"></th>
                  <th className="pb-2 text-center">{s26Label.replace(" Series", "")} &apos;26</th>
                  <th className="pb-2 text-center">{s25Label.replace(" Series", "")} &apos;25</th>
                  <th className="pb-2 text-center">{s26Label.replace(" Series", "")} &apos;26</th>
                  <th className="pb-2 text-center">{s25Label.replace(" Series", "")} &apos;25</th>
                  <th className="pb-2 text-center">{s26Label.replace(" Series", "")} &apos;26</th>
                  <th className="pb-2 text-center">{s25Label.replace(" Series", "")} &apos;25</th>
                  <th className="pb-2 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((c) => (
                  <tr key={c.month} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                    <td className="py-3 font-medium">
                      {c.monthName} 2026 vs {c.monthName} 2025
                    </td>
                    <td className="py-3 text-center font-medium">{c.s26.total.toLocaleString()}</td>
                    <td className="py-3 text-center text-muted-foreground">{c.s25.total.toLocaleString()}</td>
                    <td className="py-3 text-center">
                      <span className="text-positive font-medium">{c.s26.positivePercent.toFixed(1)}%</span>
                    </td>
                    <td className="py-3 text-center text-muted-foreground">{c.s25.positivePercent.toFixed(1)}%</td>
                    <td className="py-3 text-center font-medium">{c.s26.averageRating.toFixed(2)}</td>
                    <td className="py-3 text-center text-muted-foreground">{c.s25.averageRating.toFixed(2)}</td>
                    <td className="py-3">
                      <div className="flex justify-center">
                        <ChangeIndicator value={c.change.brandHealth} suffix=" pts" />
                      </div>
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
