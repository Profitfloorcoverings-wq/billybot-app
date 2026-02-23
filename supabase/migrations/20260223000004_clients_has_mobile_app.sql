ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS has_mobile_app boolean NOT NULL DEFAULT false;
