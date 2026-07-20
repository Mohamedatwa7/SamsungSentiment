"use client"

import { Activity, Heart, MessageSquare, Play, ThumbsUp, Zap } from "lucide-react"

import { formatCompact, formatRate, type UnpackedPayload } from "@/lib/unpacked-data"

// Overall campaign KPIs — total views, likes, comments, engagement count and
// the blended engagement rate across every tracked influencer video.
export function UnpackedKPIs({ data }: { data: UnpackedPayload }) {
  const { totals } = data
  const totalSentiment =
    totals.sentiment.positive + totals.sentiment.neutral + totals.sentiment.negative
  const positivePercent =
    totalSentiment > 0 ? Math.round((totals.sentiment.positive / totalSentiment) * 100) : 0

  const kpis = [
    {
      title: "Total Views",
      value: formatCompact(totals.views),
      subValue: `${totals.videos} videos · ${totals.influencers} influencers`,
      icon: Play,
    },
    {
      title: "Total Likes",
      value: formatCompact(totals.likes),
      subValue: `Avg ${formatCompact(totals.videos > 0 ? Math.round(totals.likes / totals.videos) : 0)} per video`,
      icon: Heart,
    },
    {
      title: "Total Comments",
      value: formatCompact(totals.comments),
      subValue: `${formatCompact(totals.scrapedComments)} scraped for sentiment`,
      icon: MessageSquare,
    },
    {
      title: "Engagement Count",
      value: formatCompact(totals.engagements),
      subValue: "Likes + comments + shares",
      icon: Zap,
    },
    {
      title: "Total Engagement Rate",
      value: formatRate(totals.engagementRate),
      subValue: "Engagements ÷ views, all videos",
      icon: Activity,
    },
    {
      title: "Positive Sentiment",
      value: `${positivePercent}%`,
      subValue: `${formatCompact(totals.sentiment.positive)} positive comments`,
      icon: ThumbsUp,
    },
  ]

  return (
    <div className="rule-t stat-rail grid grid-cols-1 gap-y-8 pt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <div
          key={kpi.title}
          className="flex min-w-0 flex-col gap-1.5 px-5 first:pl-0 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          <p className="section-label flex items-center gap-1.5 truncate">
            <kpi.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            {kpi.title}
          </p>
          <p className="kpi-value text-3xl truncate">{kpi.value}</p>
          <p className="text-xs text-muted-foreground">{kpi.subValue}</p>
        </div>
      ))}
    </div>
  )
}
