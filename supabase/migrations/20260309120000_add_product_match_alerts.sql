-- Product match alerts: track unknown products mapped to closest existing match
create table product_match_alerts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id),
  job_id          uuid references jobs(id) on delete set null,

  -- What was encountered
  original_name   text not null,
  original_context text,

  -- What it was mapped to
  matched_to      text not null,
  confidence      numeric(3,2),
  match_reason    text,

  -- Resolution
  status          text not null default 'pending'
    check (status in ('pending','accepted','remapped','dismissed')),
  resolved_to     text,
  resolved_at     timestamptz,

  source          text not null default 'estimator'
    check (source in ('estimator','chat','quote_builder')),

  created_at      timestamptz not null default now()
);

create index idx_product_match_alerts_client on product_match_alerts(client_id, status);
create index idx_product_match_alerts_status on product_match_alerts(status);

alter table product_match_alerts enable row level security;

create policy "Users can view own alerts"
  on product_match_alerts for select
  using (client_id = auth.uid());
