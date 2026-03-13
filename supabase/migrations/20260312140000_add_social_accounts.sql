-- Social accounts table for per-user social media OAuth connections
CREATE TABLE IF NOT EXISTS social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'linkedin')),
  platform_user_id text,
  platform_page_id text,
  platform_page_name text,
  access_token_enc text NOT NULL,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scopes text[],
  status text NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'needs_reauth', 'error', 'disconnected')),
  last_post_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_accounts_client ON social_accounts(client_id);

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner select" ON social_accounts FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Owner insert" ON social_accounts FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "Owner update" ON social_accounts FOR UPDATE USING (client_id = auth.uid());
CREATE POLICY "Owner delete" ON social_accounts FOR DELETE USING (client_id = auth.uid());

-- Team member read-only
CREATE POLICY "Team select" ON social_accounts FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members
    WHERE team_members.member_id = auth.uid()
      AND team_members.business_id = social_accounts.client_id
      AND team_members.invite_status = 'accepted')
);

CREATE UNIQUE INDEX idx_social_accounts_platform
  ON social_accounts (client_id, platform, platform_page_id);

-- Add auto-post toggle to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS social_auto_post boolean DEFAULT false;

-- Add 'showcase' to job_files file_category check constraint
-- Drop and recreate the check constraint to include 'showcase'
ALTER TABLE job_files DROP CONSTRAINT IF EXISTS job_files_file_category_check;
ALTER TABLE job_files ADD CONSTRAINT job_files_file_category_check
  CHECK (file_category IN ('floor_plan', 'site_photo', 'cutting_plan', 'document', 'showcase'));
