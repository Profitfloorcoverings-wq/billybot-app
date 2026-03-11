-- Social media content queue for marketing automation
CREATE TABLE IF NOT EXISTS content_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'tiktok', 'youtube')),
  account_type text NOT NULL DEFAULT 'brand' CHECK (account_type IN ('brand', 'personal')),
  content_text text NOT NULL,
  media_urls jsonb DEFAULT '[]'::jsonb,
  hashtags text,
  pillar text CHECK (pillar IN (
    'pain_solution', 'demo', 'humor', 'social_proof', 'education',
    'build_in_public', 'founder_story', 'ai_hot_take', 'industry_insight', 'lessons'
  )),
  scheduled_for timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  published_at timestamptz,
  external_post_id text,
  engagement jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access" ON content_queue
  FOR ALL USING (client_id = auth.uid());

-- Index for the publisher workflow: find scheduled posts ready to go
CREATE INDEX idx_content_queue_scheduled
  ON content_queue (status, scheduled_for)
  WHERE status = 'scheduled';

-- Index for engagement tracking: recent published posts
CREATE INDEX idx_content_queue_published
  ON content_queue (status, published_at DESC)
  WHERE status = 'published';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_content_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_queue_updated_at
  BEFORE UPDATE ON content_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_content_queue_updated_at();
