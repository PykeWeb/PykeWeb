-- Items + Finance migration (non-breaking)
begin;

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  internal_id text not null,
  name text not null,
  category text not null check (category in ('objects','weapons','drugs','equipment','custom')),
  item_type text not null check (item_type in ('input','output','consumable','equipment','production','other')),
  description text null,
  image_url text null,
  buy_price numeric not null default 0 check (buy_price >= 0),
  sell_price numeric not null default 0 check (sell_price >= 0),
  internal_value numeric not null default 0 check (internal_value >= 0),
  show_in_finance boolean not null default true,
  is_active boolean not null default true,
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  stackable boolean not null default true,
  max_stack integer not null default 1 check (max_stack >= 1),
  weight numeric null,
  fivem_item_id text null,
  hash text null,
  rarity text null check (rarity in ('common','rare','epic','legendary') or rarity is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, internal_id)
);

create index if not exists catalog_items_group_category_idx on public.catalog_items(group_id, category);
create index if not exists catalog_items_group_created_idx on public.catalog_items(group_id, created_at desc);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  item_id uuid not null references public.catalog_items(id) on delete restrict,
  mode text not null check (mode in ('buy','sell')),
  quantity integer not null check (quantity > 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  total numeric not null default 0 check (total >= 0),
  counterparty text null,
  notes text null,
  payment_mode text not null default 'cash' check (payment_mode in ('cash','bank','item','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_transactions_group_created_idx on public.finance_transactions(group_id, created_at desc);
create index if not exists finance_transactions_item_idx on public.finance_transactions(item_id);

DROP TRIGGER IF EXISTS catalog_items_set_updated_at ON public.catalog_items;
create trigger catalog_items_set_updated_at
before update on public.catalog_items
for each row
execute function public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS finance_transactions_set_updated_at ON public.finance_transactions;
create trigger finance_transactions_set_updated_at
before update on public.finance_transactions
for each row
execute function public.set_updated_at_timestamp();

commit;
