-- Add thread_type to jobs to distinguish actual jobs from general email conversations
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS thread_type TEXT NOT NULL DEFAULT 'job'
    CHECK (thread_type IN ('job', 'conversation', 'enquiry'));

-- Backfill: all existing rows are real jobs
UPDATE public.jobs SET thread_type = 'job' WHERE thread_type IS NULL OR thread_type = '';

CREATE INDEX IF NOT EXISTS idx_jobs_thread_type ON public.jobs(thread_type);
CREATE INDEX IF NOT EXISTS idx_jobs_client_thread_type ON public.jobs(client_id, thread_type);
