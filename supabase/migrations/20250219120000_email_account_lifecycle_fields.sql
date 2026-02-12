alter table public.email_accounts
  add column if not exists gmail_watch_expires_at timestamptz,
  add column if not exists gmail_last_push_at timestamptz,
  add column if not exists ms_last_push_at timestamptz,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_error_at timestamptz,
  add column if not exists email_connection_status text;

create index if not exists email_accounts_status_idx
  on public.email_accounts (provider, status, email_connection_status);

create index if not exists email_accounts_watch_exp_idx
  on public.email_accounts (gmail_watch_expires_at);

create index if not exists email_accounts_ms_sub_exp_idx
  on public.email_accounts (ms_subscription_expires_at);
