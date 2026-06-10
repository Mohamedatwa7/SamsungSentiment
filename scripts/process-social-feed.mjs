/**
 * Process Samsung Gulf social media posts for the Social Feed
 * Sources: Twitter/X, Instagram, Facebook scraped data + TikTok from comments
 */

import fs from "fs"
import path from "path"

const TWITTER_URL = "https://blobs.vusercontent.net/blob/dataset_tweet-scraper_2026-04-28_12-22-37-231-EliwknILu3CIawqKstILgpn6qPziXw.json"
const INSTAGRAM_URL = "https://blobs.vusercontent.net/blob/dataset_instagram-post-scraper_2026-04-28_12-10-57-943%20%282%29-DawBgK7mbTxGEjIQa7CklJp3QZOlLl.json"
const FACEBOOK_URL = "https://blobs.vusercontent.net/blob/dataset_facebook-posts-scraper_2026-04-28_12-45-04-535-ATxdOhFGtCuLS7dbS6EnBKvTucZJdx.json"
const TIKTOK_URL = "https://blobs.vusercontent.net/blob/dataset_tiktok-scraper_2026-04-29_06-54-55-487-pxZ2O2qpsDepyEoRuFrlRFXgOekjU6.json"

async function fetchJson(url) {
  console.log(`Fetching: ${url.slice(0, 80)}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json()
}

function processTwitterPosts(data) {
  console.log(`Processing ${data.length} Twitter posts...`)
  
  return data
    .filter(post => post.text && post.createdAt)
    .map((post, idx) => ({
      id: post.id || `twitter-${idx}`,
      platform: "twitter",
      author: {
        name: "Samsung Gulf",
        username: "SamsungGulf",
        avatar: "/avatars/samsung-gulf.png",
        verified: true,
      },
      content: post.text,
      timestamp: new Date(post.createdAt).toISOString(),
      engagement: {
        likes: post.likeCount || 0,
        comments: post.replyCount || 0,
        shares: post.retweetCount || 0,
        views: post.likeCount * 10 || 0,
      },
      media: [],
      url: post.twitterUrl || post.url || `https://twitter.com/SamsungGulf/status/${post.id}`,
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

function processInstagramPosts(data) {
  console.log(`Processing ${data.length} Instagram posts...`)
  
  return data
    .filter(post => post.caption || post.displayUrl)
    .map((post, idx) => ({
      id: post.id || post.shortCode || `instagram-${idx}`,
      platform: "instagram",
      author: {
        name: post.ownerFullName || "Samsung Gulf",
        username: post.ownerUsername || "samsunggulf",
        avatar: "/avatars/samsung-gulf.png",
        verified: true,
      },
      content: post.caption || "",
      timestamp: post.timestamp ? new Date(post.timestamp).toISOString() : new Date().toISOString(),
      engagement: {
        likes: post.likesCount || 0,
        comments: post.commentsCount || 0,
        shares: 0,
        views: post.videoViewCount || post.videoPlayCount || 0,
      },
      media: post.displayUrl ? [{
        type: post.type === "Video" || post.isVideo ? "video" : "image",
        url: post.displayUrl,
      }] : [],
      url: post.url || `https://www.instagram.com/p/${post.shortCode}/`,
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

function processFacebookPosts(data) {
  console.log(`Processing ${data.length} Facebook posts...`)
  
  return data
    .filter(post => post.text || post.postText || post.media?.length > 0)
    .map((post, idx) => ({
      id: post.postId || post.id || `facebook-${idx}`,
      platform: "facebook",
      author: {
        name: post.pageName || post.user?.name || "Samsung Gulf",
        username: "SamsungGulf",
        avatar: post.pageProfilePictureUrl || "/avatars/samsung-gulf.png",
        verified: true,
      },
      content: post.text || post.postText || "",
      timestamp: post.time ? new Date(post.time).toISOString() : new Date().toISOString(),
      engagement: {
        likes: post.likes || post.likesCount || 0,
        comments: post.comments || post.commentsCount || 0,
        shares: post.shares || post.sharesCount || 0,
        views: post.views || 0,
      },
      media: (post.media || []).map(m => ({
        type: m.type || "image",
        url: m.url || m.thumbnail || m.photo_image?.uri || "",
      })).filter(m => m.url),
      url: post.postUrl || post.url || `https://facebook.com/${post.postId}`,
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

function processTikTokPosts(data) {
  console.log(`Processing ${data.length} TikTok posts...`)
  
  return data
    .filter(post => post.webVideoUrl && post.text)
    .map((post, idx) => {
      // Extract video ID from URL
      const videoIdMatch = post.webVideoUrl?.match(/video\/(\d+)/)
      const videoId = videoIdMatch ? videoIdMatch[1] : `tiktok-${idx}`
      
      return {
        id: videoId,
        platform: "tiktok",
        author: {
          name: post["authorMeta.name"] || "Samsung Gulf",
          username: post["authorMeta.name"] || "samsunggulf",
          avatar: post["authorMeta.avatar"] || "/avatars/samsung-gulf.png",
          verified: true,
        },
        content: post.text || "",
        timestamp: post.createTimeISO ? new Date(post.createTimeISO).toISOString() : new Date().toISOString(),
        engagement: {
          likes: post.diggCount || 0,
          comments: post.commentCount || 0,
          shares: post.shareCount || 0,
          views: post.playCount || 0,
        },
        media: [],
        url: post.webVideoUrl,
      }
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

async function main() {
  console.log("=== Processing Samsung Gulf Social Feed Data ===\n")
  
  // Fetch all data in parallel
  const [twitterData, instagramData, facebookData, tiktokData] = await Promise.all([
    fetchJson(TWITTER_URL),
    fetchJson(INSTAGRAM_URL),
    fetchJson(FACEBOOK_URL),
    fetchJson(TIKTOK_URL),
  ])
  
  // Process each platform
  const twitterPosts = processTwitterPosts(twitterData)
  const instagramPosts = processInstagramPosts(instagramData)
  const facebookPosts = processFacebookPosts(facebookData)
  const tiktokPosts = processTikTokPosts(tiktokData)
  
  // Write to data files
  const dataDir = path.join(process.cwd(), "data")
  
  fs.writeFileSync(
    path.join(dataDir, "twitter-posts.json"),
    JSON.stringify(twitterPosts, null, 2)
  )
  console.log(`\nWrote ${twitterPosts.length} Twitter posts`)
  
  fs.writeFileSync(
    path.join(dataDir, "instagram-posts.json"),
    JSON.stringify(instagramPosts, null, 2)
  )
  console.log(`Wrote ${instagramPosts.length} Instagram posts`)
  
  fs.writeFileSync(
    path.join(dataDir, "facebook-posts.json"),
    JSON.stringify(facebookPosts, null, 2)
  )
  console.log(`Wrote ${facebookPosts.length} Facebook posts`)
  
  fs.writeFileSync(
    path.join(dataDir, "tiktok-posts.json"),
    JSON.stringify(tiktokPosts, null, 2)
  )
  console.log(`Wrote ${tiktokPosts.length} TikTok posts`)
  
  console.log("\n=== Social Feed Processing Complete ===")
  console.log(`Total posts: ${twitterPosts.length + instagramPosts.length + facebookPosts.length + tiktokPosts.length}`)
}

main().catch(console.error)
