// Fetch social data directly from Supabase
// This module provides server-side data fetching for the dashboard

import { createClient } from "@/lib/supabase/server"

export interface SupabasePost {
  id: number
  platform: string
  external_id: string
  post_url: string
  caption: string
  media_type: string
  media_url?: string
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  published_at: string
  scraped_at: string
  raw_data: Record<string, unknown>
}

export interface SupabaseComment {
  id: number
  platform: string
  external_id: string
  external_post_id: string
  text: string
  author_username: string
  author_display_name?: string
  likes_count: number
  replies_count: number
  published_at: string
  scraped_at: string
  raw_data: Record<string, unknown>
}

// Page size for paginated fetches (Supabase caps each request at 1000 rows by default)
const PAGE_SIZE = 1000

// Fetch all posts from Supabase (paginated to bypass the 1000-row limit)
export async function getSupabasePosts(): Promise<SupabasePost[]> {
  const supabase = await createClient()
  const allPosts: SupabasePost[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from("social_posts")
      .select("*")
      .order("published_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error("Error fetching posts from Supabase:", error)
      break
    }

    if (!data || data.length === 0) break
    allPosts.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return allPosts
}

// Fetch all comments from Supabase (paginated to bypass the 1000-row limit)
export async function getSupabaseComments(): Promise<SupabaseComment[]> {
  const supabase = await createClient()
  const allComments: SupabaseComment[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from("social_comments")
      .select("*")
      .order("published_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error("Error fetching comments from Supabase:", error)
      break
    }

    if (!data || data.length === 0) break
    allComments.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return allComments
}

// Get counts
export async function getSupabaseCounts(): Promise<{ posts: number; comments: number }> {
  const supabase = await createClient()
  
  const [postsResult, commentsResult] = await Promise.all([
    supabase.from("social_posts").select("id", { count: "exact", head: true }),
    supabase.from("social_comments").select("id", { count: "exact", head: true }),
  ])
  
  return {
    posts: postsResult.count || 0,
    comments: commentsResult.count || 0,
  }
}
