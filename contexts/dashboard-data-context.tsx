"use client"

import { createContext, useContext, ReactNode } from "react"
import useSWR from "swr"
import { type DateRange, isWithinDateRange } from "@/components/dashboard/date-filter"

// Types
export type Sentiment = "positive" | "negative" | "neutral"
export type CommentPlatform = "instagram" | "tiktok" | "facebook" | "twitter" | "youtube"
export type SentimentFlag = "product_issue" | "pricing_concern" | "service_mention" | "feature_request" | "competitor_mention"

export interface Comment {
  id: string
  platform: CommentPlatform
  text: string
  username: string
  postCaption?: string
  postUrl?: string
  sentiment: Sentiment
  sentimentFlags: SentimentFlag[]
  product: string
  productModel: string
  productCategory: string
  department: string
  features: string[]
  likes: number
  createdAt: string
  source?: "synced" | "static"
}

export interface NormalizedPost {
  id: string
  platform: CommentPlatform
  url: string
  caption: string
  owner: string
  timestamp: string
  likes: number
  views: number
  department: string
  productCategory: string
  productModel: string
  features: string[]
  source?: "synced" | "static"
}

export interface Segmentation {
  department?: string
  category?: string
  model?: string
  feature?: string
}

interface DashboardDataContextType {
  posts: NormalizedPost[]
  comments: Comment[]
  isLoading: boolean
  error: any
  meta: {
    staticPosts: number
    staticComments: number
    syncedPosts: number
    syncedComments: number
    totalPosts: number
    totalComments: number
  } | null
  // Helper functions
  getFilteredComments: (platformFilter?: CommentPlatform[], dateRange?: DateRange | null, segmentation?: Segmentation) => Comment[]
  getFilteredPosts: (platformFilter?: CommentPlatform[], dateRange?: DateRange | null) => NormalizedPost[]
  getCommentMetrics: (platformFilter?: CommentPlatform[], dateRange?: DateRange | null, segmentation?: Segmentation) => CommentMetrics
}

