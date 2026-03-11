-- Marketing context: the AI marketing executive's brain
CREATE TABLE IF NOT EXISTS marketing_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'pain_point', 'messaging_angle', 'objection', 'desire',
    'competitor', 'brand_voice', 'founder_story', 'product_feature',
    'testimonial', 'stat', 'insight'
  )),
  title text NOT NULL,
  content text NOT NULL,
  tags text[] DEFAULT '{}',
  priority int DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  last_used_at timestamptz,
  use_count int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marketing_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner full access" ON marketing_context FOR ALL USING (client_id = auth.uid());

CREATE INDEX idx_marketing_context_category ON marketing_context (client_id, category, active);
CREATE INDEX idx_marketing_context_last_used ON marketing_context (client_id, last_used_at NULLS FIRST);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_marketing_context_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER marketing_context_updated_at
  BEFORE UPDATE ON marketing_context
  FOR EACH ROW EXECUTE FUNCTION update_marketing_context_updated_at();

-- Add pending_approval status + media support to content_queue
ALTER TABLE content_queue DROP CONSTRAINT IF EXISTS content_queue_status_check;
ALTER TABLE content_queue ADD CONSTRAINT content_queue_status_check
  CHECK (status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'published', 'failed', 'rejected'));

-- Visual content fields
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS visual_prompt text;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS visual_template_id text;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS visual_url text;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS source_context jsonb DEFAULT '{}'::jsonb;
