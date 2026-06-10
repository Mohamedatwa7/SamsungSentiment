"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"
import { 
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts"
import type { AnalyzedReview } from "@/lib/reviews-data"
import { getQuarterVsLastYearComparisonFiltered, modelVariantPairs } from "@/lib/reviews-data"

interface TrendChartsProps {
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

export function TrendCharts({ allReviews }: TrendChartsProps) {
  const [selectedVariant, setSelectedVariant] = useState<string>("all")
  
  // Get labels and filtered comparisons based on selected variant
  const { quarterComparisons, s26Label, s25Label } = useMemo(() => {
    if (selectedVariant === "all") {
      return {
        quarterComparisons: getQuarterVsLastYearComparisonFiltered(allReviews),
        s26Label: "S26 Series",
        s25Label: "S25 Series"
      }
    }
    
    const pair = modelVariantPairs.find(p => p.label === selectedVariant)
    if (!pair) {
      return {
        quarterComparisons: getQuarterVsLastYearComparisonFiltered(allReviews),
        s26Label: "S26 Series",
        s25Label: "S25 Series"
      }
    }
    
    return {
      quarterComparisons: getQuarterVsLastYearComparisonFiltered(allReviews, pair.s26, pair.s25),
      s26Label: pair.s26,
      s25Label: pair.s25
    }
  }, [selectedVariant, allReviews])
  
  // Prepare quarterly chart data for S26 vs S25
  const quarterlyChartData = quarterComparisons.map(c => ({
    quarter: c.quarterName,
    s26Positive: Math.round(c.s26.positivePercent),
    s25Positive: Math.round(c.s25.positivePercent),
    s26Reviews: c.s26.total,
    s25Reviews: c.s25.total,
    s26BrandHealth: c.s26.brandHealthScore,
    s25BrandHealth: c.s25.brandHealthScore,
  }))
  
  return (
    <div className="grid gap-6">
      {/* Model Variant Filter */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold">Compare Model Variants (Trends)</h3>
              <p className="text-sm text-muted-foreground">QoQ: S26 (2026) vs S25 (2025)</p>
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
      
      {/* QoQ Positive Sentiment */}
      <Card>
        <CardHeader>
          <CardTitle>Quarter-over-Quarter: Positive Sentiment</CardTitle>
          <CardDescription>{s26Label} (2026) vs {s25Label} (2025)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={quarterlyChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="quarter" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
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
        </CardContent>
      </Card>
      
      {/* Quarterly Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Performance: {s26Label} vs {s25Label}</CardTitle>
          <CardDescription>Same quarter comparison (e.g., Q1 2026 vs Q1 2025)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto nice-scroll">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left font-medium">Quarter</th>
                  <th className="pb-3 text-center font-medium" colSpan={2}>Reviews</th>
                  <th className="pb-3 text-center font-medium" colSpan={2}>Positive %</th>
                  <th className="pb-3 text-center font-medium" colSpan={2}>Brand Health</th>
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
                {quarterComparisons.map((c) => (
                  <tr key={c.quarter} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                    <td className="py-3 font-medium">{c.quarterName} 2026 vs {c.quarterName} 2025</td>
                    <td className="py-3 text-center">{c.s26.total.toLocaleString()}</td>
                    <td className="py-3 text-center text-muted-foreground">{c.s25.total.toLocaleString()}</td>
                    <td className="py-3 text-center text-positive">{c.s26.positivePercent.toFixed(1)}%</td>
                    <td className="py-3 text-center text-muted-foreground">{c.s25.positivePercent.toFixed(1)}%</td>
                    <td className="py-3 text-center">
                      <Badge variant={c.s26.brandHealthScore >= 70 ? "default" : "secondary"}>
                        {c.s26.brandHealthScore}
                      </Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant="outline">{c.s25.brandHealthScore}</Badge>
                    </td>
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
