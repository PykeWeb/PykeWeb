-- Fix category values for global catalog and add development seed data.
-- Safe to run multiple times.

begin;

-- 1) Make category check compatible with both legacy + canonical values.
--    This prevents inserts from failing on environments that still enforce singular values.
alter table if exists public.catalog_items_global
  drop constraint if exists catalog_items_global_category_check;

alter table if exists public.catalog_items_global
  add constraint catalog_items_global_category_check
  check (category in ('object', 'weapon', 'drug', 'equipment', 'objects', 'weapons', 'drugs', 'custom'));

-- 2) Normalize legacy singular category values to canonical plural values.
update public.catalog_items_global set category = 'objects' where category = 'object';
update public.catalog_items_global set category = 'weapons' where category = 'weapon';
update public.catalog_items_global set category = 'drugs' where category = 'drug';

-- 3) Seed examples per category (only inserted when absent).
insert into public.catalog_items_global (category, item_type, name, price, default_quantity, description, image_url, weapon_id)
select 'objects', 'input', 'Bouteille d''eau', 15, 20, 'Objet de base pour le stock commun.', null, null
where not exists (select 1 from public.catalog_items_global where lower(name) = lower('Bouteille d''eau'));

insert into public.catalog_items_global (category, item_type, name, price, default_quantity, description, image_url, weapon_id)
select 'weapons', 'equipment', 'Pistolet 9mm', 1200, 5, 'Arme courte standard.', null, 'weapon_pistol'
where not exists (select 1 from public.catalog_items_global where lower(name) = lower('Pistolet 9mm'));

insert into public.catalog_items_global (category, item_type, name, price, default_quantity, description, image_url, weapon_id)
select 'equipment', 'equipment', 'Gilet pare-balles', 850, 8, 'Protection de base.', null, null
where not exists (select 1 from public.catalog_items_global where lower(name) = lower('Gilet pare-balles'));

insert into public.catalog_items_global (category, item_type, name, price, default_quantity, description, image_url, weapon_id)
select 'drugs', 'drug', 'Sachet herbe', 220, 15, 'Produit exemple pour tests.', null, null
where not exists (select 1 from public.catalog_items_global where lower(name) = lower('Sachet herbe'));

commit;