export interface CommentMetrics {
  total: number
  positive: number
  negative: number
  neutral: number
  positiveRate: number
  negativeRate: number
  neutralRate: number
  posNegRatio: number
  byPlatform: Record<CommentPlatform, { total: number; positive: number; negative: number; neutral: number }>
  flagCounts: Record<string, number>
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

const DashboardDataContext = createContext<DashboardDataContextType | null>(null)

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading } = useSWR("/api/comments", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // Cache for 1 minute
  })
  
  const posts: NormalizedPost[] = data?.posts || []
  const comments: Comment[] = data?.comments || []
  const meta = data?.meta || null
  
  // Build post lookup for comment enrichment
  const postById = new Map<string, NormalizedPost>()
  const postByUrl = new Map<string, NormalizedPost>()
  for (const p of posts) {
    postById.set(p.id, p)
    postByUrl.set(p.url, p)
  }
  
  // Enrich comments with post data
  const enrichedComments: Comment[] = comments.map(c => {
    const post = postById.get(c.postId) || postByUrl.get(c.postUrl || "")
    return {
      ...c,
      postCaption: post?.caption || c.postCaption || "",
      postUrl: post?.url || c.postUrl || "",
      department: post?.department || c.department || "Brand",
      productCategory: post?.productCategory || c.productCategory || "Other",
      productModel: post?.productModel || c.productModel || "General",
      // `product` must fall back to the comment's own productModel — comments
      // carry their own classification and rarely resolve to a stored post, so
      // without this fallback every comment collapses to "General" and the
      // Comment Health Index (which groups by `product`) gets stuck at 50.
      product: post?.productModel || c.productModel || c.product || "General",
    }
  })
  
  const getFilteredComments = (
    platformFilter?: CommentPlatform[],
    dateRange?: DateRange | null,
    segmentation?: Segmentation
  ): Comment[] => {
    let filtered = enrichedComments
    
    // Platform filter
    if (platformFilter && platformFilter.length > 0) {
      filtered = filtered.filter(c => platformFilter.includes(c.platform))
    }
    
    // Date filter
    if (dateRange) {
      filtered = filtered.filter(c => isWithinDateRange(c.createdAt, dateRange))
    }
    
    // Segmentation filter
    if (segmentation) {
      if (segmentation.department) {
        filtered = filtered.filter(c => c.department === segmentation.department)
      }
      if (segmentation.category) {
        filtered = filtered.filter(c => c.productCategory === segmentation.category)
      }
      if (segmentation.model) {
        filtered = filtered.filter(c => c.productModel === segmentation.model)
      }
      if (segmentation.feature) {
        filtered = filtered.filter(c => c.features?.includes(segmentation.feature!))
      }
    }
    
    return filtered
  }
  
  const getFilteredPosts = (
    platformFilter?: CommentPlatform[],
    dateRange?: DateRange | null
  ): NormalizedPost[] => {
    let filtered = posts
    
    if (platformFilter && platformFilter.length > 0) {
      filtered = filtered.filter(p => platformFilter.includes(p.platform))
    }
    
    if (dateRange) {
      filtered = filtered.filter(p => isWithinDateRange(p.timestamp, dateRange))
    }
    
    return filtered
  }
  
  const getCommentMetrics = (
    platformFilter?: CommentPlatform[],
    dateRange?: DateRange | null,
    segmentation?: Segmentation
  ): CommentMetrics => {
    const filtered = getFilteredComments(platformFilter, dateRange, segmentation)
    
    const total = filtered.length
    const positive = filtered.filter(c => c.sentiment === "positive").length
    const negative = filtered.filter(c => c.sentiment === "negative").length
    const neutral = filtered.filter(c => c.sentiment === "neutral").length
    
    const byPlatform: Record<CommentPlatform, { total: number; positive: number; negative: number; neutral: number }> = {
      instagram: { total: 0, positive: 0, negative: 0, neutral: 0 },
      tiktok: { total: 0, positive: 0, negative: 0, neutral: 0 },
      facebook: { total: 0, positive: 0, negative: 0, neutral: 0 },
      twitter: { total: 0, positive: 0, negative: 0, neutral: 0 },
      youtube: { total: 0, positive: 0, negative: 0, neutral: 0 },
    }
    
    for (const c of filtered) {
      if (byPlatform[c.platform]) {
        byPlatform[c.platform].total++
        byPlatform[c.platform][c.sentiment]++
      }
    }
    
    const flagCounts: Record<string, number> = {}
    for (const c of filtered) {
      for (const flag of c.sentimentFlags || []) {
        flagCounts[flag] = (flagCounts[flag] || 0) + 1
      }
    }
    
    return {
      total,
      positive,
      negative,
      neutral,
      positiveRate: total > 0 ? Math.round((positive / total) * 100) : 0,
      negativeRate: total > 0 ? Math.round((negative / total) * 100) : 0,
      neutralRate: total > 0 ? Math.round((neutral / total) * 100) : 0,
      posNegRatio: negative > 0 ? Math.round((positive / negative) * 100) / 100 : positive > 0 ? positive : 0,
      byPlatform,
      flagCounts,
    }
  }
  
  return (
    <DashboardDataContext.Provider value={{
      posts,
      comments: enrichedComments,
      isLoading,
      error,
      meta,
      getFilteredComments,
      getFilteredPosts,
      getCommentMetrics,
    }}>
      {children}
    </DashboardDataContext.Provider>
  )
}

// Default empty metrics for SSR and loading states
const defaultMetrics: CommentMetrics = {
  total: 0,
  positive: 0,
  negative: 0,
  neutral: 0,
  positiveRate: 0,
  negativeRate: 0,
  neutralRate: 0,
  posNegRatio: 0,
  byPlatform: {} as Record<CommentPlatform, { total: number; positive: number; negative: number; neutral: number }>,
  flagCounts: {},
}

// Default context value for SSR
const defaultContextValue: DashboardDataContextType = {
  posts: [],
  comments: [],
  isLoading: true,
  error: null,
  meta: null,
  getFilteredComments: () => [],
  getFilteredPosts: () => [],
  getCommentMetrics: () => defaultMetrics,
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext)
  // Return default values if context is not available (SSR)
  if (!context) {
    return defaultContextValue
  }
  return context
}
