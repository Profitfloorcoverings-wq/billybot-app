alter table public.email_events
  add column if not exists provider_thread_id text;
