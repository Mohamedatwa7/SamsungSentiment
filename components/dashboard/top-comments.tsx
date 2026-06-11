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
      variant="outline"
      className={cn(
        "gap-1 bg-transparent text-xs font-medium capitalize",
        sentiment === "positive" && "border-positive/40 text-positive",
        sentiment === "neutral" && "border-border text-muted-foreground",
        sentiment === "negative" && "border-negative/40 text-negative"
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
      "group border-b border-border/70 py-4 px-0 transition-colors last:border-0 hover:bg-muted/40",
      comment.sentiment === "negative" && "border-l-2 border-l-negative pl-4",
      comment.sentiment === "positive" && "border-l-2 border-l-positive pl-4",
    )}>
      <div className="flex items-start gap-3">
        {/* Rank */}
        <div className="kpi-value w-6 shrink-0 pt-1 text-right text-lg text-muted-foreground tabular-nums">
          {rank}
        </div>
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
  <div className="flex h-4 w-4 items-center justify-center">
  <Instagram className="h-3 w-3 text-muted-foreground" />
  </div>
  ) : comment.platform === "tiktok" ? (
  <div className="flex h-4 w-4 items-center justify-center">
    <Music2 className="h-3 w-3 text-muted-foreground" />
  </div>
) : (
  <div className="flex h-4 w-4 items-center justify-center">
    <Facebook className="h-3 w-3 text-muted-foreground" />
  </div>
)}
            </div>
            <div className="flex items-center gap-2">
              {/* Likes Count */}
              <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground tabular-nums">
                <Heart className="h-3.5 w-3.5" />
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
            {comment.postUrl ? (
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
            ) : null}
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

  // Honor the page-level platform filter; default to all comment platforms.
  const effectiveFilter: ("instagram" | "tiktok" | "facebook")[] =
    commentFilter && commentFilter.length > 0 ? commentFilter : ["instagram", "tiktok", "facebook"]
  const topComments = getTopComments(10, effectiveFilter, dateRange, segmentation)
  const topPositive = getTopPositiveReviews(10, effectiveFilter, dateRange, segmentation)
  const topNegative = getTopNegativeReviews(10, effectiveFilter, dateRange, segmentation)
  
  const displayedComments = activeTab === "all" 
    ? topComments 
    : activeTab === "positive" 
      ? topPositive 
      : topNegative

  // Calculate stats
  const totalLikesFromTop = topComments.reduce((sum, c) => sum + c.likes, 0)
  const avgLikes = topComments.length > 0 ? Math.round(totalLikesFromTop / topComments.length) : 0

  return (
    <Card className="animate-in fade-in duration-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              Top 10 Comments
            </CardTitle>
            <CardDescription>
              Most engaging comments ranked by likes
              {effectiveFilter.length < 3 && <> · {effectiveFilter.join(", ")}</>}
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
          <div className="stat-rail divide-none mb-4 grid grid-cols-3 text-center">
            <div className="py-1">
              <p className="kpi-value text-3xl text-foreground">{topComments.length}</p>
              <p className="section-label mt-1">Top TikTok</p>
            </div>
            <div className="py-1">
              <p className="kpi-value text-3xl text-positive">{topPositive.length}</p>
              <p className="section-label mt-1">Top Positive</p>
            </div>
            <div className="py-1">
              <p className="kpi-value text-3xl text-negative">{topNegative.length}</p>
              <p className="section-label mt-1">Top Negative</p>
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
          <ScrollArea className="nice-scroll h-[550px] pr-4">
            <div className="flex flex-col">
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
