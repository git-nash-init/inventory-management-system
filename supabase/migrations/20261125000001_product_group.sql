-- A group for each product (Solvent, Shower, Water tank ...) so a long list can be filtered.
alter table public.products
  add column if not exists category text not null default ''
  check (char_length(category) <= 40);

-- New columns on an existing view must be added at the end.
create or replace view public.product_stock with (security_invoker = true) as
select
  p.id, p.name, p.unit, p.buy_price, p.sell_price, p.low_stock_at, p.active, p.created_at,
  q.quantity,
  round(q.quantity * p.buy_price, 2) as stock_value,
  p.category
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
