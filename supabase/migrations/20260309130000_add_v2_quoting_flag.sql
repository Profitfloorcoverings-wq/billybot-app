-- Feature flag for v2 quoting flow (interactive preview before accounting commit)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS use_v2_quoting boolean DEFAULT false;
