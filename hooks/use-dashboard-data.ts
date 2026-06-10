"use client"

import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then(res => res.json())

export interface Post {
  id: string
  platform: string
  url: string
  caption: string
  mediaType: string
  mediaUrl?: string
  likes: number
  comments: number
  shares: number
  views: number
  createdAt: string
  department: string
  productCategory: string
  productModel: string
  features: string[]
}

export interface Comment {
  id: string
  postId: string
  platform: string
  text: string
  username: string
  createdAt: string
  sentiment: "positive" | "negative" | "neutral"
  sentimentFlags: string[]
  likes: number
  language: string
  features: string[]
}

export interface DashboardData {
  posts: Post[]
  comments: Comment[]
  meta: {
    generatedAt: string
    totals: {
      posts: number
      comments: number
    }
  }
}

export function useDashboardData() {
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    "/api/dashboard/data",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  )

  return {
    posts: data?.posts || [],
    comments: data?.comments || [],
    meta: data?.meta,
    isLoading,
    error,
    refresh: mutate,
  }
}
