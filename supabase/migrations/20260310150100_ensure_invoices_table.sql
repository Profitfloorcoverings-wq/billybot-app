-- Ensure invoices table exists (original migration may have failed silently)
CREATE TABLE IF NOT EXISTS invoices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL REFERENCES clients(id),
  job_id                uuid REFERENCES jobs(id),
  quote_id              uuid REFERENCES quotes(id),
  invoice_reference     text,
  customer_name         text,
  customer_email        text,
  lines                 jsonb,
  amount_net            numeric,
  amount_vat            numeric,
  amount_total          numeric,
  status                text NOT NULL DEFAULT 'draft',
  pdf_url               text,
  accounting_invoice_id text,
  due_date              date,
  sent_at               timestamptz,
  paid_at               timestamptz,
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy to avoid "already exists" error
DROP POLICY IF EXISTS "Users manage own invoices" ON invoices;
CREATE POLICY "Users manage own invoices"
  ON invoices FOR ALL
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Explicit grants for PostgREST
GRANT ALL ON invoices TO anon;
GRANT ALL ON invoices TO authenticated;
GRANT ALL ON invoices TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
