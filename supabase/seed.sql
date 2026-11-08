-- Demo data only. No users, passwords or credentials are seeded: the first person to sign up
-- becomes the owner of their own business (see public.create_business).
--
-- After signing in as an owner you can add sample catalogue data to your business with:
--   select public.seed_demo_catalogue('<your business id>');
-- Stock and ledger entries are created through the app so every posting stays balanced.

create or replace function public.seed_demo_catalogue(p_business uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission(p_business, 'settings', 'edit') then
    raise exception 'Only an owner can load sample data' using errcode = '42501';
  end if;

  insert into public.products (business_id, name, sku, barcode, hsn, gst_rate, unit, mrp, sale_price, wholesale_price, purchase_price, reorder_level, category, brand)
  values
    (p_business, 'Basmati rice 25 kg', 'RICE25', '8900000000025', '1006', 5, 'BAG', 1799, 1680, 1560, 1450, 20, 'Grocery', 'India Gate'),
    (p_business, 'Toor dal 1 kg', 'DAL1', '8900000000001', '0713', 5, 'KG', 170, 152, 142, 128, 40, 'Grocery', 'Tata Sampann'),
    (p_business, 'Notebook A4 200 pages', 'NB200', '8900000000200', '4820', 12, 'PCS', 72, 65, 60, 46, 60, 'Stationery', 'Classmate'),
    (p_business, 'LED bulb 9 W', 'LED9', '8900000000009', '8539', 12, 'PCS', 100, 89, 82, 58, 40, 'Electricals', 'Philips')
  on conflict do nothing;

  insert into public.parties (business_id, type, name, gstin, state_code, phone, credit_days, price_list)
  values
    (p_business, 'customer', 'Sample Kirana Stores', '', '27', '', 15, 'wholesale'),
    (p_business, 'customer', 'Sample Departmental Store', '', '24', '', 30, 'wholesale'),
    (p_business, 'supplier', 'Sample Wholesale Supplier', '', '27', '', 30, 'retail')
  on conflict do nothing;
end;
$$;

revoke all on function public.seed_demo_catalogue(uuid) from public, anon;
grant execute on function public.seed_demo_catalogue(uuid) to authenticated;
