create unique index if not exists supplier_prices_unique_base
on public.supplier_prices (client_id, supplier_name, product_name, uom);
