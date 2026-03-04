-- jobs table: billing overrides + reverse charge flag
ALTER TABLE jobs
  ADD COLUMN billing_address text,
  ADD COLUMN billing_email   text,
  ADD COLUMN reverse_charge  boolean NOT NULL DEFAULT false;

-- customers table: billing details + reverse charge flag
ALTER TABLE customers
  ADD COLUMN billing_address text,
  ADD COLUMN billing_email   text,
  ADD COLUMN reverse_charge  boolean NOT NULL DEFAULT false;
