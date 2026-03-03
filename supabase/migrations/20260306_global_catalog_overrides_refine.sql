begin;

alter table if exists public.catalog_items_global
  add column if not exists default_quantity integer not null default 0 check (default_quantity >= 0);

alter table if exists public.catalog_items_group_overrides
  add column if not exists override_quantity integer null check (override_quantity is null or override_quantity >= 0);

do $$
begin
  if to_regclass('public.catalog_items_global') is not null then
    execute 'create unique index if not exists catalog_items_global_category_name_idx on public.catalog_items_global (category, lower(name))';
    execute 'create index if not exists catalog_items_global_category_idx on public.catalog_items_global (category)';
  end if;
end
$$;

commit;
