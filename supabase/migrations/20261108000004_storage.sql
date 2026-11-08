-- Storage: product images are public to read; scanned bills and documents are private.
-- Object paths start with the business id, which the policies check.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('documents', 'documents', false, 5242880, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Folder 1 of the object name is the business id. The CASE avoids a failed uuid cast on junk names.
create or replace function public.storage_business(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[1])::uuid
    else null
  end
$$;

create policy "product images list" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.storage_business(name) in (select public.my_business_ids()));
create policy "product images insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_permission(public.storage_business(name), 'inventory', 'create'));
create policy "product images update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.has_permission(public.storage_business(name), 'inventory', 'edit'));
create policy "product images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_permission(public.storage_business(name), 'inventory', 'delete'));

create policy "documents read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.storage_business(name) in (select public.my_business_ids()));
create policy "documents insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (
      public.has_permission(public.storage_business(name), 'purchases', 'create')
      or public.has_permission(public.storage_business(name), 'sales', 'create')
      or public.has_permission(public.storage_business(name), 'accounting', 'create')
    )
  );
create policy "documents delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.has_permission(public.storage_business(name), 'accounting', 'delete'));
