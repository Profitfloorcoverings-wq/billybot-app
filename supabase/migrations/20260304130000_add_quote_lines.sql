-- Add lines jsonb column to quotes table for custom (line-item) quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lines jsonb;
