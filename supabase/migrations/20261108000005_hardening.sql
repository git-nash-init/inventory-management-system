-- Hardening after the first advisor run.

-- Trigger functions are never meant to be called over the API.
revoke all on function public.trg_stock_movement() from public, anon, authenticated;
revoke all on function public.trg_journal_balanced() from public, anon, authenticated;

-- One SELECT policy on memberships instead of two overlapping ones.
drop policy "own membership" on public.memberships;
drop policy "team read" on public.memberships;
create policy "members read" on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or business_id in (select public.my_business_ids()));

-- Covering indexes for the composite (business_id, id) foreign keys.
create index if not exists expenses_account_fk_idx on public.expenses (business_id, account_id);
create index if not exists expenses_pay_from_fk_idx on public.expenses (business_id, pay_from_account_id);
create index if not exists journal_lines_entry_fk_idx on public.journal_lines (business_id, entry_id);
create index if not exists payment_allocations_payment_fk_idx on public.payment_allocations (business_id, payment_id);
create index if not exists payments_account_fk_idx on public.payments (business_id, account_id);
create index if not exists payments_party_fk_idx on public.payments (business_id, party_id);
create index if not exists product_variants_product_fk_idx on public.product_variants (business_id, product_id);
create index if not exists purchase_documents_warehouse_fk_idx on public.purchase_documents (business_id, warehouse_id);
create index if not exists purchase_items_document_fk_idx on public.purchase_items (business_id, document_id);
create index if not exists purchase_items_product_fk_idx on public.purchase_items (business_id, product_id);
create index if not exists purchase_items_variant_fk_idx on public.purchase_items (business_id, variant_id);
create index if not exists purchase_items_warehouse_fk_idx on public.purchase_items (business_id, warehouse_id);
create index if not exists sales_documents_warehouse_fk_idx on public.sales_documents (business_id, warehouse_id);
create index if not exists sales_items_document_fk_idx on public.sales_items (business_id, document_id);
create index if not exists sales_items_product_fk_idx on public.sales_items (business_id, product_id);
create index if not exists sales_items_variant_fk_idx on public.sales_items (business_id, variant_id);
create index if not exists sales_items_warehouse_fk_idx on public.sales_items (business_id, warehouse_id);
create index if not exists stock_batches_variant_fk_idx on public.stock_batches (business_id, variant_id);
create index if not exists stock_batches_warehouse_fk_idx on public.stock_batches (business_id, warehouse_id);
create index if not exists stock_movements_variant_fk_idx on public.stock_movements (business_id, variant_id);
create index if not exists stock_movements_warehouse_fk_idx on public.stock_movements (business_id, warehouse_id);
