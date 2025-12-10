drop table if exists public.pricing_settings cascade;

create table public.pricing_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,

  -- global flags
  vat_registered boolean not null default true,
  separate_labour boolean not null default true,

  -- service toggles
  service_domestic_carpet boolean not null default true,
  service_commercial_carpet boolean not null default true,
  service_carpet_tiles boolean not null default true,
  service_lvt boolean not null default true,
  service_domestic_vinyl boolean not null default true,
  service_commercial_vinyl boolean not null default true,
  service_wall_cladding boolean not null default true,

  -- markup settings
  markup_domestic_carpet_value numeric,
  markup_domestic_carpet_type text not null default '%',
  markup_commercial_carpet_value numeric,
  markup_commercial_carpet_type text not null default '%',
  markup_carpet_tiles_value numeric,
  markup_carpet_tiles_type text not null default '%',
  markup_lvt_value numeric,
  markup_lvt_type text not null default '%',
  markup_domestic_vinyl_value numeric,
  markup_domestic_vinyl_type text not null default '%',
  markup_commercial_vinyl_value numeric,
  markup_commercial_vinyl_type text not null default '%',
  markup_wall_cladding_value numeric,
  markup_wall_cladding_type text not null default '%',

  -- material prices
  mat_lvt_m2 numeric,
  mat_ceramic_tiles_m2 numeric,
  mat_domestic_carpet_m2 numeric,
  mat_commercial_carpet_m2 numeric,
  mat_safety_m2 numeric,
  mat_domestic_vinyl_m2 numeric,
  mat_commercial_vinyl_m2 numeric,
  mat_wall_cladding_m2 numeric,

  -- extras (required by buildPricingProfile)
  mat_ply_m2 numeric,
  mat_weld numeric,
  mat_coved_m2 numeric,
  mat_gripper numeric,
  mat_matting_m2 numeric,
  mat_nosings_m numeric,
  mat_adhesive_m2 numeric,
  mat_underlay numeric,
  mat_door_bars_each numeric,
  mat_uplift_m2 numeric,
  furniture_removal numeric,

  -- labour prices
  lab_domestic_carpet_m2 numeric,
  lab_commercial_carpet_m2 numeric,
  lab_lvt_m2 numeric,
  lab_ceramic_tiles_m2 numeric,
  lab_safety_m2 numeric,
  lab_domestic_vinyl_m2 numeric,
  lab_commercial_vinyl_m2 numeric,
  lab_wall_cladding_m2 numeric,
  lab_coved_m numeric,
  lab_ply_m2 numeric,
  lab_latex_m2 numeric,
  lab_carpet_tiles_m2 numeric,

  -- rules
  small_job_charge numeric,
  min_labour_charge numeric,
  day_rate_per_fitter numeric,
  default_markup_percent numeric,
  breakpoints_json jsonb not null default '[]'::jsonb,

  updated_at timestamptz not null default now()
);

alter table pricing_settings enable row level security;

create policy "Individuals can select their own pricing settings" on pricing_settings
  for select using (auth.uid() = profile_id);

create policy "Individuals can insert their own pricing settings" on pricing_settings
  for insert with check (auth.uid() = profile_id);

create policy "Individuals can update their own pricing settings" on pricing_settings
  for update using (auth.uid() = profile_id);

create policy "Individuals can delete their own pricing settings" on pricing_settings
  for delete using (auth.uid() = profile_id);
