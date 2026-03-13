ALTER TABLE clients ADD COLUMN IF NOT EXISTS voice_profile text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS voice_examples jsonb DEFAULT '[]'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS voice_profile_generated_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS voice_profile_email_count int DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS voice_profile_status text DEFAULT 'none';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS voice_profile_manual_override boolean DEFAULT false;
