alter table public.email_events
  add column if not exists job_id uuid;

alter table public.quotes
  add column if not exists job_id uuid;

alter table public.jobs
  add column if not exists last_inbound_email_event_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_events_job_id_fkey'
  ) then
    alter table public.email_events
      add constraint email_events_job_id_fkey
      foreign key (job_id) references public.jobs(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_job_id_fkey'
  ) then
    alter table public.quotes
      add constraint quotes_job_id_fkey
      foreign key (job_id) references public.jobs(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_last_inbound_email_event_id_fkey'
  ) then
    alter table public.jobs
      add constraint jobs_last_inbound_email_event_id_fkey
      foreign key (last_inbound_email_event_id) references public.email_events(id) on delete set null;
  end if;
end $$;

create index if not exists email_events_job_id_idx on public.email_events(job_id);
create index if not exists quotes_job_id_idx on public.quotes(job_id);
create index if not exists jobs_last_inbound_email_event_id_idx
  on public.jobs(last_inbound_email_event_id);
