"use client"

import { Flame, MessageSquare, Scale, ThumbsDown, ThumbsUp } from "lucide-react"

import { formatCompactNum, type IFoldPost } from "@/lib/ifold-data"
import { byLean, bySentiment, type Reaction } from "@/lib/ifold-reactions"
import type { DrilldownState } from "@/components/ifold/drilldown"

// Top stat rail — every number is clickable and opens the reactions behind it.
export function IFoldKPIs({
  posts,
  reactions,
  onDrill,
}: {
  posts: IFoldPost[]
  reactions: Reaction[]
  onDrill: (state: DrilldownState) => void
}) {
  const scored = reactions.length
  const positive = bySentiment(reactions, "positive")
  const negative = bySentiment(reactions, "negative")
  const samsungLeans = byLean(reactions, "samsung")
  const appleLeans = byLean(reactions, "apple")
  const news = posts.filter((p) => p.kind === "news").length

  // Post titles as drillable items so "Buzz Tracked" opens something useful.
  const postItems: Reaction[] = posts.map((p) => ({
    id: p.id,
    text: p.title || "(no caption)",
    author: p.author,
    platform: p.platform,
    likes: p.likes,
    publishedAt: p.publishedAt,
    sentiment: p.analysis?.sentiment || "neutral",
    topics: p.analysis?.topics || [],
    lean: p.analysis?.lean || null,
    brand: "apple",
    url: p.url,
  }))

  const kpis = [
    {
      title: "Buzz Tracked",
      value: formatCompactNum(posts.length),
      subValue: `${formatCompactNum(posts.length - news)} social posts · ${formatCompactNum(news)} news articles`,
      icon: Flame,
      drill: { title: "All tracked posts & articles", items: postItems },
    },
    {
      title: "Reactions Scored",
      value: formatCompactNum(scored),
      subValue: "Comments, tweets & headlines analyzed",
      icon: MessageSquare,
      drill: { title: "All scored reactions", items: reactions },
    },
    {
      title: "Positive on iPhone Fold",
      value: scored > 0 ? `${Math.round((positive.length / scored) * 100)}%` : "—",
      subValue: `${formatCompactNum(positive.length)} positive reactions`,
      icon: ThumbsUp,
      drill: { title: "Positive on the iPhone Fold", items: positive },
    },
    {
      title: "Negative on iPhone Fold",
      value: scored > 0 ? `${Math.round((negative.length / scored) * 100)}%` : "—",
      subValue: `${formatCompactNum(negative.length)} critical reactions`,
      icon: ThumbsDown,
      drill: { title: "Critical of the iPhone Fold", items: negative },
    },
    {
      title: "Comparisons Favor Samsung",
      value:
        samsungLeans.length + appleLeans.length > 0
          ? `${Math.round((samsungLeans.length / (samsungLeans.length + appleLeans.length)) * 100)}%`
          : "—",
      subValue: `${formatCompactNum(samsungLeans.length)} for Samsung · ${formatCompactNum(appleLeans.length)} for Apple`,
      icon: Scale,
      drill: {
        title: "Comparisons favoring Samsung",
        subtitle: "Reactions saying the Galaxy Fold wins the match-up",
        items: samsungLeans,
      },
    },
  ]

  return (
    <div className="rule-t stat-rail grid grid-cols-1 gap-y-8 pt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <button
          key={kpi.title}
          type="button"
          onClick={() => onDrill(kpi.drill)}
          className="group flex min-w-0 flex-col gap-1.5 px-5 text-left first:pl-0 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          <p className="section-label flex items-center gap-1.5 truncate">
            <kpi.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            {kpi.title}
          </p>
          <p className="kpi-value text-3xl truncate transition-colors group-hover:text-accent">{kpi.value}</p>
          <p className="text-xs text-muted-foreground">{kpi.subValue}</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/80">
            Click to view ↗
          </p>
        </button>
      ))}
    </div>
  )
}
