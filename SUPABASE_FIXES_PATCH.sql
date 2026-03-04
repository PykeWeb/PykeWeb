-- Fixes patch: rebuild catalog_global_items view safely (supports schema drift)
-- Important: canonical conflict-safe strategy is DROP then CREATE to avoid PostgreSQL column-rename conflicts
-- when an existing view has a different column layout/order.
begin;

do $$
declare
  has_objects_image boolean;
  has_weapons_image boolean;
  has_equipment_image boolean;
  has_drugs_image boolean;
  sql text;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'objects' and column_name = 'image_url'
  ) into has_objects_image;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'weapons' and column_name = 'image_url'
  ) into has_weapons_image;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'equipment' and column_name = 'image_url'
  ) into has_equipment_image;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'drug_items' and column_name = 'image_url'
  ) into has_drugs_image;

  -- Avoid: ERROR 42P16 cannot change name of view column ...
  execute 'drop view if exists public.catalog_global_items';

  sql := format($fmt$
    create view public.catalog_global_items as
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
      %s as image_url,
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
      coalesce(w.name, w.weapon_id::text, 'Arme') as name,
      0::numeric as price,
      coalesce(w.stock, 0)::integer as stock,
      %s as image_url,
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
      %s as image_url,
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
      %s as image_url,
      d.created_at
    from public.drug_items d
  $fmt$,
    case when has_objects_image then 'o.image_url::text' else 'null::text' end,
    case when has_weapons_image then 'w.image_url::text' else 'null::text' end,
    case when has_equipment_image then 'e.image_url::text' else 'null::text' end,
    case when has_drugs_image then 'd.image_url::text' else 'null::text' end
  );

  execute sql;
end $$;

commit;
