-- Simple shop: products, stock, bills. No login: the public key can read and write.
-- This replaces the earlier multi-business GST/accounting schema, which is dropped first.

-- ---------------------------------------------------------------------------
-- 1. Drop everything from the old schema
-- ---------------------------------------------------------------------------
-- Storage buckets cannot be deleted with SQL. They are empty and unused; only their policies go.
drop policy if exists "documents delete" on storage.objects;
drop policy if exists "documents insert" on storage.objects;
drop policy if exists "documents read" on storage.objects;
drop policy if exists "product images delete" on storage.objects;
drop policy if exists "product images insert" on storage.objects;
drop policy if exists "product images list" on storage.objects;
drop policy if exists "product images update" on storage.objects;

drop view if exists public.customers, public.suppliers;

drop table if exists
  public.payment_allocations, public.payments, public.expenses,
  public.journal_lines, public.journal_entries,
  public.sales_items, public.sales_documents,
  public.purchase_items, public.purchase_documents,
  public.stock_movements, public.stock_batches,
  public.product_variants, public.products, public.categories, public.units,
  public.parties, public.warehouses, public.accounts,
  public.attachments, public.audit_log, public.doc_sequences,
  public.memberships, public.businesses
  cascade;

drop function if exists public.claim_invites();
drop function if exists public.commit_changes(uuid, jsonb);
drop function if exists public.create_business(text, text, text);
drop function if exists public.has_permission(uuid, text, text);
drop function if exists public.invite_member(uuid, text, text, text);
drop function if exists public.my_business_ids();
drop function if exists public.my_role(uuid);
drop function if exists public.set_member_active(uuid, uuid, boolean);
drop function if exists public.set_member_role(uuid, uuid, text);
drop function if exists public.storage_business(text);
drop function if exists public.trg_journal_balanced();
drop function if exists public.trg_stock_movement();

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table public.shop (
  id int primary key default 1 check (id = 1),
  name text not null default 'My Shop' check (char_length(name) between 1 and 120),
  address text not null default '',
  phone text not null default '',
  bank_name text not null default '',
  account_no text not null default '',
  ifsc text not null default '',
  upi_id text not null default ''
);
insert into public.shop (id) values (1);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  unit text not null default 'piece' check (char_length(btrim(unit)) between 1 and 20),
  buy_price numeric(12,2) not null default 0 check (buy_price >= 0),
  sell_price numeric(12,2) not null default 0 check (sell_price >= 0),
  low_stock_at numeric(12,3) check (low_stock_at is null or low_stock_at >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index products_name_active_uq on public.products (lower(btrim(name))) where active;

-- Every change to quantity: + for stock added, - for a correction.
create table public.stock_entries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  entry_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  qty numeric(12,3) not null check (qty <> 0),
  buy_price numeric(12,2) check (buy_price is null or buy_price >= 0),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index stock_entries_product_idx on public.stock_entries (product_id);
create index stock_entries_date_idx on public.stock_entries (entry_date);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number integer generated always as identity,
  invoice_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  customer_name text not null default '',
  customer_mobile text not null default '',
  gst_percent numeric(5,2) check (gst_percent is null or (gst_percent > 0 and gst_percent <= 100)),
  subtotal numeric(12,2) not null default 0,
  gst_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now()
);
create unique index invoices_number_uq on public.invoices (number);
create index invoices_date_idx on public.invoices (invoice_date);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  name text not null,
  unit text not null,
  qty numeric(12,3) not null check (qty > 0),
  price numeric(12,2) not null check (price >= 0),
  cost_price numeric(12,2) not null check (cost_price >= 0),
  amount numeric(12,2) not null
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index invoice_items_product_idx on public.invoice_items (product_id);

-- ---------------------------------------------------------------------------
-- 3. Stock left per product
-- ---------------------------------------------------------------------------
create view public.product_stock with (security_invoker = true) as
select
  p.id, p.name, p.unit, p.buy_price, p.sell_price, p.low_stock_at, p.active, p.created_at,
  q.quantity,
  round(q.quantity * p.buy_price, 2) as stock_value
from public.products p
cross join lateral (
  select
    coalesce((select sum(s.qty) from public.stock_entries s where s.product_id = p.id), 0)
    - coalesce((
        select sum(i.qty)
        from public.invoice_items i
        join public.invoices v on v.id = i.invoice_id
        where i.product_id = p.id and v.status = 'active'
      ), 0) as quantity
) q;

-- ---------------------------------------------------------------------------
-- 4. Functions (each runs as one transaction)
-- ---------------------------------------------------------------------------
create or replace function public.add_stock(p_product uuid, p_qty numeric, p_buy_price numeric default null, p_note text default '')
returns void
language plpgsql
set search_path = public
as $$
declare
  v_left numeric;
  v_unit text;
begin
  if p_qty is null or p_qty = 0 then
    raise exception 'Enter a quantity' using errcode = '22023';
  end if;
  select unit into v_unit from public.products where id = p_product and active for update;
  if not found then
    raise exception 'Product not found' using errcode = '22023';
  end if;
  if p_qty < 0 then
    select quantity into v_left from public.product_stock where id = p_product;
    if v_left + p_qty < 0 then
      raise exception 'Only % % in stock, so that much cannot be removed', trim_scale(v_left), v_unit using errcode = 'P0001';
    end if;
  end if;
  insert into public.stock_entries (product_id, qty, buy_price, note)
  values (p_product, p_qty, case when p_qty > 0 then p_buy_price end, coalesce(p_note, ''));
  if p_qty > 0 and p_buy_price is not null then
    update public.products set buy_price = p_buy_price where id = p_product;
  end if;
