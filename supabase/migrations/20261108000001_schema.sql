-- Khata Books schema. Multi-tenant: every business table carries business_id.
-- Writes to ledger tables happen only through public.commit_changes (SECURITY DEFINER).


-- ---------- tenancy ----------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  legal_name text not null default '',
  gstin text not null default '' check (gstin = '' or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  pan text not null default '' check (pan = '' or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  state_code text not null check (state_code ~ '^[0-9]{2}$'),
  address text not null default '',
  city text not null default '',
  pincode text not null default '',
  phone text not null default '',
  email text not null default '',
  logo_data_url text,
  signature_data_url text,
  bank_name text not null default '',
  bank_account text not null default '',
  ifsc text not null default '',
  upi_id text not null default '',
  tax_scheme text not null default 'regular' check (tax_scheme in ('regular', 'composition')),
  terms text not null default '',
  invoice_template text not null default 'a4' check (invoice_template in ('a4', 'a5', 'thermal')),
  valuation text not null default 'avg' check (valuation in ('avg', 'fifo')),
  tcs_pct numeric(5, 2) not null default 0 check (tcs_pct between 0 and 100),
  prefixes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'accountant', 'sales', 'storekeeper')),
  active boolean not null default true,
  email text not null,
  name text not null default '',
  created_at timestamptz not null default now()
);
create unique index memberships_user_business_key on public.memberships (user_id, business_id) where user_id is not null;
create unique index memberships_business_email_key on public.memberships (business_id, lower(email));
create index memberships_user_idx on public.memberships (user_id) where active;
create index memberships_business_idx on public.memberships (business_id);

create table public.doc_sequences (
  business_id uuid not null references public.businesses (id) on delete cascade,
  series text not null,
  fy integer not null,
  last integer not null default 0,
  primary key (business_id, series, fy)
);

-- ---------- catalogue ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  unique (business_id, name)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  code text not null,
  name text not null,
  unique (business_id, code)
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  address text not null default '',
  is_default boolean not null default false,
  unique (business_id, id)
);
create unique index warehouses_one_default on public.warehouses (business_id) where is_default;
create index warehouses_business_idx on public.warehouses (business_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 200),
  sku text not null default '',
  barcode text not null default '',
  hsn text not null default '' check (hsn ~ '^([0-9]{4}|[0-9]{6}|[0-9]{8})?$'),
  is_service boolean not null default false,
  gst_rate numeric(5, 2) not null default 18 check (gst_rate in (0, 0.25, 3, 5, 12, 18, 28)),
  cess_pct numeric(6, 2) not null default 0 check (cess_pct between 0 and 100),
  unit text not null default 'PCS',
  alt_unit text,
  alt_factor numeric(12, 3),
  mrp numeric(14, 2) not null default 0 check (mrp >= 0),
  sale_price numeric(14, 2) not null default 0 check (sale_price >= 0),
  wholesale_price numeric(14, 2) not null default 0 check (wholesale_price >= 0),
  purchase_price numeric(14, 2) not null default 0 check (purchase_price >= 0),
  opening_stock numeric(14, 3) not null default 0 check (opening_stock >= 0),
  reorder_level numeric(14, 3) not null default 0 check (reorder_level >= 0),
  category text not null default '',
  brand text not null default '',
  image_url text,
  track_batch boolean not null default false,
  track_serial boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);
create unique index products_sku_key on public.products (business_id, sku) where sku <> '';
create unique index products_barcode_key on public.products (business_id, barcode) where barcode <> '';
create index products_business_idx on public.products (business_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null,
  name text not null,
  sku text not null default '',
  barcode text not null default '',
  sale_price numeric(14, 2),
  unique (business_id, id),
  foreign key (business_id, product_id) references public.products (business_id, id) on delete cascade
);
create index product_variants_product_idx on public.product_variants (product_id);
create index product_variants_business_idx on public.product_variants (business_id);

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  type text not null check (type in ('customer', 'supplier')),
  name text not null check (char_length(name) between 2 and 200),
  gstin text not null default '' check (gstin = '' or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  state_code text not null check (state_code ~ '^[0-9]{2}$'),
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  credit_limit numeric(14, 2) not null default 0 check (credit_limit >= 0),
  credit_days integer not null default 0 check (credit_days between 0 and 365),
  opening_balance numeric(14, 2) not null default 0,
  price_list text not null default 'retail' check (price_list in ('retail', 'wholesale')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);
create index parties_business_idx on public.parties (business_id, type);

create view public.customers with (security_invoker = true) as select * from public.parties where type = 'customer';
create view public.suppliers with (security_invoker = true) as select * from public.parties where type = 'supplier';

-- ---------- accounts and ledger ----------
-- Account ids are text so system accounts keep stable keys (acc-cash) in every business.
create table public.accounts (
  business_id uuid not null references public.businesses (id) on delete cascade,
  id text not null,
  code text not null,
  name text not null,
  "group" text not null,
  nature text not null check (nature in ('asset', 'liability', 'income', 'expense', 'capital')),
  system boolean not null default false,
  primary key (business_id, id),
  unique (business_id, code)
);

create table public.journal_entries (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  seq bigint generated always as identity,
  date date not null,
  voucher_type text not null,
  number text not null,
  narration text not null default '',
  ref_type text,
  ref_id text,
  cleared jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, number),
  unique (business_id, id)
);
create index journal_entries_business_date_idx on public.journal_entries (business_id, date);
create index journal_entries_ref_idx on public.journal_entries (business_id, ref_id);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  entry_id uuid not null,
  line_no integer not null default 0,
  account_id text not null,
  party_id uuid,
  debit numeric(14, 2) not null default 0 check (debit >= 0),
  credit numeric(14, 2) not null default 0 check (credit >= 0),
  narration text,
  check (not (debit > 0 and credit > 0)),
  foreign key (business_id, account_id) references public.accounts (business_id, id),
  foreign key (business_id, party_id) references public.parties (business_id, id),
  foreign key (business_id, entry_id) references public.journal_entries (business_id, id) on delete cascade
);
create index journal_lines_entry_idx on public.journal_lines (entry_id);
create index journal_lines_account_idx on public.journal_lines (business_id, account_id);
create index journal_lines_party_idx on public.journal_lines (business_id, party_id) where party_id is not null;

