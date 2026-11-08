-- Row level security on every table. Members read their own business only.
-- Ledger tables have no write policies at all: they change only through public.commit_changes.

alter table public.businesses enable row level security;
alter table public.memberships enable row level security;
alter table public.doc_sequences enable row level security;
alter table public.categories enable row level security;
alter table public.units enable row level security;
alter table public.warehouses enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.parties enable row level security;
alter table public.accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_batches enable row level security;
alter table public.sales_documents enable row level security;
alter table public.sales_items enable row level security;
alter table public.purchase_documents enable row level security;
alter table public.purchase_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_log enable row level security;
alter table public.attachments enable row level security;

-- Nothing is reachable without signing in.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Read access: members of the business.
create policy "members read" on public.businesses for select to authenticated using (id in (select public.my_business_ids()));
create policy "members read" on public.doc_sequences for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.categories for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.units for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.warehouses for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.products for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.product_variants for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.parties for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.accounts for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.journal_entries for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.journal_lines for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.stock_movements for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.stock_batches for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.sales_documents for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.sales_items for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.purchase_documents for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.purchase_items for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.payments for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.payment_allocations for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.expenses for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.audit_log for select to authenticated using (business_id in (select public.my_business_ids()));
create policy "members read" on public.attachments for select to authenticated using (business_id in (select public.my_business_ids()));

-- A user can always see their own membership rows (to learn their role); members see teammates.
create policy "own membership" on public.memberships for select to authenticated using (user_id = (select auth.uid()));
create policy "team read" on public.memberships for select to authenticated using (business_id in (select public.my_business_ids()));

-- Writes on master data are checked against the role matrix.
create policy "settings edit" on public.businesses for update to authenticated
  using (public.has_permission(id, 'settings', 'edit')) with check (public.has_permission(id, 'settings', 'edit'));

create policy "inventory write" on public.warehouses for insert to authenticated with check (public.has_permission(business_id, 'inventory', 'create'));
create policy "inventory edit" on public.warehouses for update to authenticated
  using (public.has_permission(business_id, 'inventory', 'edit')) with check (public.has_permission(business_id, 'inventory', 'edit'));
create policy "inventory delete" on public.warehouses for delete to authenticated using (public.has_permission(business_id, 'inventory', 'delete'));

create policy "inventory write" on public.products for insert to authenticated with check (public.has_permission(business_id, 'inventory', 'create'));
create policy "inventory edit" on public.products for update to authenticated
  using (public.has_permission(business_id, 'inventory', 'edit')) with check (public.has_permission(business_id, 'inventory', 'edit'));
create policy "inventory delete" on public.products for delete to authenticated using (public.has_permission(business_id, 'inventory', 'delete'));

create policy "inventory write" on public.product_variants for insert to authenticated with check (public.has_permission(business_id, 'inventory', 'create'));
create policy "inventory edit" on public.product_variants for update to authenticated
  using (public.has_permission(business_id, 'inventory', 'edit')) with check (public.has_permission(business_id, 'inventory', 'edit'));
create policy "inventory delete" on public.product_variants for delete to authenticated using (public.has_permission(business_id, 'inventory', 'delete'));

create policy "inventory write" on public.categories for insert to authenticated with check (public.has_permission(business_id, 'inventory', 'create'));
create policy "inventory write" on public.units for insert to authenticated with check (public.has_permission(business_id, 'inventory', 'create'));

create policy "party write" on public.parties for insert to authenticated
  with check (public.has_permission(business_id, case when type = 'customer' then 'sales' else 'purchases' end, 'create'));
create policy "party edit" on public.parties for update to authenticated
  using (public.has_permission(business_id, case when type = 'customer' then 'sales' else 'purchases' end, 'edit'))
  with check (public.has_permission(business_id, case when type = 'customer' then 'sales' else 'purchases' end, 'edit'));
create policy "party delete" on public.parties for delete to authenticated
  using (public.has_permission(business_id, case when type = 'customer' then 'sales' else 'purchases' end, 'delete'));

-- Users add their own accounts. System accounts cannot be created or changed here.
create policy "accounting write" on public.accounts for insert to authenticated
  with check (system = false and public.has_permission(business_id, 'accounting', 'create'));

create policy "attachment write" on public.attachments for insert to authenticated
  with check (
    public.has_permission(business_id, 'purchases', 'create')
    or public.has_permission(business_id, 'sales', 'create')
    or public.has_permission(business_id, 'accounting', 'create')
  );

-- Ledger tables are append-only from the client's point of view: no insert, update or delete.
revoke insert, update, delete, truncate on
  public.doc_sequences, public.journal_entries, public.journal_lines, public.stock_movements, public.stock_batches,
  public.sales_documents, public.sales_items, public.purchase_documents, public.purchase_items,
  public.payments, public.payment_allocations, public.expenses, public.audit_log, public.memberships
from authenticated;
revoke delete, truncate on public.businesses from authenticated;
revoke insert on public.businesses from authenticated;
