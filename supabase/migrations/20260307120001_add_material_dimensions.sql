-- Add material dimension columns to supplier_prices for cutting plan generation
alter table supplier_prices
  add column if not exists width_m numeric,
  add column if not exists length_m numeric,
  add column if not exists format text check (format in ('roll', 'tile', 'plank', 'sheet'));