-- ---------- stock ----------
create table public.stock_movements (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  seq bigint generated always as identity,
  date date not null,
  product_id uuid not null,
  variant_id uuid,
  warehouse_id uuid not null,
  batch_no text,
  expiry date,
  qty numeric(14, 3) not null,
  rate numeric(14, 4) not null default 0,
  type text not null check (type in ('opening', 'purchase', 'sale', 'sales_return', 'purchase_return', 'adjustment', 'transfer_out', 'transfer_in')),
  ref_type text,
  ref_id text,
  ref_number text,
  reason text,
  created_at timestamptz not null default now(),
  foreign key (business_id, product_id) references public.products (business_id, id),
  foreign key (business_id, variant_id) references public.product_variants (business_id, id),
  foreign key (business_id, warehouse_id) references public.warehouses (business_id, id)
);
create index stock_movements_product_idx on public.stock_movements (business_id, product_id, warehouse_id);
create index stock_movements_ref_idx on public.stock_movements (business_id, ref_id);

create table public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null,
  variant_id uuid,
  warehouse_id uuid not null,
  batch_no text not null,
  expiry date,
  qty numeric(14, 3) not null default 0 check (qty >= 0),
  foreign key (business_id, product_id) references public.products (business_id, id),
  foreign key (business_id, variant_id) references public.product_variants (business_id, id),
  foreign key (business_id, warehouse_id) references public.warehouses (business_id, id)
);
create unique index stock_batches_key on public.stock_batches (business_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), warehouse_id, batch_no);

-- ---------- documents ----------
create table public.sales_documents (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  type text not null check (type in ('quotation', 'order', 'challan', 'invoice', 'bill_of_supply', 'export_invoice', 'credit_note')),
  number text not null,
  date date not null,
  due_date date,
  party_id uuid,
  party_name text not null default '',
  party_gstin text not null default '',
  place_of_supply text not null check (place_of_supply ~ '^[0-9]{2}$'),
  supply text not null check (supply in ('intra', 'inter')),
  reverse_charge boolean not null default false,
  tcs_pct numeric(5, 2) not null default 0,
  notes text not null default '',
  terms text not null default '',
  status text not null check (status in ('draft', 'final', 'converted', 'cancelled')),
  paid numeric(14, 2) not null default 0 check (paid >= 0),
  ref_doc_id uuid,
  warehouse_id uuid not null,
  attachment_name text,
  attachment_path text,
  einvoice jsonb not null default '{}'::jsonb,
  eway_bill_no text,
  totals jsonb not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, party_id) references public.parties (business_id, id),
  foreign key (business_id, warehouse_id) references public.warehouses (business_id, id)
);
create unique index sales_documents_number_key on public.sales_documents (business_id, type, number) where number <> 'Draft';
create index sales_documents_business_idx on public.sales_documents (business_id, date desc);
create index sales_documents_party_idx on public.sales_documents (business_id, party_id);

create table public.sales_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  document_id uuid not null,
  line_no integer not null,
  product_id uuid not null,
  variant_id uuid,
  name text not null,
  hsn text not null default '',
  qty numeric(14, 3) not null check (qty > 0),
  unit text not null,
  rate numeric(14, 4) not null check (rate >= 0),
  discount_pct numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  gst_rate numeric(5, 2) not null default 0,
  cess_pct numeric(6, 2) not null default 0,
  batch_no text,
  expiry date,
  serials text[],
  warehouse_id uuid,
  foreign key (business_id, document_id) references public.sales_documents (business_id, id) on delete cascade,
  foreign key (business_id, product_id) references public.products (business_id, id),
  foreign key (business_id, variant_id) references public.product_variants (business_id, id),
  foreign key (business_id, warehouse_id) references public.warehouses (business_id, id)
);
create index sales_items_document_idx on public.sales_items (document_id);
create index sales_items_business_idx on public.sales_items (business_id);

