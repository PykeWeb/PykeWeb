-- Fixes patch: items catalog view consistency + images + weapon id
begin;

create or replace view public.catalog_global_items as
select
  o.group_id,
  ('objects:' || o.id::text) as id,
  o.id as source_id,
  'objects'::text as category,
  null::text as item_type,
  null::text as weapon_id,
  o.name,
  coalesce(o.price, 0)::numeric as price,
  coalesce(o.stock, 0)::integer as stock,
  o.image_url,
  o.created_at
from public.objects o
union all
select
  w.group_id,
  ('weapons:' || w.id::text) as id,
  w.id as source_id,
  'weapons'::text as category,
  null::text as item_type,
  w.weapon_id::text as weapon_id,
  coalesce(w.name, w.weapon_id, 'Arme') as name,
  0::numeric as price,
  coalesce(w.stock, 0)::integer as stock,
  w.image_url,
  w.created_at
from public.weapons w
union all
select
  e.group_id,
  ('equipment:' || e.id::text) as id,
  e.id as source_id,
  'equipment'::text as category,
  null::text as item_type,
  null::text as weapon_id,
  e.name,
  coalesce(e.price, 0)::numeric as price,
  coalesce(e.stock, 0)::integer as stock,
  e.image_url,
  e.created_at
from public.equipment e
union all
select
  d.group_id,
  ('drugs:' || d.id::text) as id,
  d.id as source_id,
  'drugs'::text as category,
  d.type::text as item_type,
  null::text as weapon_id,
  d.name,
  coalesce(d.price, 0)::numeric as price,
  coalesce(d.stock, 0)::integer as stock,
  d.image_url,
  d.created_at
from public.drug_items d;

commit;
