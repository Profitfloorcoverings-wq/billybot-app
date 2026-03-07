-- Structured job areas: building → floor → area hierarchy for commercial tenders
create table if not exists job_areas (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references jobs(id) on delete cascade,
  client_id       uuid not null references clients(id),

  -- Hierarchy: building → floor → area (all optional for flat domestic jobs)
  building        text,
  floor           text,
  name            text not null,

  dimension_expr  text,
  m2_calculated   numeric(10,2),
  qty             integer not null default 1,

  flooring_type   text check (flooring_type in (
    'carpet','carpet_tiles','safety_vinyl','smooth_vinyl',
    'lvt_tiles','whiterock','matting','laminate','engineered',
    'wood','tiles','rubber','resin','other'
  )),
  product_spec    text,
  prep_notes      text,
  source          text not null default 'manual'
    check (source in ('ai_extracted','manual','drawing')),
  job_file_id     uuid references job_files(id) on delete set null,
  notes           text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_job_areas_job_id on job_areas(job_id);
create index idx_job_areas_client_id on job_areas(client_id);

alter table job_areas enable row level security;

-- Owner CRUD
create policy "job_areas_owner_select" on job_areas
  for select using (client_id = auth.uid());

create policy "job_areas_owner_insert" on job_areas
  for insert with check (client_id = auth.uid());

create policy "job_areas_owner_update" on job_areas
  for update using (client_id = auth.uid());

create policy "job_areas_owner_delete" on job_areas
  for delete using (client_id = auth.uid());

-- Team members can view
create policy "job_areas_team_select" on job_areas
  for select using (
    exists (
      select 1 from team_members
      where team_members.member_id = auth.uid()
        and team_members.business_id = job_areas.client_id
        and team_members.invite_status = 'accepted'
    )
  );
