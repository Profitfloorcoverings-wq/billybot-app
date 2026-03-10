CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  job_id uuid REFERENCES jobs(id),
  supplier_name text,
  description text,
  amount_net numeric,
  amount_vat numeric,
  amount_total numeric,
  currency text NOT NULL DEFAULT 'GBP',
  receipt_date date,
  category text NOT NULL DEFAULT 'materials'
    CHECK (category IN ('materials', 'labour', 'equipment', 'fuel', 'other')),
  storage_path text,
  file_name text,
  mime_type text,
  uploaded_via text NOT NULL DEFAULT 'web_upload'
    CHECK (uploaded_via IN ('chat', 'web_upload', 'mobile_upload')),
  ai_extracted jsonb,
  accounting_bill_id text,
  accounting_synced_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'extracted', 'approved', 'synced', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY receipts_owner ON receipts
  FOR ALL USING (client_id = auth.uid());

CREATE POLICY receipts_team_read ON receipts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE business_id = receipts.client_id
        AND member_id = auth.uid()
        AND invite_status = 'accepted'
    )
  );

CREATE INDEX idx_receipts_client ON receipts(client_id);
CREATE INDEX idx_receipts_job ON receipts(job_id);
