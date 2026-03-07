-- Allow team members to read their business's jobs on mobile
CREATE POLICY "jobs_select_team_members" ON public.jobs FOR SELECT
  USING (
    client_id = auth.uid()
    OR client_id IN (
      SELECT business_id FROM public.team_members
      WHERE member_id = auth.uid() AND invite_status = 'accepted'
    )
  );

-- Allow team members to read their business's quotes on mobile
CREATE POLICY "quotes_select_team_members" ON public.quotes FOR SELECT
  USING (
    client_id = auth.uid()
    OR client_id IN (
      SELECT business_id FROM public.team_members
      WHERE member_id = auth.uid() AND invite_status = 'accepted'
    )
  );

-- Allow team members to read their business's customers on mobile
CREATE POLICY "customers_select_team_members" ON public.customers FOR SELECT
  USING (
    profile_id = auth.uid()
    OR profile_id IN (
      SELECT business_id FROM public.team_members
      WHERE member_id = auth.uid() AND invite_status = 'accepted'
    )
  );
