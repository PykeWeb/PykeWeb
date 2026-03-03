-- Pyke Stock - Finance + Catalogue global patch
-- 1) Fix expenses override price compatibility
-- 2) Add finance_trades log table used by FinanceTradeModal
-- 3) Add catalog_global_items view (all item categories in one source)

begin;

alter table if exists public.expenses
  add column if not exists unit_price_override numeric null;

alter table if exists public.expenses
  drop constraint if exists expenses_item_source_check;

alter table if exists public.expenses
  add constraint expenses_item_source_check
  check (
    (item_source = 'custom' and item_id is null)
    or
    (item_source in ('objects', 'weapons', 'equipment', 'drugs') and item_id is not null)
  );

create table if not exists public.finance_trades (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  mode text not null check (mode in ('buy', 'sell')),
  category text not null check (category in ('objects', 'weapons', 'equipment', 'drugs')),
  item_id uuid not null,
  item_name text not null,
  item_type text null,
  quantity integer not null check (quantity > 0),
  unit_price numeric not null default 0,
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists finance_trades_group_created_idx on public.finance_trades(group_id, created_at desc);

create or replace view public.catalog_global_items as
select
  o.group_id,
  ('objects:' || o.id::text) as id,
  o.id as source_id,
  'objects'::text as category,
  null::text as item_type,
  o.name,
  coalesce(o.price, 0)::numeric as price,
  coalesce(o.stock, 0)::integer as stock,
  o.created_at
from public.objects o
union all
select
  w.group_id,
  ('weapons:' || w.id::text) as id,
  w.id as source_id,
  'weapons'::text as category,
  null::text as item_type,
  coalesce(w.name, w.weapon_id, 'Arme') as name,
  0::numeric as price,
  coalesce(w.stock, 0)::integer as stock,
  w.created_at
from public.weapons w
union all
select
  e.group_id,
  ('equipment:' || e.id::text) as id,
  e.id as source_id,
  'equipment'::text as category,
  null::text as item_type,
  e.name,
  coalesce(e.price, 0)::numeric as price,
  coalesce(e.stock, 0)::integer as stock,
  e.created_at
from public.equipment e
union all
select
  d.group_id,
  ('drugs:' || d.id::text) as id,
  d.id as source_id,
  'drugs'::text as category,
  d.type::text as item_type,
  d.name,
  coalesce(d.price, 0)::numeric as price,
  coalesce(d.stock, 0)::integer as stock,
  d.created_at
from public.drug_items d;

commit;
