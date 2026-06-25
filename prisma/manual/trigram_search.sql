-- Trigram search acceleration for TheBlogSphere
-- ------------------------------------------------------------------
-- The Explore search uses case-insensitive `contains` (ILIKE '%term%') on
-- Blog.title and Blog.content. Plain b-tree indexes can't serve leading
-- wildcards, so those queries do sequential scans. pg_trgm GIN indexes make
-- them fast WITHOUT any code change — the existing Prisma query just gets
-- quicker as the table grows.
--
-- Apply once, after `npx prisma migrate deploy`, against your database:
--   psql "$DATABASE_URL" -f prisma/manual/trigram_search.sql
-- (CREATE INDEX CONCURRENTLY can't run in a txn; run as-is, not inside BEGIN.)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS blog_title_trgm_idx
  ON "Blog" USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS blog_content_trgm_idx
  ON "Blog" USING gin (content gin_trgm_ops);
