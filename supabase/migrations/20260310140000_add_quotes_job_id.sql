-- Add job_id FK to quotes table (expected by invoice and quoting workflows)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES jobs(id);

-- Index for fast lookups by job
CREATE INDEX IF NOT EXISTS idx_quotes_job_id ON quotes(job_id);

-- Backfill: link existing quotes to jobs via job_ref matching jobs.id cast to text
-- (skip if job_ref values aren't UUIDs)
UPDATE quotes q
SET job_id = j.id
FROM jobs j
WHERE q.job_id IS NULL
  AND q.job_ref IS NOT NULL
  AND q.job_ref = j.id::text
  AND q.client_id = j.client_id;
