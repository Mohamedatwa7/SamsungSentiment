-- Social Media Posts Table (Instagram, TikTok, Facebook, X/Twitter)
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'twitter')),
  post_id TEXT NOT NULL,
  post_url TEXT,
  post_type TEXT, -- 'image', 'video', 'reel', 'story', 'tweet', etc.
  caption TEXT,
  publish_date TIMESTAMPTZ,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2),
  author_username TEXT,
  author_followers INTEGER,
  hashtags TEXT[], -- Array of hashtags
  mentions TEXT[], -- Array of @mentions
  media_urls TEXT[], -- Array of image/video URLs
  raw_data JSONB, -- Store full raw response from Apify
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, post_id)
);

-- Social Media Comments Table
CREATE TABLE IF NOT EXISTS social_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'twitter')),
  comment_id TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  author_username TEXT,
  author_profile_url TEXT,
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  comment_date TIMESTAMPTZ,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  sentiment_score DECIMAL(3,2), -- -1.0 to 1.0
  product_mentioned TEXT, -- Which Samsung product is mentioned
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, comment_id)
);

-- Scrape Jobs Table (track Apify scraper runs)
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apify_run_id TEXT,
  platform TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  posts_scraped INTEGER DEFAULT 0,
  comments_scraped INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_publish_date ON social_posts(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_comments_post_id ON social_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_platform ON social_comments(platform);
CREATE INDEX IF NOT EXISTS idx_social_comments_sentiment ON social_comments(sentiment);
CREATE INDEX IF NOT EXISTS idx_social_comments_created_at ON social_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);

-- Enable Row Level Security (but allow public read for dashboard)
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

-- Allow public read access for dashboard
CREATE POLICY "Allow public read on social_posts" ON social_posts FOR SELECT USING (true);
CREATE POLICY "Allow public read on social_comments" ON social_comments FOR SELECT USING (true);
CREATE POLICY "Allow public read on scrape_jobs" ON scrape_jobs FOR SELECT USING (true);

-- Allow service role to insert/update (for webhook API)
CREATE POLICY "Allow service role insert on social_posts" ON social_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role update on social_posts" ON social_posts FOR UPDATE USING (true);
CREATE POLICY "Allow service role insert on social_comments" ON social_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role update on social_comments" ON social_comments FOR UPDATE USING (true);
CREATE POLICY "Allow service role all on scrape_jobs" ON scrape_jobs FOR ALL USING (true);
