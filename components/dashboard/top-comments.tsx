"use client"

import { useState } from "react"
import { Heart, ThumbsUp, ThumbsDown, Minus, ExternalLink, Instagram, Music2, Facebook, Trophy, TrendingUp, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { getTopComments, getTopPositiveReviews, getTopNegativeReviews, type Comment, type Sentiment } from "@/lib/comments-data"
import { type DateRange } from "@/components/dashboard/date-filter"
import { useSegmentation } from "@/components/dashboard/segmentation-filter"

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 text-xs font-medium capitalize",
        sentiment === "positive" && "bg-positive/10 text-positive hover:bg-positive/20",
        sentiment === "neutral" && "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20",
        sentiment === "negative" && "bg-negative/10 text-negative hover:bg-negative/20"
      )}
    >
      {sentiment === "positive" && <ThumbsUp className="h-3 w-3" />}
      {sentiment === "neutral" && <Minus className="h-3 w-3" />}
      {sentiment === "negative" && <ThumbsDown className="h-3 w-3" />}
      {sentiment}
    </Badge>
  )
}

function TopCommentCard({ comment, rank }: { comment: Comment; rank: number }) {
  const truncatedText = comment.text.length > 250 
    ? comment.text.slice(0, 250) + "..." 
    : comment.text

  return (
    <div className={cn(
      "group rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-md relative",
      comment.sentiment === "negative" && "border-negative/30 bg-negative/5",
      comment.sentiment === "positive" && "border-positive/30 bg-positive/5",
      comment.sentiment === "neutral" && "border-border/50"
    )}>
      {/* Rank Badge */}
      <div className={cn(
        "absolute -top-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-md",
        rank === 1 && "bg-yellow-500",
        rank === 2 && "bg-gray-400",
        rank === 3 && "bg-amber-600",
        rank > 3 && "bg-primary"
      )}>
        {rank}
      </div>

      <div className="flex items-start gap-3 pt-1">
        <Avatar className="h-9 w-9">
          <AvatarImage src={comment.profilePicUrl} alt={comment.username} />
          <AvatarFallback className="text-xs">
            {comment.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">@{comment.username}</span>
{comment.platform === "instagram" ? (
  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E4405F]/10">
  <Instagram className="h-2.5 w-2.5 text-[#E4405F]" />
  </div>
  ) : comment.platform === "tiktok" ? (
  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#00f2ea]/10">
    <Music2 className="h-2.5 w-2.5 text-[#00f2ea]" />
  </div>
) : (
  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1877F2]/10">
    <Facebook className="h-2.5 w-2.5 text-[#1877F2]" />
  </div>
)}
            </div>
            <div className="flex items-center gap-2">
              {/* Likes Count */}
              <div className="flex items-center gap-1 text-sm font-medium text-rose-500">
                <Heart className="h-4 w-4 fill-current" />
                <span>{comment.likes.toLocaleString()}</span>
              </div>
              <SentimentBadge sentiment={comment.sentiment} />
            </div>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {truncatedText}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <Badge variant="outline" className="text-xs font-normal">
              {comment.product}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 opacity-0 transition-opacity group-hover:opacity-100"
              asChild
            >
              <a href={comment.postUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                View Post
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface TopCommentsProps {
  platformFilter?: ("instagram" | "tiktok" | "facebook")[]
  dateRange?: DateRange
}

export function TopComments({ platformFilter, dateRange }: TopCommentsProps) {
  const [activeTab, setActiveTab] = useState<"all" | "positive" | "negative">("all")
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  // Filter comments based on platform filter
  const commentFilter = platformFilter?.filter(
    (p): p is "instagram" | "tiktok" | "facebook" => p === "instagram" || p === "tiktok" || p === "facebook"
  )
  const { segmentation } = useSegmentation()

  // Filter to TikTok only and limit to 10
  const tiktokFilter: ("tiktok")[] = ["tiktok"]
  const topComments = getTopComments(10, tiktokFilter, dateRange, segmentation)
  const topPositive = getTopPositiveReviews(10, tiktokFilter, dateRange, segmentation)
  const topNegative = getTopNegativeReviews(10, tiktokFilter, dateRange, segmentation)
  
  const displayedComments = activeTab === "all" 
    ? topComments 
    : activeTab === "positive" 
      ? topPositive 
      : topNegative

  // Calculate stats
  const totalLikesFromTop = topComments.reduce((sum, c) => sum + c.likes, 0)
  const avgLikes = topComments.length > 0 ? Math.round(totalLikesFromTop / topComments.length) : 0

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top 10 TikTok Comments
            </CardTitle>
            <CardDescription>
              Most engaging TikTok comments ranked by likes
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Avg: <span className="font-semibold text-foreground">{avgLikes}</span> likes</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 px-2 gap-1"
            >
              {isCollapsed ? (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Expand
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Collapse
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="pt-0">
          {/* Quick Stats */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xl font-bold text-foreground">{topComments.length}</p>
              <p className="text-xs text-muted-foreground">Top TikTok</p>
            </div>
            <div className="rounded-lg bg-positive/10 p-3 text-center">
              <p className="text-xl font-bold text-positive">{topPositive.length}</p>
              <p className="text-xs text-muted-foreground">Top Positive</p>
            </div>
            <div className="rounded-lg bg-negative/10 p-3 text-center">
              <p className="text-xl font-bold text-negative">{topNegative.length}</p>
              <p className="text-xs text-muted-foreground">Top Negative</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mb-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" className="gap-1.5">
                <Trophy className="h-3.5 w-3.5" />
                All Top
              </TabsTrigger>
              <TabsTrigger value="positive" className="text-positive data-[state=active]:text-positive gap-1.5">
                <ThumbsUp className="h-3.5 w-3.5" />
                Top Positive
              </TabsTrigger>
              <TabsTrigger value="negative" className="text-negative data-[state=active]:text-negative gap-1.5">
                <ThumbsDown className="h-3.5 w-3.5" />
                Top Negative
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Comments List */}
          <div className="mb-2 text-xs text-muted-foreground">
            Showing {displayedComments.length} top TikTok comments by likes
          </div>
          <ScrollArea className="h-[550px] pr-4">
            <div className="flex flex-col gap-4">
              {displayedComments.length > 0 ? (
                displayedComments.map((comment, index) => (
                  <TopCommentCard key={comment.id} comment={comment} rank={index + 1} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Trophy className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No comments with likes found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Comments with engagement will appear here
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  )
}
