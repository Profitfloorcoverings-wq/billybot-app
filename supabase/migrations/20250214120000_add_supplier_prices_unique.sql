ALTER TABLE public.supplier_prices
ADD CONSTRAINT supplier_prices_client_product_unique UNIQUE (client_id, product_name);
