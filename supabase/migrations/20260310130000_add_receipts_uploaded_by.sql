-- Add uploaded_by to track which team member uploaded the receipt
ALTER TABLE receipts ADD COLUMN uploaded_by uuid REFERENCES clients(id);

-- Backfill: existing receipts were uploaded by the business owner
UPDATE receipts SET uploaded_by = client_id WHERE uploaded_by IS NULL;

-- Allow team members to INSERT receipts for their business
CREATE POLICY "Team members can insert receipts"
  ON receipts FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT business_id FROM team_members
      WHERE member_id = auth.uid()
      AND invite_status = 'accepted'
    )
    OR client_id = auth.uid()
  );

-- Allow team members to UPDATE receipts for their business
CREATE POLICY "Team members can update receipts"
  ON receipts FOR UPDATE
  USING (
    client_id IN (
      SELECT business_id FROM team_members
      WHERE member_id = auth.uid()
      AND invite_status = 'accepted'
    )
    OR client_id = auth.uid()
  );

-- Allow team members to SELECT receipts for their business
CREATE POLICY "Team members can view receipts"
  ON receipts FOR SELECT
  USING (
    client_id IN (
      SELECT business_id FROM team_members
      WHERE member_id = auth.uid()
      AND invite_status = 'accepted'
    )
    OR client_id = auth.uid()
  );

-- Allow team members to DELETE receipts for their business
CREATE POLICY "Team members can delete receipts"
  ON receipts FOR DELETE
  USING (
    client_id IN (
      SELECT business_id FROM team_members
      WHERE member_id = auth.uid()
      AND invite_status = 'accepted'
    )
    OR client_id = auth.uid()
  );
