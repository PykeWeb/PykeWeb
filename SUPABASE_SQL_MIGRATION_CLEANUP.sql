-- Cleanup migration: safe constraints/indexes/triggers alignment for items + finance tables
begin;

-- Reuse single updated_at trigger function
create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- catalog_items hardening (safe)
alter table if exists public.catalog_items
  add column if not exists internal_id text,
  add column if not exists category text,
  add column if not exists item_type text,
  add column if not exists buy_price numeric default 0,
  add column if not exists sell_price numeric default 0,
  add column if not exists internal_value numeric default 0,
  add column if not exists show_in_finance boolean default true,
  add column if not exists is_active boolean default true,
  add column if not exists stock integer default 0,
  add column if not exists low_stock_threshold integer default 0,
  add column if not exists stackable boolean default true,
  add column if not exists max_stack integer default 1,
  add column if not exists updated_at timestamptz default now();

create index if not exists catalog_items_group_category_idx on public.catalog_items(group_id, category);
create index if not exists catalog_items_group_created_idx on public.catalog_items(group_id, created_at desc);
create unique index if not exists catalog_items_group_internal_id_uidx on public.catalog_items(group_id, internal_id);

-- finance_transactions hardening (safe)
alter table if exists public.finance_transactions
  add column if not exists payment_mode text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz default now();

create index if not exists finance_transactions_group_created_idx on public.finance_transactions(group_id, created_at desc);
create index if not exists finance_transactions_item_idx on public.finance_transactions(item_id);

-- Triggers updated_at
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
