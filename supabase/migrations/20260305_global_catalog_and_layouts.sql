begin;

create table if not exists public.catalog_items_global (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('object','weapon','equipment','drug')),
  item_type text null,
  name text not null,
  price numeric not null default 0,
  description text null,
  image_url text null,
  weapon_id text null,
  slug text generated always as (lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists catalog_items_global_slug_category_idx
  on public.catalog_items_global (category, slug);

create table if not exists public.catalog_items_group_overrides (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  global_item_id uuid not null references public.catalog_items_global(id) on delete cascade,
  override_name text null,
  override_price numeric null,
  override_description text null,
  override_image_url text null,
  override_item_type text null,
  override_weapon_id text null,
  is_hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (group_id, global_item_id)
);

create table if not exists public.ui_layouts (
  group_id uuid primary key references public.tenant_groups(id) on delete cascade,
  dashboard_quick_actions jsonb not null default '[]'::jsonb,
  dashboard_cards jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists catalog_overrides_group_idx on public.catalog_items_group_overrides(group_id);
create index if not exists catalog_overrides_global_idx on public.catalog_items_group_overrides(global_item_id);

commit;