end;
$$;

create or replace function public.create_invoice(
  p_customer_name text,
  p_customer_mobile text,
  p_gst_percent numeric,
  p_items jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_sub numeric := 0;
  v_gst numeric := 0;
  v_pct numeric := nullif(coalesce(p_gst_percent, 0), 0);
  it jsonb;
  prod public.products%rowtype;
  v_qty numeric;
  v_price numeric;
  v_left numeric;
  v_amount numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item' using errcode = '22023';
  end if;
  if v_pct is not null and (v_pct < 0 or v_pct > 100) then
    raise exception 'GST must be between 0 and 100' using errcode = '22023';
  end if;

  insert into public.invoices (customer_name, customer_mobile, gst_percent)
  values (btrim(coalesce(p_customer_name, '')), regexp_replace(coalesce(p_customer_mobile, ''), '[^0-9+]', '', 'g'), v_pct)
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it ->> 'qty')::numeric;
    v_price := (it ->> 'price')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity must be more than 0' using errcode = '22023';
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'Enter a price' using errcode = '22023';
    end if;

    select * into prod from public.products where id = (it ->> 'product_id')::uuid and active for update;
    if not found then
      raise exception 'Product not found' using errcode = '22023';
    end if;

    -- Items already inserted for this bill are counted, so the same product twice is checked together.
    select quantity into v_left from public.product_stock where id = prod.id;
    if v_left < v_qty then
      raise exception 'Only % % of % left', trim_scale(v_left), prod.unit, prod.name using errcode = 'P0001';
    end if;

    v_amount := round(v_qty * v_price, 2);
    insert into public.invoice_items (invoice_id, product_id, name, unit, qty, price, cost_price, amount)
    values (v_id, prod.id, prod.name, prod.unit, v_qty, v_price, prod.buy_price, v_amount);
    v_sub := v_sub + v_amount;
  end loop;

  if v_pct is not null then
    v_gst := round(v_sub * v_pct / 100, 2);
  end if;
  update public.invoices set subtotal = v_sub, gst_amount = v_gst, total = v_sub + v_gst where id = v_id;
  return v_id;
end;
$$;

create or replace function public.cancel_invoice(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.invoices set status = 'cancelled' where id = p_id and status = 'active';
  if not found then
    raise exception 'Bill not found or already cancelled' using errcode = 'P0001';
  end if;
end;
$$;

-- One month for the home page. p_month is any date inside the month.
create or replace function public.dashboard_month(p_month date)
returns jsonb
language sql
stable
set search_path = public
as $$
  with m as (
    select date_trunc('month', p_month)::date as s, (date_trunc('month', p_month) + interval '1 month')::date as e
  ),
  sold as (
    select
      coalesce(sum(v.subtotal), 0) as sold,
      coalesce(sum(v.gst_amount), 0) as gst,
      count(*) as bills
    from public.invoices v, m
    where v.status = 'active' and v.invoice_date >= m.s and v.invoice_date < m.e
  ),
  cost as (
    select coalesce(sum(i.qty * i.cost_price), 0) as cost
    from public.invoice_items i
    join public.invoices v on v.id = i.invoice_id, m
    where v.status = 'active' and v.invoice_date >= m.s and v.invoice_date < m.e
  ),
  bought as (
    select coalesce(sum(s.qty * s.buy_price), 0) as bought
    from public.stock_entries s, m
    where s.qty > 0 and s.buy_price is not null and s.entry_date >= m.s and s.entry_date < m.e
  ),
  stock as (
    select coalesce(sum(stock_value), 0) as stock_value from public.product_stock where active
  ),
  items as (
    select coalesce(jsonb_agg(x order by x.amount desc), '[]'::jsonb) as items
    from (
      select i.name, i.unit, sum(i.qty) as qty, sum(i.amount) as amount
      from public.invoice_items i
      join public.invoices v on v.id = i.invoice_id, m
      where v.status = 'active' and v.invoice_date >= m.s and v.invoice_date < m.e
      group by i.product_id, i.name, i.unit
    ) x
  )
  select jsonb_build_object(
    'sold', sold.sold,
    'gst_collected', sold.gst,
    'bills', sold.bills,
    'bought', bought.bought,
    'cost_of_sold', cost.cost,
    'profit', sold.sold - cost.cost,
    'stock_value', stock.stock_value,
    'sold_items', items.items
  )
  from sold, cost, bought, stock, items;
$$;

-- ---------------------------------------------------------------------------
-- 5. Access: no login, so the public (anon) key may read and write everything here.
-- ---------------------------------------------------------------------------
alter table public.shop enable row level security;
alter table public.products enable row level security;
alter table public.stock_entries enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

create policy "open access" on public.shop for all to anon, authenticated using (true) with check (true);
create policy "open access" on public.products for all to anon, authenticated using (true) with check (true);
create policy "open access" on public.stock_entries for all to anon, authenticated using (true) with check (true);
create policy "open access" on public.invoices for all to anon, authenticated using (true) with check (true);
create policy "open access" on public.invoice_items for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.shop, public.products, public.stock_entries, public.invoices, public.invoice_items to anon, authenticated;
grant select on public.product_stock to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on function
  public.add_stock(uuid, numeric, numeric, text),
  public.create_invoice(text, text, numeric, jsonb),
  public.cancel_invoice(uuid),
  public.dashboard_month(date)
to anon, authenticated;
