"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getRecentPostsWithSentiment, type CommentPlatform } from "@/lib/comments-data"
import { MessageSquare, ThumbsUp, ThumbsDown, Minus, ExternalLink, Calendar } from "lucide-react"

interface RecentPostsProps {
  platformFilter?: ("instagram" | "tiktok")[]
}

export function RecentPosts({ platformFilter }: RecentPostsProps) {
  // Filter to only comment platforms
  const commentFilter = platformFilter?.filter(
    (p): p is CommentPlatform => p === "instagram" || p === "tiktok"
  )
  
  const recentPosts = useMemo(() => getRecentPostsWithSentiment(7, commentFilter), [commentFilter])
  
  if (recentPosts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Posts (Last 7 Days)</CardTitle>
          <CardDescription>Posts from Instagram and TikTok with comment sentiment</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">No posts found in the last 7 days</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Posts (Last 7 Days)</CardTitle>
            <CardDescription>Posts from Instagram and TikTok with comment sentiment analysis</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {recentPosts.length} posts
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentPosts.map((post) => (
            <div key={post.id} className="rounded-lg border p-4">
              {/* Post Header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    post.platform === "tiktok" 
                      ? "bg-black text-white dark:bg-white dark:text-black" 
                      : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                  }`}>
                    {post.platform === "tiktok" ? "TikTok" : "Instagram"}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(post.latestCommentDate).toLocaleDateString()}
                  </span>
                </div>
                <a 
                  href={post.postUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View Post <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              
              {/* Caption */}
              {post.caption && (
                <p className="text-sm text-foreground mb-3 line-clamp-2" dir="auto">{post.caption}</p>
              )}
              
              {/* Sentiment Stats */}
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1 text-sm">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{post.totalComments}</span>
                  <span className="text-muted-foreground">comments</span>
                </div>
                
                <div className="flex items-center gap-3 ml-auto">
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-600">{post.positivePercent}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Minus className="h-3.5 w-3.5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-500">{post.neutralPercent}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThumbsDown className="h-3.5 w-3.5 text-rose-600" />
                    <span className="text-sm font-medium text-rose-600">{post.negativePercent}%</span>
                  </div>
                </div>
              </div>
              
              {/* Sentiment Bar */}
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-emerald-500" 
                  style={{ width: `${post.positivePercent}%` }} 
                />
                <div 
                  className="h-full bg-gray-400" 
                  style={{ width: `${post.neutralPercent}%` }} 
                />
                <div 
                  className="h-full bg-rose-500" 
                  style={{ width: `${post.negativePercent}%` }} 
                />
              </div>
              
              {/* Sample Comments */}
              {post.sampleComments.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Sample comments:</p>
                  {post.sampleComments.map((comment, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-start gap-2 text-xs p-2 rounded ${
                        comment.sentiment === "positive" 
                          ? "bg-emerald-50 dark:bg-emerald-900/10"
                          : comment.sentiment === "negative"
                          ? "bg-rose-50 dark:bg-rose-900/10"
                          : "bg-muted/50"
                      }`}
                    >
                      <span className={`shrink-0 mt-0.5 ${
                        comment.sentiment === "positive" 
                          ? "text-emerald-600"
                          : comment.sentiment === "negative"
                          ? "text-rose-600"
                          : "text-gray-500"
                      }`}>
                        {comment.sentiment === "positive" && <ThumbsUp className="h-3 w-3" />}
                        {comment.sentiment === "negative" && <ThumbsDown className="h-3 w-3" />}
                        {comment.sentiment === "neutral" && <Minus className="h-3 w-3" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">@{comment.username}: </span>
                        <span className="text-foreground" dir="auto">{comment.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
