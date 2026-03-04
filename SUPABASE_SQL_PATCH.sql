-- Pyke Stock: RLS + policies + soft delete + category/type normalization
-- Safe to run multiple times.

begin;

alter table if exists public.catalog_items add column if not exists deleted_at timestamptz;

-- 1) Canonical category/type values
update public.catalog_items
set category = case lower(category)
  when 'object' then 'objects'
  when 'weapon' then 'weapons'
  when 'drug' then 'drugs'
  when 'equipment' then 'equipment'
  when 'custom' then 'custom'
  when 'objects' then 'objects'
  when 'weapons' then 'weapons'
  when 'drugs' then 'drugs'
  else 'custom'
end;

update public.catalog_items
set item_type = case lower(item_type)
  when 'input' then 'other'
  when 'output' then 'pouch'
  when 'production' then 'seed'
  when 'consumable' then 'consumable'
  when 'weapon' then 'weapon'
  when 'equipment' then 'equipment'
  when 'other' then 'other'
  when 'accessory' then 'accessory'
  when 'tool' then 'tool'
  when 'material' then 'material'
  when 'ammo' then 'ammo'
  when 'weapon_accessory' then 'weapon_accessory'
  when 'outfit' then 'outfit'
  when 'protection' then 'protection'
  when 'seed' then 'seed'
  when 'pouch' then 'pouch'
  when 'product' then 'product'
  when 'recipe' then 'recipe'
  when 'drug_material' then 'drug_material'
  else 'other'
end;

alter table if exists public.catalog_items drop constraint if exists catalog_items_category_check;
alter table if exists public.catalog_items add constraint catalog_items_category_check
check (category in ('objects', 'weapons', 'equipment', 'drugs', 'custom'));

alter table if exists public.catalog_items drop constraint if exists catalog_items_item_type_check;
alter table if exists public.catalog_items add constraint catalog_items_item_type_check
check (item_type in (
  'accessory','tool','consumable','material',
  'weapon','ammo','weapon_accessory',
  'equipment','outfit','protection',
  'seed','pouch','product','recipe','drug_material',
  'other'
));

-- 2) RLS policy patch (mode public/anon permissif)
alter table if exists public.catalog_items enable row level security;
alter table if exists public.transactions enable row level security;
alter table if exists public.transaction_items enable row level security;
alter table if exists public.expenses enable row level security;

-- Drop old conflicting policies when present
DO $$
DECLARE
  _tbl text;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY['catalog_items','transactions','transaction_items','expenses']
  LOOP
    EXECUTE format('drop policy if exists "anon_read" on public.%I', _tbl);
    EXECUTE format('drop policy if exists "anon_insert" on public.%I', _tbl);
    EXECUTE format('drop policy if exists "anon_update" on public.%I', _tbl);
    EXECUTE format('drop policy if exists "anon_delete" on public.%I', _tbl);
  END LOOP;
END$$;

create policy "anon_read" on public.catalog_items for select to anon using (true);
create policy "anon_insert" on public.catalog_items for insert to anon with check (true);
create policy "anon_update" on public.catalog_items for update to anon using (true) with check (true);
create policy "anon_delete" on public.catalog_items for delete to anon using (true);

create policy "anon_read" on public.transactions for select to anon using (true);
create policy "anon_insert" on public.transactions for insert to anon with check (true);
create policy "anon_update" on public.transactions for update to anon using (true) with check (true);
create policy "anon_delete" on public.transactions for delete to anon using (true);

create policy "anon_read" on public.transaction_items for select to anon using (true);
create policy "anon_insert" on public.transaction_items for insert to anon with check (true);
create policy "anon_update" on public.transaction_items for update to anon using (true) with check (true);
create policy "anon_delete" on public.transaction_items for delete to anon using (true);

create policy "anon_read" on public.expenses for select to anon using (true);
create policy "anon_insert" on public.expenses for insert to anon with check (true);
create policy "anon_update" on public.expenses for update to anon using (true) with check (true);
create policy "anon_delete" on public.expenses for delete to anon using (true);

-- 3) Storage policies for item images (public bucket)
insert into storage.buckets (id, name, public)
values ('object-images', 'object-images', true)
on conflict (id) do update set public = excluded.public;

DO $$
BEGIN
  execute 'drop policy if exists "Public read object-images" on storage.objects';
  execute 'drop policy if exists "Anon upload object-images" on storage.objects';
  execute 'drop policy if exists "Anon update object-images" on storage.objects';
  execute 'drop policy if exists "Anon delete object-images" on storage.objects';
EXCEPTION WHEN undefined_table THEN
  NULL;
END$$;

DO $$
BEGIN
  create policy "Public read object-images" on storage.objects for select using (bucket_id = 'object-images');
  create policy "Anon upload object-images" on storage.objects for insert to anon with check (bucket_id = 'object-images');
  create policy "Anon update object-images" on storage.objects for update to anon using (bucket_id = 'object-images') with check (bucket_id = 'object-images');
  create policy "Anon delete object-images" on storage.objects for delete to anon using (bucket_id = 'object-images');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;

commit;
