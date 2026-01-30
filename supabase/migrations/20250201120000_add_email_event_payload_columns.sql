alter table public.email_events
  add column if not exists from_email text,
  add column if not exists to_emails text[],
  add column if not exists cc_emails text[],
  add column if not exists subject text,
  add column if not exists body_text text,
  add column if not exists body_html text,
  add column if not exists attachments jsonb;
