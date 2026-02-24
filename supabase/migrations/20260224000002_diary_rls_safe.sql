-- Safely ensure diary_entries RLS SELECT policy exists for owners/managers.
-- Uses DO block to avoid errors if the policy already exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'diary_entries'
      AND policyname = 'diary_entries_select_owner'
  ) THEN
    CREATE POLICY "diary_entries_select_owner" ON public.diary_entries
      FOR SELECT USING (
        business_id = auth.uid()
        OR business_id IN (
          SELECT business_id FROM public.team_members
          WHERE member_id = auth.uid()
        )
      );
  END IF;
END;
$$;

-- Ensure the table has RLS enabled (idempotent)
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;
