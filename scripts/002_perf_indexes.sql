-- Performance first aid after the Sep 10 launch-week outage.
--
-- Every pipeline reads rows by external_id prefix (ifold_%, unpacked_%,
-- roster_%): without a pattern index those are full-table scans, and after a
-- day of heavy upsert churn (bloat) they started exceeding the statement
-- timeout — 500s across every dashboard API.
--
-- Run in the Supabase SQL Editor. Run each statement SEPARATELY (vacuum
-- cannot run inside a transaction block).

create index if not exists idx_social_posts_external_id_pattern
  on social_posts (external_id text_pattern_ops);

create index if not exists idx_social_comments_external_id_pattern
  on social_comments (external_id text_pattern_ops);

vacuum (analyze) social_posts;

vacuum (analyze) social_comments;
