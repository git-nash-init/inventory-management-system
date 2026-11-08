-- Helpers, integrity triggers and the atomic write RPC. All SECURITY DEFINER functions pin search_path.

-- ---------- tenancy and permissions ----------
create or replace function public.my_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id from public.memberships m where m.user_id = (select auth.uid()) and m.active
$$;

create or replace function public.my_role(p_business uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.memberships m
  where m.user_id = (select auth.uid()) and m.business_id = p_business and m.active
$$;

-- Mirrors src/domain/permissions.ts. A test compares both for every role, module and action.
create or replace function public.has_permission(p_business uuid, p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case m.role
      when 'owner' then true
      when 'manager' then
        p_module in ('dashboard', 'inventory', 'sales', 'purchases')
        or (p_module = 'accounting' and p_action in ('view', 'create'))
        or (p_module in ('reports', 'settings') and p_action = 'view')
      when 'accountant' then
        p_module in ('accounting', 'reports')
        or (p_module in ('dashboard', 'inventory', 'settings') and p_action = 'view')
        or (p_module in ('sales', 'purchases') and p_action in ('view', 'create'))
      when 'sales' then
        (p_module in ('dashboard', 'inventory') and p_action = 'view')
        or (p_module = 'sales' and p_action in ('view', 'create', 'edit'))
      when 'storekeeper' then
        p_module = 'inventory'
        or (p_module = 'dashboard' and p_action = 'view')
        or (p_module = 'purchases' and p_action in ('view', 'create'))
      else false
    end
    from public.memberships m
    where m.user_id = (select auth.uid()) and m.business_id = p_business and m.active
  ), false)
$$;