create table public.purchase_documents (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  type text not null check (type in ('order', 'grn', 'bill', 'debit_note')),
  number text not null,
  supplier_invoice_no text,
  date date not null,
  due_date date,
  party_id uuid,
  party_name text not null default '',
  party_gstin text not null default '',
  place_of_supply text not null check (place_of_supply ~ '^[0-9]{2}$'),
  supply text not null check (supply in ('intra', 'inter')),
  reverse_charge boolean not null default false,
  tcs_pct numeric(5, 2) not null default 0,
  notes text not null default '',
  terms text not null default '',
  status text not null check (status in ('draft', 'final', 'converted', 'cancelled')),
  paid numeric(14, 2) not null default 0 check (paid >= 0),
  ref_doc_id uuid,
  warehouse_id uuid not null,
  attachment_name text,
  attachment_path text,
  einvoice jsonb not null default '{}'::jsonb,
  eway_bill_no text,
  totals jsonb not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, party_id) references public.parties (business_id, id),
  foreign key (business_id, warehouse_id) references public.warehouses (business_id, id)
);
create unique index purchase_documents_number_key on public.purchase_documents (business_id, type, number) where number <> 'Draft';
create index purchase_documents_business_idx on public.purchase_documents (business_id, date desc);
create index purchase_documents_party_idx on public.purchase_documents (business_id, party_id);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  document_id uuid not null,
  line_no integer not null,
  product_id uuid not null,
  variant_id uuid,
  name text not null,
  hsn text not null default '',
  qty numeric(14, 3) not null check (qty > 0),
  unit text not null,
  rate numeric(14, 4) not null check (rate >= 0),
  discount_pct numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  gst_rate numeric(5, 2) not null default 0,
  cess_pct numeric(6, 2) not null default 0,
  batch_no text,
  expiry date,
  serials text[],
  warehouse_id uuid,
  foreign key (business_id, document_id) references public.purchase_documents (business_id, id) on delete cascade,
  foreign key (business_id, product_id) references public.products (business_id, id),
  foreign key (business_id, variant_id) references public.product_variants (business_id, id),
  foreign key (business_id, warehouse_id) references public.warehouses (business_id, id)
);
create index purchase_items_document_idx on public.purchase_items (document_id);
create index purchase_items_business_idx on public.purchase_items (business_id);

-- ---------- payments, expenses ----------
create table public.payments (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  number text not null,
  direction text not null check (direction in ('in', 'out')),
  date date not null,
  party_id uuid not null,
  party_name text not null default '',
  amount numeric(14, 2) not null check (amount > 0),
  mode text not null check (mode in ('cash', 'upi', 'bank', 'cheque')),
  reference text not null default '',
  account_id text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (business_id, number),
  unique (business_id, id),
  foreign key (business_id, party_id) references public.parties (business_id, id),
  foreign key (business_id, account_id) references public.accounts (business_id, id)
);
create index payments_business_idx on public.payments (business_id, date desc);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  payment_id uuid not null,
  doc_id uuid not null,
  doc_kind text not null check (doc_kind in ('sales', 'purchase')),
  amount numeric(14, 2) not null check (amount > 0),
  foreign key (business_id, payment_id) references public.payments (business_id, id) on delete cascade
);
create index payment_allocations_payment_idx on public.payment_allocations (payment_id);
create index payment_allocations_doc_idx on public.payment_allocations (business_id, doc_id);

create table public.expenses (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  number text not null,
  date date not null,
  category text not null,
  account_id text not null,
  pay_from_account_id text not null,
  amount numeric(14, 2) not null check (amount > 0),
  gst_amount numeric(14, 2) not null default 0 check (gst_amount >= 0),
  vendor text not null default '',
  notes text not null default '',
  attachment_name text,
  attachment_path text,
  created_at timestamptz not null default now(),
  unique (business_id, number),
  foreign key (business_id, account_id) references public.accounts (business_id, id),
  foreign key (business_id, pay_from_account_id) references public.accounts (business_id, id)
);
create index expenses_business_idx on public.expenses (business_id, date desc);

-- ---------- audit and attachments ----------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  detail text not null default ''
);
create index audit_log_business_idx on public.audit_log (business_id, at desc);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  bucket text not null,
  path text not null,
  name text not null,
  mime text not null,
  size integer not null check (size > 0),
  ref_type text,
  ref_id text,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index attachments_business_idx on public.attachments (business_id);
