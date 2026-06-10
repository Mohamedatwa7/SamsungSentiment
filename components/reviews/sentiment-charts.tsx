"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import type { SentimentMetrics } from "@/lib/reviews-data"

interface SentimentChartsProps {
  metrics: SentimentMetrics
}

export function SentimentCharts({ metrics }: SentimentChartsProps) {
  const data = [
    { name: "Positive", value: metrics.positive, color: "#22c55e" },
    { name: "Neutral", value: metrics.neutral, color: "#6b7280" },
    { name: "Negative", value: metrics.negative, color: "#ef4444" }
  ]
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sentiment Distribution</CardTitle>
        <CardDescription>
          Breakdown of review sentiments based on ratings and content analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [value.toLocaleString(), "Reviews"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px"
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-positive">{metrics.positivePercent.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Positive</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">{metrics.neutralPercent.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Neutral</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-negative">{metrics.negativePercent.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Negative</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
