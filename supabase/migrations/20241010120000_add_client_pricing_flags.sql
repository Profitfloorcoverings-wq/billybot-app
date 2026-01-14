alter table public.clients
  add column if not exists has_edited_pricing_settings boolean not null default false,
  add column if not exists has_uploaded_price_list boolean not null default false;

update public.clients
set has_edited_pricing_settings = true
where id in (select distinct profile_id from public.pricing_settings);

update public.clients
set has_uploaded_price_list = true
where id in (select distinct client_id from public.supplier_prices);

alter table public.clients enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'clients'
      and policyname = 'clients_update_own'
  ) then
    create policy "clients_update_own" on public.clients
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end
$$;
