-- Job file attachments (floor plans, site photos, cutting plans, documents)
create table if not exists job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  client_id uuid not null references clients(id),
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  storage_path text not null,
  file_category text not null default 'document'
    check (file_category in ('floor_plan', 'site_photo', 'cutting_plan', 'document')),
  uploaded_via text not null default 'web_upload'
    check (uploaded_via in ('chat', 'web_upload', 'mobile_upload', 'ai_generated')),
  ai_analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast lookups by job
create index idx_job_files_job_id on job_files(job_id);
create index idx_job_files_client_id on job_files(client_id);

-- RLS
alter table job_files enable row level security;

-- Owner can do everything
create policy "job_files_owner_select" on job_files
  for select using (client_id = auth.uid());

create policy "job_files_owner_insert" on job_files
  for insert with check (client_id = auth.uid());

create policy "job_files_owner_delete" on job_files
  for delete using (client_id = auth.uid());

create policy "job_files_owner_update" on job_files
  for update using (client_id = auth.uid());

-- Team members (via business_id on team_members table) can view
create policy "job_files_team_select" on job_files
  for select using (
    exists (
      select 1 from team_members
      where team_members.member_id = auth.uid()
        and team_members.business_id = job_files.client_id
        and team_members.invite_status = 'accepted'
    )
  );
