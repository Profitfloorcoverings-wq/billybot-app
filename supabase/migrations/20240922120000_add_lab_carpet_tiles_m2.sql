alter table public.pricing_settings
  add column if not exists lab_carpet_tiles_m2 numeric;

alter table public.pricing_settings
  alter column lab_carpet_tiles_m2 set default 8;

update public.pricing_settings
  set lab_carpet_tiles_m2 = 8
  where lab_carpet_tiles_m2 is null;
