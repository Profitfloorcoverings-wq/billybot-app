-- Add RAMS document columns to jobs table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS risk_assessment_url  TEXT,
  ADD COLUMN IF NOT EXISTS risk_assessment_ref  TEXT,
  ADD COLUMN IF NOT EXISTS method_statement_url TEXT,
  ADD COLUMN IF NOT EXISTS method_statement_ref TEXT;

-- Add building_rams as valid task_state in conversations
-- (No constraint change needed — task_state is plain TEXT)
