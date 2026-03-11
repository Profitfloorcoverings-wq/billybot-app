-- Deduplicate existing rows (keep most recently active per thread)
WITH dupes AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY client_id, provider, provider_thread_id
    ORDER BY last_activity_at DESC NULLS LAST, created_at DESC
  ) AS rn
  FROM public.jobs
  WHERE provider_thread_id IS NOT NULL
)
UPDATE public.jobs SET status = 'merged'
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

-- Partial unique index — prevents duplicate jobs per thread
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_client_provider_thread_unique
  ON public.jobs (client_id, provider, provider_thread_id)
  WHERE provider_thread_id IS NOT NULL AND status != 'merged';

-- Index for customer email lookups during hydration
CREATE INDEX IF NOT EXISTS idx_jobs_client_customer_email
  ON public.jobs (client_id, customer_email)
  WHERE customer_email IS NOT NULL;
