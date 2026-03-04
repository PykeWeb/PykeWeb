-- Normalize and extend item_type values used by catalog_items.
-- Safe to run multiple times.

begin;

-- Normalize legacy textual values to current enum set.
update public.catalog_items
set item_type = 'weapon'
where lower(item_type) in ('armes', 'arme', 'weapon', 'armes/equipements', 'armes / équipements');

update public.catalog_items
set item_type = 'equipment'
where lower(item_type) in ('equipement', 'équipement', 'equipements', 'équipements');

update public.catalog_items
set item_type = 'consumable'
where lower(item_type) in ('accessoire', 'accessoires');

-- Recreate check constraint with the new canonical values.
alter table if exists public.catalog_items
  drop constraint if exists catalog_items_item_type_check;

alter table if exists public.catalog_items
  add constraint catalog_items_item_type_check
  check (item_type in ('input', 'output', 'consumable', 'weapon', 'equipment', 'production', 'other'));

commit;
