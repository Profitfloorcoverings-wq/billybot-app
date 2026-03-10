-- Force PostgREST to reload schema cache (picks up invoices table)
NOTIFY pgrst, 'reload schema';
