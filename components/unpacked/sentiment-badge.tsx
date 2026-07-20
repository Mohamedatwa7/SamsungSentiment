import { ThumbsUp, ThumbsDown, Minus } from "lucide-react"

import { cn } from "@/lib/utils"
import type { UnpackedSentiment } from "@/lib/unpacked-data"

export function SentimentBadge({ sentiment, className }: { sentiment: UnpackedSentiment; className?: string }) {
  const config = {
    positive: { icon: ThumbsUp, label: "Positive", classes: "bg-positive/10 text-positive" },
    negative: { icon: ThumbsDown, label: "Negative", classes: "bg-negative/10 text-negative" },
    neutral: { icon: Minus, label: "Neutral", classes: "bg-white/[0.06] text-muted-foreground" },
  }[sentiment]
  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        config.classes,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}

// Thin three-segment positive/neutral/negative distribution bar.
export function SentimentBar({
  positive,
  neutral,
  negative,
  className,
}: {
  positive: number
  neutral: number
  negative: number
  className?: string
}) {
  const total = positive + neutral + negative
  if (total === 0) {
    return <div className={cn("h-1.5 w-full rounded-full bg-white/[0.06]", className)} />
  }
  return (
    <div className={cn("flex h-1.5 w-full gap-px overflow-hidden rounded-full", className)}>
      {positive > 0 && <div className="bg-positive" style={{ width: `${(positive / total) * 100}%` }} />}
      {neutral > 0 && <div className="bg-white/[0.15]" style={{ width: `${(neutral / total) * 100}%` }} />}
      {negative > 0 && <div className="bg-negative" style={{ width: `${(negative / total) * 100}%` }} />}
    </div>
  )
}
