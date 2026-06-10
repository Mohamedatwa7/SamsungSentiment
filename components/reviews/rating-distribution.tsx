"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Star } from "lucide-react"

interface RatingDistributionProps {
  distribution: { rating: string; count: number; percentage: number }[]
}

export function RatingDistribution({ distribution }: RatingDistributionProps) {
  const getColor = (rating: string) => {
    if (rating.includes("5")) return "bg-positive"
    if (rating.includes("4")) return "bg-positive/70"
    if (rating.includes("3")) return "bg-warning"
    if (rating.includes("2")) return "bg-negative/70"
    return "bg-negative"
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating Distribution</CardTitle>
        <CardDescription>
          Breakdown of star ratings across all reviews
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {distribution.map((item) => (
            <div key={item.rating} className="flex items-center gap-4">
              <div className="flex w-20 items-center gap-1">
                <Star className="h-4 w-4 fill-warning text-warning" />
                <span className="text-sm font-medium">{item.rating.replace(" Star", "")}</span>
              </div>
              <div className="flex-1">
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${getColor(item.rating)}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-right">
                <span className="text-sm font-medium">{item.percentage}%</span>
              </div>
              <div className="w-20 text-right">
                <span className="text-xs text-muted-foreground">{item.count.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Summary */}
        <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-muted/50 p-4">
          <Star className="h-6 w-6 fill-warning text-warning" />
          <span className="text-lg font-bold">
            {distribution.length > 0 
              ? (distribution.reduce((acc, d) => acc + (parseInt(d.rating) * d.count), 0) / 
                 distribution.reduce((acc, d) => acc + d.count, 0)).toFixed(1)
              : "0"
            }
          </span>
          <span className="text-sm text-muted-foreground">Average Rating</span>
        </div>
      </CardContent>
    </Card>
  )
}
