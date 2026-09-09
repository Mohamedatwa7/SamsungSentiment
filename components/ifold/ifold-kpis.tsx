"use client"

import { Flame, MessageSquare, Play, Scale, ThumbsDown, ThumbsUp } from "lucide-react"

import {
  computeIFoldTotals,
  formatCompactNum,
  type IFoldComment,
  type IFoldPost,
} from "@/lib/ifold-data"

// Top stat rail — how big the iPhone Fold conversation is and how it's going
// for Apple, at a glance.
export function IFoldKPIs({ posts, comments }: { posts: IFoldPost[]; comments: IFoldComment[] }) {
  const totals = computeIFoldTotals(posts, comments)
  const scored = totals.sentiment.positive + totals.sentiment.neutral + totals.sentiment.negative
  const positivePct = scored > 0 ? Math.round((totals.sentiment.positive / scored) * 100) : 0
  const negativePct = scored > 0 ? Math.round((totals.sentiment.negative / scored) * 100) : 0
  const leans = totals.samsungLeans + totals.appleLeans
  const samsungLeanPct = leans > 0 ? Math.round((totals.samsungLeans / leans) * 100) : 0

  const kpis = [
    {
      title: "Buzz Tracked",
      value: formatCompactNum(totals.posts),
      subValue: `${formatCompactNum(totals.socialPosts)} social · ${formatCompactNum(totals.newsArticles)} news`,
      icon: Flame,
    },
    {
      title: "Total Views",
      value: formatCompactNum(totals.views),
      subValue: `${formatCompactNum(totals.engagements)} engagements`,
      icon: Play,
    },
    {
      title: "Reactions Scored",
      value: formatCompactNum(scored),
      subValue: `${formatCompactNum(totals.analyzedComments)} of ${formatCompactNum(totals.scrapedComments)} comments analyzed`,
      icon: MessageSquare,
    },
    {
      title: "Positive on iPhone Fold",
      value: `${positivePct}%`,
      subValue: `${formatCompactNum(totals.sentiment.positive)} positive reactions`,
      icon: ThumbsUp,
    },
    {
      title: "Negative on iPhone Fold",
      value: `${negativePct}%`,
      subValue: `${formatCompactNum(totals.sentiment.negative)} critical reactions`,
      icon: ThumbsDown,
    },
    {
      title: "Comparisons Favor Samsung",
      value: leans > 0 ? `${samsungLeanPct}%` : "—",
      subValue: `${formatCompactNum(totals.samsungLeans)} vs ${formatCompactNum(totals.appleLeans)} favoring Apple`,
      icon: Scale,
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
