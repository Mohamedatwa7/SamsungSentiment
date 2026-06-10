"use client"

import { MessageCircle, ThumbsUp, Share2, FileText, Play } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getProcessedDashboardData, type Platform } from "@/lib/social-data"

interface KPICardProps {
  title: string
  value: string
  subValue?: string
  icon: React.ReactNode
  iconColor?: string
}

interface KPICardsProps {
  platformFilter?: Platform[]
}

function KPICard({ title, value, subValue, icon, iconColor }: KPICardProps) {
  return (
    <Card className="relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <p className="section-label">{title}</p>
            <p className="kpi-value text-3xl">{value}</p>
            {subValue && (
              <p className="text-sm text-muted-foreground">{subValue}</p>
            )}
          </div>
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl",
            iconColor || "bg-primary/10 text-primary"
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function KPICards({ platformFilter }: KPICardsProps) {
  const data = getProcessedDashboardData(platformFilter)
  const { kpiMetrics } = data
  
  const platformCount = platformFilter?.length || 4

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toLocaleString()
  }

  const kpis: KPICardProps[] = [
    {
      title: "Total Posts",
      value: kpiMetrics.totalPosts.toString(),
      subValue: `Across ${platformCount} platform${platformCount !== 1 ? 's' : ''}`,
      icon: <FileText className="h-6 w-6" />,
      iconColor: "bg-blue-500/10 text-blue-500",
    },
    {
      title: "Total Likes",
      value: formatNumber(kpiMetrics.totalLikes),
      subValue: `Avg ${kpiMetrics.avgLikesPerPost} per post`,
      icon: <ThumbsUp className="h-6 w-6" />,
      iconColor: "bg-positive/10 text-positive",
    },
    {
      title: "Total Comments",
      value: formatNumber(kpiMetrics.totalComments),
      subValue: `Avg ${kpiMetrics.avgCommentsPerPost} per post`,
      icon: <MessageCircle className="h-6 w-6" />,
      iconColor: "bg-amber-500/10 text-amber-500",
    },
    {
      title: "Total Views",
      value: formatNumber(kpiMetrics.totalViews),
      subValue: "TikTok video views",
      icon: <Play className="h-6 w-6" />,
      iconColor: "bg-purple-500/10 text-purple-500",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KPICard key={kpi.title} {...kpi} />
      ))}
    </div>
  )
}
