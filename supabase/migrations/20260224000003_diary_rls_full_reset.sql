-- Full reset of diary_entries and diary_fitters RLS policies.
-- Drops all existing policies and recreates them cleanly.
-- Safe to run multiple times.

-- Drop all existing policies
DROP POLICY IF EXISTS "diary_entries_select_owner"  ON public.diary_entries;
DROP POLICY IF EXISTS "diary_entries_select_fitter" ON public.diary_entries;
DROP POLICY IF EXISTS "diary_entries_select"        ON public.diary_entries;
DROP POLICY IF EXISTS "diary_entries_insert"        ON public.diary_entries;
DROP POLICY IF EXISTS "diary_entries_update"        ON public.diary_entries;
DROP POLICY IF EXISTS "diary_entries_delete"        ON public.diary_entries;

DROP POLICY IF EXISTS "diary_fitters_select" ON public.diary_fitters;
DROP POLICY IF EXISTS "diary_fitters_insert" ON public.diary_fitters;
DROP POLICY IF EXISTS "diary_fitters_delete" ON public.diary_fitters;

-- Ensure RLS is enabled
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_fitters  ENABLE ROW LEVEL SECURITY;

-- diary_entries SELECT: owner + all team members of the business
CREATE POLICY "diary_entries_select" ON public.diary_entries
  FOR SELECT USING (
    business_id = auth.uid()
    OR business_id IN (
      SELECT business_id FROM public.team_members
      WHERE member_id = auth.uid()
    )
  );

-- diary_entries INSERT: owner + any team member of the business
CREATE POLICY "diary_entries_insert" ON public.diary_entries
  FOR INSERT WITH CHECK (
    business_id = auth.uid()
    OR business_id IN (
      SELECT business_id FROM public.team_members
      WHERE member_id = auth.uid()
    )
  );

-- diary_entries UPDATE: owner + manager team members
CREATE POLICY "diary_entries_update" ON public.diary_entries
  FOR UPDATE USING (
    business_id = auth.uid()
    OR business_id IN (
      SELECT business_id FROM public.team_members
      WHERE member_id = auth.uid() AND role = 'manager'
    )
  );

-- diary_entries DELETE: owner only
CREATE POLICY "diary_entries_delete" ON public.diary_entries
  FOR DELETE USING (business_id = auth.uid());

-- diary_fitters SELECT: visible if the parent entry is visible
CREATE POLICY "diary_fitters_select" ON public.diary_fitters
  FOR SELECT USING (
    diary_entry_id IN (SELECT id FROM public.diary_entries)
  );

-- diary_fitters INSERT: owner + team member of the business
CREATE POLICY "diary_fitters_insert" ON public.diary_fitters
  FOR INSERT WITH CHECK (
    diary_entry_id IN (
      SELECT id FROM public.diary_entries
      WHERE business_id = auth.uid()
        OR business_id IN (
          SELECT business_id FROM public.team_members
          WHERE member_id = auth.uid()
        )
    )
  );

-- diary_fitters DELETE: owner only
CREATE POLICY "diary_fitters_delete" ON public.diary_fitters
  FOR DELETE USING (
    diary_entry_id IN (
      SELECT id FROM public.diary_entries
      WHERE business_id = auth.uid()
    )
  );
