alter table pricing_settings
  add column if not exists breakpoints_enabled boolean not null default false;
