CREATE TABLE invoices (
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

CREATE POLICY "Users manage own invoices"
  ON invoices FOR ALL
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());
