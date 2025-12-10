create table pricing_settings (
  profile_id uuid primary key references profiles(id) on delete cascade,

  vat_registered boolean default true,
  separate_labour boolean default true,

  small_job_charge numeric,
  day_rate_per_fitter numeric,
  min_labour_charge numeric,

  -- service toggles (must match UI)
  service_domestic_carpet boolean,
  service_commercial_carpet boolean,
  service_carpet_tiles boolean,
  service_lvt boolean,
  service_domestic_vinyl boolean,
  service_commercial_vinyl boolean,
  service_wall_cladding boolean,

  -- material markups (value + type £/% )
  markup_domestic_carpet_value numeric,
  markup_domestic_carpet_type text,
  markup_commercial_carpet_value numeric,
  markup_commercial_carpet_type text,
  markup_carpet_tiles_value numeric,
  markup_carpet_tiles_type text,
  markup_lvt_value numeric,
  markup_lvt_type text,
  markup_domestic_vinyl_value numeric,
  markup_domestic_vinyl_type text,
  markup_commercial_vinyl_value numeric,
  markup_commercial_vinyl_type text,
  markup_wall_cladding_value numeric,
  markup_wall_cladding_type text,
  default_markup_percent numeric,

  -- base material prices
  mat_lvt_m2 numeric,
  mat_ceramic_tiles_m2 numeric,
  mat_domestic_carpet_m2 numeric,
  mat_commercial_carpet_m2 numeric,
  mat_carpet_tiles_m2 numeric,
  mat_safety_m2 numeric,
  mat_domestic_vinyl_m2 numeric,
  mat_commercial_vinyl_m2 numeric,
  mat_wall_cladding_m2 numeric,
  mat_uplift_m2 numeric,
  mat_adhesive_m2 numeric,
  mat_door_bars_each numeric,
  furniture_removal numeric,
  mat_matting_m2 numeric,
  mat_nosings_m numeric,
  mat_weld numeric,
  mat_coved_m2 numeric,
  mat_gripper numeric,
  mat_underlay numeric,

  -- base labour prices
  lab_domestic_carpet_m2 numeric,
  lab_commercial_carpet_m2 numeric,
  lab_carpet_tiles_m2 numeric,
  lab_lvt_m2 numeric,
  lab_ceramic_tiles_m2 numeric,
  lab_safety_m2 numeric,
  lab_domestic_vinyl_m2 numeric,
  lab_commercial_vinyl_m2 numeric,
  lab_wall_cladding_m2 numeric,
  lab_coved_m numeric,
  lab_ply_m2 numeric,
  lab_latex_m2 numeric,

  -- breakpoints
  breakpoints_json jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
