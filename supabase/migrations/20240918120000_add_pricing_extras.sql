alter table public.pricing_settings
  add column if not exists mat_latex_m2 numeric,
  add column if not exists waste_disposal numeric,
  add column if not exists lab_door_bars_each numeric,
  add column if not exists lab_nosings_m numeric,
  add column if not exists lab_matting_m2 numeric,
  add column if not exists lab_uplift_m2 numeric,
  add column if not exists lab_gripper_m numeric;
