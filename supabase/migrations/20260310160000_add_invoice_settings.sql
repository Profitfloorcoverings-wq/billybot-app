-- Invoice settings on clients table (displayed on PDF invoices)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_vat_number text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_company_reg text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_bank_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_sort_code text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_account_number text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_payment_terms text DEFAULT 'Payment due within 30 days';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_notes text;
