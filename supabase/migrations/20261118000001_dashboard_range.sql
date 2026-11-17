-- Home page figures for any date range (both dates included), instead of one calendar month.
-- Used by the Today / Yesterday / This week / This month / This year / Custom dates buttons.
-- dashboard_month stays in place so a site deployed before this change keeps working.

create or replace function public.dashboard_range(p_from date, p_to date)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_from is null or p_to is null then
    raise exception 'Choose both dates' using errcode = '22023';
  end if;
  if p_from > p_to then
    raise exception 'The end date must not be before the start date' using errcode = '22023';
  end if;

  with sold as (
    select
      coalesce(sum(v.subtotal), 0) as sold,
      coalesce(sum(v.gst_amount), 0) as gst,
      count(*) as bills
    from public.invoices v
    where v.status = 'active' and v.invoice_date between p_from and p_to
  ),
  cost as (
    select coalesce(sum(i.qty * i.cost_price), 0) as cost
    from public.invoice_items i
    join public.invoices v on v.id = i.invoice_id
    where v.status = 'active' and v.invoice_date between p_from and p_to
  ),
  bought as (
    select coalesce(sum(s.qty * s.buy_price), 0) as bought
    from public.stock_entries s
    where s.qty > 0 and s.buy_price is not null and s.entry_date between p_from and p_to
  ),
  stock as (
    -- Stock left is what is in the shop right now, so it does not depend on the dates.
    select coalesce(sum(stock_value), 0) as stock_value from public.product_stock where active
  ),
  items as (
    select coalesce(jsonb_agg(x order by x.amount desc), '[]'::jsonb) as items
    from (
      select i.name, i.unit, sum(i.qty) as qty, sum(i.amount) as amount
      from public.invoice_items i
      join public.invoices v on v.id = i.invoice_id
      where v.status = 'active' and v.invoice_date between p_from and p_to
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
  into v_result
  from sold, cost, bought, stock, items;

  return v_result;
end;
$$;

grant execute on function public.dashboard_range(date, date) to anon, authenticated;