-- ---------- business creation ----------
create or replace function public.create_business(p_name text, p_gstin text, p_state_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_biz uuid;
  v_email text;
begin
  if v_user is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select email into v_email from auth.users where id = v_user;

  insert into public.businesses (name, legal_name, gstin, state_code, prefixes)
  values (
    trim(p_name), trim(p_name), coalesce(p_gstin, ''), p_state_code,
    jsonb_build_object(
      'quotation', 'QTN', 'order', 'SO', 'challan', 'DC', 'invoice', 'INV', 'bill_of_supply', 'BOS',
      'export_invoice', 'EXP', 'credit_note', 'CN', 'p:order', 'PO', 'p:grn', 'GRN', 'p:bill', 'PB',
      'p:debit_note', 'DN', 'receipt', 'RCT', 'payment', 'PAY', 'journal', 'JV', 'contra', 'CNT',
      'expense', 'EXP-V', 'stock_adjustment', 'ADJ', 'opening', 'OPN'
    )
  )
  returning id into v_biz;

  insert into public.memberships (user_id, business_id, role, email, name)
  values (v_user, v_biz, 'owner', coalesce(v_email, ''), coalesce((select raw_user_meta_data ->> 'full_name' from auth.users where id = v_user), ''));

  insert into public.warehouses (business_id, name, address, is_default) values (v_biz, 'Main godown', '', true);

  insert into public.accounts (business_id, id, code, name, "group", nature, system)
  select v_biz, a.id, a.code, a.name, a."group", a.nature, true
  from (values
    ('acc-capital', '1000', 'Capital Account', 'Capital Account', 'capital'),
    ('acc-reserves', '1100', 'Reserves and Surplus', 'Reserves and Surplus', 'capital'),
    ('acc-cash', '2000', 'Cash in Hand', 'Cash in Hand', 'asset'),
    ('acc-bank', '2010', 'Main Bank Account', 'Bank Accounts', 'asset'),
    ('acc-stock', '2100', 'Stock in Hand', 'Stock in Hand', 'asset'),
    ('acc-debtors', '2200', 'Sundry Debtors', 'Sundry Debtors', 'asset'),
    ('acc-in-cgst', '2300', 'Input CGST', 'Duties and Taxes', 'asset'),
    ('acc-in-sgst', '2301', 'Input SGST', 'Duties and Taxes', 'asset'),
    ('acc-in-igst', '2302', 'Input IGST', 'Duties and Taxes', 'asset'),
    ('acc-in-cess', '2303', 'Input Cess', 'Duties and Taxes', 'asset'),
    ('acc-creditors', '3000', 'Sundry Creditors', 'Sundry Creditors', 'liability'),
    ('acc-out-cgst', '3100', 'Output CGST', 'Duties and Taxes', 'liability'),
    ('acc-out-sgst', '3101', 'Output SGST', 'Duties and Taxes', 'liability'),
    ('acc-out-igst', '3102', 'Output IGST', 'Duties and Taxes', 'liability'),
    ('acc-out-cess', '3103', 'Output Cess', 'Duties and Taxes', 'liability'),
    ('acc-tcs', '3110', 'TCS Payable', 'Duties and Taxes', 'liability'),
    ('acc-loan', '3200', 'Loans', 'Loans', 'liability'),
    ('acc-sales', '4000', 'Sales', 'Sales Accounts', 'income'),
    ('acc-sales-return', '4010', 'Sales Returns', 'Sales Accounts', 'income'),
    ('acc-other-income', '4100', 'Other Income', 'Indirect Income', 'income'),
    ('acc-stock-gain', '4110', 'Stock Gain', 'Indirect Income', 'income'),
    ('acc-cogs', '5000', 'Cost of Goods Sold', 'Direct Expenses', 'expense'),
    ('acc-direct-exp', '5100', 'Direct Expenses', 'Direct Expenses', 'expense'),
    ('acc-rent', '5200', 'Rent', 'Indirect Expenses', 'expense'),
    ('acc-salary', '5210', 'Salaries and Wages', 'Indirect Expenses', 'expense'),
    ('acc-electric', '5220', 'Electricity', 'Indirect Expenses', 'expense'),
    ('acc-transport', '5230', 'Transport and Freight', 'Indirect Expenses', 'expense'),
    ('acc-office', '5240', 'Office Expenses', 'Indirect Expenses', 'expense'),
    ('acc-misc', '5290', 'Miscellaneous Expenses', 'Indirect Expenses', 'expense'),
    ('acc-stock-loss', '5300', 'Stock Loss and Damage', 'Indirect Expenses', 'expense'),
    ('acc-roundoff', '5900', 'Round Off', 'Indirect Expenses', 'expense')
  ) as a(id, code, name, "group", nature);

  insert into public.units (business_id, code, name)
  select v_biz, u.code, u.name from (values
    ('PCS', 'Pieces'), ('KG', 'Kilogram'), ('GM', 'Gram'), ('LTR', 'Litre'), ('ML', 'Millilitre'), ('MTR', 'Metre'),
    ('BOX', 'Box'), ('BAG', 'Bag'), ('PKT', 'Packet'), ('STRIP', 'Strip'), ('SET', 'Set'), ('DOZ', 'Dozen'), ('NOS', 'Numbers'), ('HRS', 'Hours')
  ) as u(code, name);

  insert into public.audit_log (business_id, actor, action, entity, entity_id, detail)
  values (v_biz, coalesce(v_email, 'owner'), 'created', 'business', v_biz::text, trim(p_name));

  return v_biz;
end;
$$;

-- ---------- membership management ----------
create or replace function public.claim_invites()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.memberships m
  set user_id = (select auth.uid())
  from auth.users u
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null
    and m.user_id is null
    and lower(m.email) = lower(u.email)
$$;

create or replace function public.invite_member(p_business uuid, p_email text, p_name text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_user uuid;
begin
  if not public.has_permission(p_business, 'users', 'edit') then
    raise exception 'Only an owner can add team members' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'manager', 'accountant', 'sales', 'storekeeper') then
    raise exception 'Unknown role' using errcode = '22023';
  end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email like name@example.com' using errcode = '22023';
  end if;
  select id into v_user from auth.users where lower(email) = lower(p_email) and email_confirmed_at is not null;
  insert into public.memberships (user_id, business_id, role, email, name)
  values (v_user, p_business, p_role, lower(p_email), coalesce(p_name, ''))
  returning id into v_id;
  insert into public.audit_log (business_id, actor, action, entity, entity_id, detail)
  values (p_business, coalesce((select email from auth.users where id = (select auth.uid())), 'user'), 'invited', 'user', v_id::text, p_email || ' as ' || p_role);
  return v_id;
end;
$$;

create or replace function public.set_member_role(p_business uuid, p_member uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if not public.has_permission(p_business, 'users', 'edit') then
    raise exception 'Only an owner can change roles' using errcode = '42501';
  end if;
  select role into v_old from public.memberships where id = p_member and business_id = p_business;
  if v_old is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_old = 'owner' and p_role <> 'owner'
     and (select count(*) from public.memberships where business_id = p_business and role = 'owner' and active) <= 1 then
    raise exception 'The business needs at least one owner' using errcode = '23514';
  end if;
  update public.memberships set role = p_role where id = p_member and business_id = p_business;
  insert into public.audit_log (business_id, actor, action, entity, entity_id, detail)
  values (p_business, coalesce((select email from auth.users where id = (select auth.uid())), 'user'), 'role changed', 'user', p_member::text, 'now ' || p_role);
end;
$$;

create or replace function public.set_member_active(p_business uuid, p_member uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if not public.has_permission(p_business, 'users', 'edit') then
    raise exception 'Only an owner can change access' using errcode = '42501';
  end if;
  select role into v_role from public.memberships where id = p_member and business_id = p_business;
  if v_role is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_role = 'owner' and not p_active then
    raise exception 'Owners cannot be deactivated' using errcode = '23514';
  end if;
  update public.memberships set active = p_active where id = p_member and business_id = p_business;
  insert into public.audit_log (business_id, actor, action, entity, entity_id, detail)
  values (p_business, coalesce((select email from auth.users where id = (select auth.uid())), 'user'), case when p_active then 'activated' else 'deactivated' end, 'user', p_member::text, '');
end;
$$;

-- ---------- integrity triggers ----------
-- Stock can never go negative and batch balances stay in sync.
create or replace function public.trg_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
begin
  if new.batch_no is not null and new.batch_no <> '' then
    insert into public.stock_batches (business_id, product_id, variant_id, warehouse_id, batch_no, expiry, qty)
    values (new.business_id, new.product_id, new.variant_id, new.warehouse_id, new.batch_no, new.expiry, new.qty)
    on conflict (business_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), warehouse_id, batch_no)
    do update set qty = public.stock_batches.qty + excluded.qty,
                  expiry = coalesce(excluded.expiry, public.stock_batches.expiry);
  end if;
  if new.qty < 0 then
    select coalesce(sum(qty), 0) into v_total
    from public.stock_movements
    where business_id = new.business_id and product_id = new.product_id
      and variant_id is not distinct from new.variant_id and warehouse_id = new.warehouse_id;
    if v_total < -0.0005 then
      raise exception 'Not enough stock: this would take the warehouse below zero' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger stock_movements_guard
after insert on public.stock_movements
for each row execute function public.trg_stock_movement();

-- Every journal entry must balance at commit. Deferred so lines can be inserted one by one.
create or replace function public.trg_journal_balanced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry uuid := coalesce(new.entry_id, old.entry_id);
  v_diff numeric;
begin
  select coalesce(sum(debit), 0) - coalesce(sum(credit), 0) into v_diff from public.journal_lines where entry_id = v_entry;
  if abs(v_diff) > 0.004 then
    raise exception 'Journal entry does not balance (difference %)', v_diff using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger journal_lines_balanced
after insert or update or delete on public.journal_lines
deferrable initially deferred
for each row execute function public.trg_journal_balanced();

-- ---------- the atomic write ----------
-- The client computes stock, tax and ledger postings with the same tested engine as the demo.
-- This function authorises the caller, forces every row into the caller's business, and applies
-- everything in one transaction. Composite foreign keys stop cross-tenant references; triggers
-- stop negative stock and unbalanced entries.
create or replace function public.commit_changes(p_business uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_module text := p_payload ->> 'module';
  v_action text := p_payload ->> 'action';
  v_actor text := coalesce((select email from auth.users where id = (select auth.uid())), 'user');
  e record;
  d record;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if p_business is null or p_business not in (select public.my_business_ids()) then
    raise exception 'You do not have access to this business' using errcode = '42501';
  end if;
  if v_module not in ('dashboard', 'inventory', 'sales', 'purchases', 'accounting', 'reports', 'settings', 'users')
     or v_action not in ('view', 'create', 'edit', 'delete')
     or not public.has_permission(p_business, v_module, v_action) then
    raise exception 'Your role cannot do this (% %)', v_action, v_module using errcode = '42501';
  end if;

  -- numbering
  insert into public.doc_sequences (business_id, series, fy, last)
  select p_business, r.series, r.fy, r.last
  from jsonb_to_recordset(coalesce(p_payload -> 'sequences', '[]'::jsonb)) as r(series text, fy integer, last integer)
  on conflict (business_id, series, fy) do update set last = greatest(public.doc_sequences.last, excluded.last);

  -- products (with variants)
  insert into public.products (id, business_id, name, sku, barcode, hsn, is_service, gst_rate, cess_pct, unit, alt_unit, alt_factor, mrp, sale_price,
    wholesale_price, purchase_price, opening_stock, reorder_level, category, brand, image_url, track_batch, track_serial, active)
  select r.id, p_business, r.name, r.sku, r.barcode, r.hsn, r.is_service, r.gst_rate, r.cess_pct, r.unit, r.alt_unit, r.alt_factor, r.mrp, r.sale_price,
    r.wholesale_price, r.purchase_price, r.opening_stock, r.reorder_level, r.category, r.brand, r.image_url, r.track_batch, r.track_serial, r.active
  from jsonb_to_recordset(coalesce(p_payload -> 'products', '[]'::jsonb)) as r(id uuid, name text, sku text, barcode text, hsn text, is_service boolean,
    gst_rate numeric, cess_pct numeric, unit text, alt_unit text, alt_factor numeric, mrp numeric, sale_price numeric, wholesale_price numeric,
    purchase_price numeric, opening_stock numeric, reorder_level numeric, category text, brand text, image_url text, track_batch boolean,
    track_serial boolean, active boolean)
  on conflict (id) do update set name = excluded.name, sku = excluded.sku, barcode = excluded.barcode, hsn = excluded.hsn, is_service = excluded.is_service,
    gst_rate = excluded.gst_rate, cess_pct = excluded.cess_pct, unit = excluded.unit, alt_unit = excluded.alt_unit, alt_factor = excluded.alt_factor,
    mrp = excluded.mrp, sale_price = excluded.sale_price, wholesale_price = excluded.wholesale_price, purchase_price = excluded.purchase_price,
    reorder_level = excluded.reorder_level, category = excluded.category, brand = excluded.brand, image_url = excluded.image_url,
    track_batch = excluded.track_batch, track_serial = excluded.track_serial, active = excluded.active
  where public.products.business_id = excluded.business_id;

  for e in select elem from jsonb_array_elements(coalesce(p_payload -> 'products', '[]'::jsonb)) as elem loop
    delete from public.product_variants
    where business_id = p_business and product_id = (e.elem ->> 'id')::uuid
      and id not in (select (v ->> 'id')::uuid from jsonb_array_elements(coalesce(e.elem -> 'variants', '[]'::jsonb)) v);
    insert into public.product_variants (id, business_id, product_id, name, sku, barcode, sale_price)
    select r.id, p_business, (e.elem ->> 'id')::uuid, r.name, coalesce(r.sku, ''), coalesce(r.barcode, ''), r.sale_price
    from jsonb_to_recordset(coalesce(e.elem -> 'variants', '[]'::jsonb)) as r(id uuid, name text, sku text, barcode text, sale_price numeric)
    on conflict (id) do update set name = excluded.name, sku = excluded.sku, barcode = excluded.barcode, sale_price = excluded.sale_price
    where public.product_variants.business_id = excluded.business_id;
  end loop;

  -- parties
  insert into public.parties (id, business_id, type, name, gstin, state_code, phone, email, address, credit_limit, credit_days, opening_balance, price_list, active)
  select r.id, p_business, r.type, r.name, r.gstin, r.state_code, r.phone, r.email, r.address, r.credit_limit, r.credit_days, r.opening_balance, r.price_list, r.active
  from jsonb_to_recordset(coalesce(p_payload -> 'parties', '[]'::jsonb)) as r(id uuid, type text, name text, gstin text, state_code text, phone text, email text,
    address text, credit_limit numeric, credit_days integer, opening_balance numeric, price_list text, active boolean)
  on conflict (id) do update set name = excluded.name, gstin = excluded.gstin, state_code = excluded.state_code, phone = excluded.phone, email = excluded.email,
    address = excluded.address, credit_limit = excluded.credit_limit, credit_days = excluded.credit_days, price_list = excluded.price_list, active = excluded.active
  where public.parties.business_id = excluded.business_id;

  -- sales documents (replace items when a draft is re-saved)
  for d in select elem from jsonb_array_elements(coalesce(p_payload -> 'sales_docs', '[]'::jsonb)) as elem loop
    delete from public.sales_items where business_id = p_business and document_id = (d.elem ->> 'id')::uuid;
    insert into public.sales_documents (id, business_id, type, number, date, due_date, party_id, party_name, party_gstin, place_of_supply, supply, reverse_charge,
      tcs_pct, notes, terms, status, paid, ref_doc_id, warehouse_id, attachment_name, attachment_path, einvoice, eway_bill_no, totals, created_by)
    select r.id, p_business, r.type, r.number, r.date, r.due_date, r.party_id, r.party_name, r.party_gstin, r.place_of_supply, r.supply, r.reverse_charge,
      r.tcs_pct, r.notes, r.terms, r.status, r.paid, r.ref_doc_id, r.warehouse_id, r.attachment_name, r.attachment_path, coalesce(r.einvoice, '{}'::jsonb), r.eway_bill_no,
      r.totals, (select auth.uid())
    from jsonb_to_record(d.elem) as r(id uuid, type text, number text, date date, due_date date, party_id uuid, party_name text, party_gstin text,
      place_of_supply text, supply text, reverse_charge boolean, tcs_pct numeric, notes text, terms text, status text, paid numeric, ref_doc_id uuid,
      warehouse_id uuid, attachment_name text, attachment_path text, einvoice jsonb, eway_bill_no text, totals jsonb)
    on conflict (id) do update set type = excluded.type, number = excluded.number, date = excluded.date, due_date = excluded.due_date, party_id = excluded.party_id,
      party_name = excluded.party_name, party_gstin = excluded.party_gstin, place_of_supply = excluded.place_of_supply, supply = excluded.supply,
      reverse_charge = excluded.reverse_charge, tcs_pct = excluded.tcs_pct, notes = excluded.notes, terms = excluded.terms, status = excluded.status,
      paid = excluded.paid, ref_doc_id = excluded.ref_doc_id, warehouse_id = excluded.warehouse_id, attachment_name = excluded.attachment_name,
      attachment_path = excluded.attachment_path, einvoice = excluded.einvoice, eway_bill_no = excluded.eway_bill_no, totals = excluded.totals
    where public.sales_documents.business_id = excluded.business_id;
    insert into public.sales_items (business_id, document_id, line_no, product_id, variant_id, name, hsn, qty, unit, rate, discount_pct, gst_rate, cess_pct, batch_no, expiry, serials, warehouse_id)
    select p_business, (d.elem ->> 'id')::uuid, it.ord, i.product_id, i.variant_id, i.name, coalesce(i.hsn, ''), i.qty, i.unit, i.rate, coalesce(i.discount_pct, 0),
      coalesce(i.gst_rate, 0), coalesce(i.cess_pct, 0), i.batch_no, i.expiry, i.serials, i.warehouse_id
    from jsonb_array_elements(coalesce(d.elem -> 'items', '[]'::jsonb)) with ordinality as it(elem, ord),
      lateral jsonb_to_record(it.elem) as i(product_id uuid, variant_id uuid, name text, hsn text, qty numeric, unit text, rate numeric, discount_pct numeric,
        gst_rate numeric, cess_pct numeric, batch_no text, expiry date, serials text[], warehouse_id uuid)
    order by it.ord;
  end loop;

  -- purchase documents
  for d in select elem from jsonb_array_elements(coalesce(p_payload -> 'purchase_docs', '[]'::jsonb)) as elem loop
    delete from public.purchase_items where business_id = p_business and document_id = (d.elem ->> 'id')::uuid;
    insert into public.purchase_documents (id, business_id, type, number, supplier_invoice_no, date, due_date, party_id, party_name, party_gstin, place_of_supply, supply,
      reverse_charge, tcs_pct, notes, terms, status, paid, ref_doc_id, warehouse_id, attachment_name, attachment_path, einvoice, eway_bill_no, totals, created_by)
    select r.id, p_business, r.type, r.number, r.supplier_invoice_no, r.date, r.due_date, r.party_id, r.party_name, r.party_gstin, r.place_of_supply, r.supply,
      r.reverse_charge, r.tcs_pct, r.notes, r.terms, r.status, r.paid, r.ref_doc_id, r.warehouse_id, r.attachment_name, r.attachment_path, coalesce(r.einvoice, '{}'::jsonb),
      r.eway_bill_no, r.totals, (select auth.uid())
    from jsonb_to_record(d.elem) as r(id uuid, type text, number text, supplier_invoice_no text, date date, due_date date, party_id uuid, party_name text,
      party_gstin text, place_of_supply text, supply text, reverse_charge boolean, tcs_pct numeric, notes text, terms text, status text, paid numeric,
      ref_doc_id uuid, warehouse_id uuid, attachment_name text, attachment_path text, einvoice jsonb, eway_bill_no text, totals jsonb)
    on conflict (id) do update set type = excluded.type, number = excluded.number, supplier_invoice_no = excluded.supplier_invoice_no, date = excluded.date,
      due_date = excluded.due_date, party_id = excluded.party_id, party_name = excluded.party_name, party_gstin = excluded.party_gstin,
      place_of_supply = excluded.place_of_supply, supply = excluded.supply, reverse_charge = excluded.reverse_charge, tcs_pct = excluded.tcs_pct,
      notes = excluded.notes, terms = excluded.terms, status = excluded.status, paid = excluded.paid, ref_doc_id = excluded.ref_doc_id,
      warehouse_id = excluded.warehouse_id, attachment_name = excluded.attachment_name, attachment_path = excluded.attachment_path,
      einvoice = excluded.einvoice, eway_bill_no = excluded.eway_bill_no, totals = excluded.totals
    where public.purchase_documents.business_id = excluded.business_id;
    insert into public.purchase_items (business_id, document_id, line_no, product_id, variant_id, name, hsn, qty, unit, rate, discount_pct, gst_rate, cess_pct, batch_no, expiry, serials, warehouse_id)
    select p_business, (d.elem ->> 'id')::uuid, it.ord, i.product_id, i.variant_id, i.name, coalesce(i.hsn, ''), i.qty, i.unit, i.rate, coalesce(i.discount_pct, 0),
      coalesce(i.gst_rate, 0), coalesce(i.cess_pct, 0), i.batch_no, i.expiry, i.serials, i.warehouse_id
    from jsonb_array_elements(coalesce(d.elem -> 'items', '[]'::jsonb)) with ordinality as it(elem, ord),
      lateral jsonb_to_record(it.elem) as i(product_id uuid, variant_id uuid, name text, hsn text, qty numeric, unit text, rate numeric, discount_pct numeric,
        gst_rate numeric, cess_pct numeric, batch_no text, expiry date, serials text[], warehouse_id uuid)
    order by it.ord;
  end loop;

  -- stock movements, in order (seq follows insertion order, which the cost replay relies on)
  insert into public.stock_movements (id, business_id, date, product_id, variant_id, warehouse_id, batch_no, expiry, qty, rate, type, ref_type, ref_id, ref_number, reason)
  select r.id, p_business, r.date, r.product_id, r.variant_id, r.warehouse_id, nullif(r.batch_no, ''), r.expiry, r.qty, r.rate, r.type, r.ref_type, r.ref_id, r.ref_number, r.reason
  from jsonb_array_elements(coalesce(p_payload -> 'movements', '[]'::jsonb)) with ordinality as it(elem, ord),
    lateral jsonb_to_record(it.elem) as r(id uuid, date date, product_id uuid, variant_id uuid, warehouse_id uuid, batch_no text, expiry date, qty numeric,
      rate numeric, type text, ref_type text, ref_id text, ref_number text, reason text)
  order by it.ord;

  -- journal entries and lines
  for d in select elem from jsonb_array_elements(coalesce(p_payload -> 'journal', '[]'::jsonb)) as elem loop
    insert into public.journal_entries (id, business_id, date, voucher_type, number, narration, ref_type, ref_id)
    select r.id, p_business, r.date, r.voucher_type, r.number, coalesce(r.narration, ''), r.ref_type, r.ref_id
    from jsonb_to_record(d.elem) as r(id uuid, date date, voucher_type text, number text, narration text, ref_type text, ref_id text);
    insert into public.journal_lines (business_id, entry_id, line_no, account_id, party_id, debit, credit, narration)
    select p_business, (d.elem ->> 'id')::uuid, it.ord, l.account_id, l.party_id, coalesce(l.debit, 0), coalesce(l.credit, 0), l.narration
    from jsonb_array_elements(coalesce(d.elem -> 'lines', '[]'::jsonb)) with ordinality as it(elem, ord),
      lateral jsonb_to_record(it.elem) as l(account_id text, party_id uuid, debit numeric, credit numeric, narration text)
    order by it.ord;
  end loop;

  -- bank reconciliation markers
  update public.journal_entries j set cleared = c.cleared
  from jsonb_to_recordset(coalesce(p_payload -> 'cleared', '[]'::jsonb)) as c(id uuid, cleared jsonb)
  where j.id = c.id and j.business_id = p_business;

  -- payments and allocations
  for d in select elem from jsonb_array_elements(coalesce(p_payload -> 'payments', '[]'::jsonb)) as elem loop
    insert into public.payments (id, business_id, number, direction, date, party_id, party_name, amount, mode, reference, account_id, notes)
    select r.id, p_business, r.number, r.direction, r.date, r.party_id, r.party_name, r.amount, r.mode, coalesce(r.reference, ''), r.account_id, coalesce(r.notes, '')
    from jsonb_to_record(d.elem) as r(id uuid, number text, direction text, date date, party_id uuid, party_name text, amount numeric, mode text,
      reference text, account_id text, notes text);
    insert into public.payment_allocations (business_id, payment_id, doc_id, doc_kind, amount)
    select p_business, (d.elem ->> 'id')::uuid, a.doc_id, a.doc_kind, a.amount
    from jsonb_to_recordset(coalesce(d.elem -> 'allocations', '[]'::jsonb)) as a(doc_id uuid, doc_kind text, amount numeric);
  end loop;

  -- expenses
  insert into public.expenses (id, business_id, number, date, category, account_id, pay_from_account_id, amount, gst_amount, vendor, notes, attachment_name, attachment_path)
  select r.id, p_business, r.number, r.date, r.category, r.account_id, r.pay_from_account_id, r.amount, coalesce(r.gst_amount, 0), coalesce(r.vendor, ''),
    coalesce(r.notes, ''), r.attachment_name, r.attachment_path
  from jsonb_to_recordset(coalesce(p_payload -> 'expenses', '[]'::jsonb)) as r(id uuid, number text, date date, category text, account_id text,
    pay_from_account_id text, amount numeric, gst_amount numeric, vendor text, notes text, attachment_name text, attachment_path text);

  -- status and payment updates on existing documents
  update public.sales_documents s
  set status = coalesce(u.status, s.status), paid = coalesce(u.paid, s.paid), einvoice = coalesce(u.einvoice, s.einvoice), eway_bill_no = coalesce(u.eway_bill_no, s.eway_bill_no)
  from jsonb_to_recordset(coalesce(p_payload -> 'doc_updates', '[]'::jsonb)) as u(kind text, id uuid, status text, paid numeric, einvoice jsonb, eway_bill_no text)
  where u.kind = 'sales' and s.id = u.id and s.business_id = p_business;
  update public.purchase_documents s
  set status = coalesce(u.status, s.status), paid = coalesce(u.paid, s.paid), einvoice = coalesce(u.einvoice, s.einvoice), eway_bill_no = coalesce(u.eway_bill_no, s.eway_bill_no)
  from jsonb_to_recordset(coalesce(p_payload -> 'doc_updates', '[]'::jsonb)) as u(kind text, id uuid, status text, paid numeric, einvoice jsonb, eway_bill_no text)
  where u.kind = 'purchase' and s.id = u.id and s.business_id = p_business;

  -- audit trail: the actor is the authenticated user, never taken from the payload
  insert into public.audit_log (business_id, actor, action, entity, entity_id, detail)
  select p_business, v_actor, r.action, r.entity, r.entity_id, coalesce(r.detail, '')
  from jsonb_to_recordset(coalesce(p_payload -> 'audit', '[]'::jsonb)) as r(action text, entity text, entity_id text, detail text);
end;
$$;

revoke all on function public.commit_changes(uuid, jsonb) from public, anon;
grant execute on function public.commit_changes(uuid, jsonb) to authenticated;
revoke all on function public.create_business(text, text, text) from public, anon;
grant execute on function public.create_business(text, text, text) to authenticated;
revoke all on function public.claim_invites() from public, anon;
grant execute on function public.claim_invites() to authenticated;
revoke all on function public.invite_member(uuid, text, text, text) from public, anon;
grant execute on function public.invite_member(uuid, text, text, text) to authenticated;
revoke all on function public.set_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
revoke all on function public.set_member_active(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_member_active(uuid, uuid, boolean) to authenticated;
revoke all on function public.my_business_ids() from public, anon;
grant execute on function public.my_business_ids() to authenticated;
revoke all on function public.my_role(uuid) from public, anon;
grant execute on function public.my_role(uuid) to authenticated;
revoke all on function public.has_permission(uuid, text, text) from public, anon;
grant execute on function public.has_permission(uuid, text, text) to authenticated;
