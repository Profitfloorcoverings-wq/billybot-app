-- Also add metadata column to messages if not present (needed for diary_confirmation)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata JSONB;

-- diary_entries
CREATE TABLE IF NOT EXISTS public.diary_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  job_id            UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  entry_type        TEXT NOT NULL DEFAULT 'fitting'
                      CHECK (entry_type IN ('prep', 'fitting', 'survey', 'other')),
  status            TEXT NOT NULL DEFAULT 'confirmed'
                      CHECK (status IN ('pending_confirmation', 'confirmed', 'cancelled', 'completed')),
  start_datetime    TIMESTAMPTZ NOT NULL,
  end_datetime      TIMESTAMPTZ NOT NULL,
  customer_name     TEXT,
  customer_email    TEXT,
  customer_phone    TEXT,
  job_address       TEXT,
  postcode          TEXT,
  notes             TEXT,
  confirmation_data JSONB,
  created_by        UUID REFERENCES public.clients(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT end_after_start CHECK (end_datetime > start_datetime)
);

-- diary_fitters
CREATE TABLE IF NOT EXISTS public.diary_fitters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_entry_id  UUID NOT NULL REFERENCES public.diary_entries(id) ON DELETE CASCADE,
  team_member_id  UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  notified_at     TIMESTAMPTZ,
  UNIQUE (diary_entry_id, team_member_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_diary_entries_business_id ON public.diary_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_start       ON public.diary_entries(start_datetime);
CREATE INDEX IF NOT EXISTS idx_diary_entries_job_id      ON public.diary_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_status      ON public.diary_entries(status);
CREATE INDEX IF NOT EXISTS idx_diary_fitters_entry       ON public.diary_fitters(diary_entry_id);
CREATE INDEX IF NOT EXISTS idx_diary_fitters_member      ON public.diary_fitters(team_member_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER diary_entries_updated_at
  BEFORE UPDATE ON public.diary_entries
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- RLS
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_fitters  ENABLE ROW LEVEL SECURITY;

-- Owners and managers see all entries for their business
CREATE POLICY "diary_entries_select_owner" ON public.diary_entries FOR SELECT USING (
  business_id = auth.uid()
  OR business_id IN (
    SELECT business_id FROM public.team_members
    WHERE member_id = auth.uid() AND role = 'manager'
  )
);

-- Fitters see only entries they are assigned to
CREATE POLICY "diary_entries_select_fitter" ON public.diary_entries FOR SELECT USING (
  id IN (
    SELECT df.diary_entry_id FROM public.diary_fitters df
    JOIN public.team_members tm ON df.team_member_id = tm.id
    WHERE tm.member_id = auth.uid()
  )
);

-- Insert: owner or manager only
CREATE POLICY "diary_entries_insert" ON public.diary_entries FOR INSERT WITH CHECK (
  business_id = auth.uid()
  OR business_id IN (
    SELECT business_id FROM public.team_members
    WHERE member_id = auth.uid() AND role = 'manager'
  )
);

-- Update: owner or manager only
CREATE POLICY "diary_entries_update" ON public.diary_entries FOR UPDATE USING (
  business_id = auth.uid()
  OR business_id IN (
    SELECT business_id FROM public.team_members
    WHERE member_id = auth.uid() AND role = 'manager'
  )
);

-- Delete: owner only
CREATE POLICY "diary_entries_delete" ON public.diary_entries FOR DELETE
  USING (business_id = auth.uid());

-- diary_fitters RLS (inherit parent entry access)
CREATE POLICY "diary_fitters_select" ON public.diary_fitters FOR SELECT USING (
  diary_entry_id IN (SELECT id FROM public.diary_entries)
);
CREATE POLICY "diary_fitters_insert" ON public.diary_fitters FOR INSERT WITH CHECK (
  diary_entry_id IN (
    SELECT id FROM public.diary_entries WHERE business_id = auth.uid()
    OR business_id IN (
      SELECT business_id FROM public.team_members
      WHERE member_id = auth.uid() AND role = 'manager'
    )
  )
);
CREATE POLICY "diary_fitters_delete" ON public.diary_fitters FOR DELETE USING (
  diary_entry_id IN (
    SELECT id FROM public.diary_entries WHERE business_id = auth.uid()
  )
);
