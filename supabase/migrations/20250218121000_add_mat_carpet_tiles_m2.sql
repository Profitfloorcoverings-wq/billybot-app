alter table public.pricing_settings
  add column if not exists mat_carpet_tiles_m2 numeric;

alter table public.pricing_settings
  alter column mat_carpet_tiles_m2 set default 20;

update public.pricing_settings
  set mat_carpet_tiles_m2 = 20
  where mat_carpet_tiles_m2 is null;
