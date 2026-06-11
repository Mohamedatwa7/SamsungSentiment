"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import type { SentimentMetrics } from "@/lib/reviews-data"

interface SentimentChartsProps {
  metrics: SentimentMetrics
}

export function SentimentCharts({ metrics }: SentimentChartsProps) {
  const data = [
    { name: "Positive", value: metrics.positive, color: "var(--positive)" },
    { name: "Neutral", value: metrics.neutral, color: "var(--neutral)" },
    { name: "Negative", value: metrics.negative, color: "var(--negative)" }
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
                stroke="none"
                dataKey="value"
                label={({ name, percent, x, y, textAnchor }) => (
                  <text x={x} y={y} textAnchor={textAnchor} fill="var(--muted-foreground)" fontSize={11}>
                    {`${name} ${(percent * 100).toFixed(0)}%`}
                  </text>
                )}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [value.toLocaleString(), "Reviews"]}
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--popover-foreground)",
                  fontSize: "12px",
                  padding: "8px 12px",
                  boxShadow: "none"
                }}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: "12px", color: "var(--muted-foreground)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Stats */}
        <div className="rule-t stat-rail mt-4 grid grid-cols-3 pt-4">
          <div className="px-5 first:pl-0">
            <div className="kpi-value text-3xl text-positive">{metrics.positivePercent.toFixed(1)}%</div>
            <div className="section-label">Positive</div>
          </div>
          <div className="px-5 first:pl-0">
            <div className="kpi-value text-3xl text-muted-foreground">{metrics.neutralPercent.toFixed(1)}%</div>
            <div className="section-label">Neutral</div>
          </div>
          <div className="px-5 first:pl-0">
            <div className="kpi-value text-3xl text-negative">{metrics.negativePercent.toFixed(1)}%</div>
            <div className="section-label">Negative</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
