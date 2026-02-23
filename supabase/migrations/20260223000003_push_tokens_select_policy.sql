-- Allow users to read their own push token row (needed for sidebar app-detection check)
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'push_tokens'
      AND policyname = 'push_tokens_select_own'
  ) THEN
    CREATE POLICY push_tokens_select_own
      ON public.push_tokens FOR SELECT
      USING (profile_id = auth.uid());
  END IF;
END $$;
