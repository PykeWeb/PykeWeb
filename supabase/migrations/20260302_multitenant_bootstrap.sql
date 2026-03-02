-- Multi-tenant bootstrap for PykeWeb
-- Safe/idempotent migration (can be re-run).
-- Run in Supabase SQL Editor.

begin;

-- 1) Required extension for gen_random_uuid()
create extension if not exists pgcrypto;

-- 2) Tenant groups table (required by /admin/groupes + /login)
create table if not exists public.tenant_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  badge text,
  login text not null,
  password text not null,
  active boolean not null default true,
  paid_until timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists tenant_groups_login_unique_idx on public.tenant_groups (login);
create index if not exists tenant_groups_active_idx on public.tenant_groups (active);
create index if not exists tenant_groups_paid_until_idx on public.tenant_groups (paid_until);

-- 3) Create a fallback/default tenant for existing data migration
insert into public.tenant_groups (name, badge, login, password, active, paid_until)
select 'Groupe Principal', 'MAIN', 'main', 'change_me_main_password', true, now() + interval '365 days'
where not exists (
  select 1 from public.tenant_groups where login = 'main'
);

-- 4) Add group_id to tenant-scoped business tables (if missing)
--    NOTE: these are the tables used by current frontend code.
alter table if exists public.objects add column if not exists group_id uuid;
alter table if exists public.weapons add column if not exists group_id uuid;
alter table if exists public.weapon_loans add column if not exists group_id uuid;
alter table if exists public.equipment add column if not exists group_id uuid;
alter table if exists public.drug_items add column if not exists group_id uuid;
alter table if exists public.transactions add column if not exists group_id uuid;
alter table if exists public.transaction_items add column if not exists group_id uuid;
alter table if exists public.stock_movements add column if not exists group_id uuid;
alter table if exists public.weapon_stock_movements add column if not exists group_id uuid;
alter table if exists public.equipment_stock_movements add column if not exists group_id uuid;
alter table if exists public.drug_stock_movements add column if not exists group_id uuid;
alter table if exists public.expenses add column if not exists group_id uuid;

-- 5) Backfill group_id for existing rows to fallback tenant
with fallback as (
  select id as group_id from public.tenant_groups where login = 'main' limit 1
)
update public.objects o
set group_id = f.group_id
from fallback f
where o.group_id is null;

with fallback as (
  select id as group_id from public.tenant_groups where login = 'main' limit 1
)
update public.weapons w
set group_id = f.group_id
from fallback f
where w.group_id is null;

with fallback as (
  select id as group_id from public.tenant_groups where login = 'main' limit 1
)
update public.weapon_loans wl
set group_id = f.group_id
from fallback f
where wl.group_id is null;

with fallback as (
  select id as group_id from public.tenant_groups where login = 'main' limit 1
)
update public.equipment e
set group_id = f.group_id
from fallback f
where e.group_id is null;

with fallback as (
  select id as group_id from public.tenant_groups where login = 'main' limit 1
)
update public.drug_items d
set group_id = f.group_id
from fallback f
where d.group_id is null;

with fallback as (
  select id as group_id from public.tenant_groups where login = 'main' limit 1
)
update public.transactions t
set group_id = f.group_id
from fallback f
where t.group_id is null;

with fallback as (
  select id as group_id from public.tenant_groups where login = 'main' limit 1
)
update public.transaction_items ti
set group_id = f.group_id
from fallback f
where ti.group_id is null;

with fallback as (
  select id as group_id from public.tenant_groups where login = 'main' limit 1
)
update public.stock_movements sm
set group_id = f.group_id
from fallback f
where sm.group_id is null;

with fallback as (
  select id as group_id from public.tenant_groups where login = 'main' limit 1
)
update public.weapon_stock_movements wsm
set group_id = f.group_id
from fallback f
where wsm.group_id is null;

with fallback as (
  select id as group_id from public.tenant_groups where login = 'main' limit 1
)
update public.equipment_stock_movements esm
set group_id = f.group_id
from fallback f
where esm.group_id is null;

with fallback as (
  select id as group_id from public.tenant_groups where login = 'main' limit 1
)
update public.drug_stock_movements dsm
set group_id = f.group_id
from fallback f
where dsm.group_id is null;

with fallback as (
  select id as group_id from public.tenant_groups where login = 'main' limit 1
)
update public.expenses ex
set group_id = f.group_id
from fallback f
where ex.group_id is null;

-- 6) Add FK constraints (if missing)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'objects_group_id_fkey') then
    alter table public.objects add constraint objects_group_id_fkey foreign key (group_id) references public.tenant_groups(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'weapons_group_id_fkey') then
    alter table public.weapons add constraint weapons_group_id_fkey foreign key (group_id) references public.tenant_groups(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'weapon_loans_group_id_fkey') then
    alter table public.weapon_loans add constraint weapon_loans_group_id_fkey foreign key (group_id) references public.tenant_groups(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'equipment_group_id_fkey') then
    alter table public.equipment add constraint equipment_group_id_fkey foreign key (group_id) references public.tenant_groups(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'drug_items_group_id_fkey') then
    alter table public.drug_items add constraint drug_items_group_id_fkey foreign key (group_id) references public.tenant_groups(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transactions_group_id_fkey') then
    alter table public.transactions add constraint transactions_group_id_fkey foreign key (group_id) references public.tenant_groups(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transaction_items_group_id_fkey') then
    alter table public.transaction_items add constraint transaction_items_group_id_fkey foreign key (group_id) references public.tenant_groups(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'stock_movements_group_id_fkey') then
    alter table public.stock_movements add constraint stock_movements_group_id_fkey foreign key (group_id) references public.tenant_groups(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'weapon_stock_movements_group_id_fkey') then
    alter table public.weapon_stock_movements add constraint weapon_stock_movements_group_id_fkey foreign key (group_id) references public.tenant_groups(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'equipment_stock_movements_group_id_fkey') then
    alter table public.equipment_stock_movements add constraint equipment_stock_movements_group_id_fkey foreign key (group_id) references public.tenant_groups(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'drug_stock_movements_group_id_fkey') then
    alter table public.drug_stock_movements add constraint drug_stock_movements_group_id_fkey foreign key (group_id) references public.tenant_groups(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'expenses_group_id_fkey') then
    alter table public.expenses add constraint expenses_group_id_fkey foreign key (group_id) references public.tenant_groups(id) on delete cascade;
  end if;
end $$;

-- 7) Set NOT NULL once backfill is complete
alter table if exists public.objects alter column group_id set not null;
alter table if exists public.weapons alter column group_id set not null;
alter table if exists public.weapon_loans alter column group_id set not null;
alter table if exists public.equipment alter column group_id set not null;
alter table if exists public.drug_items alter column group_id set not null;
alter table if exists public.transactions alter column group_id set not null;
alter table if exists public.transaction_items alter column group_id set not null;
alter table if exists public.stock_movements alter column group_id set not null;
alter table if exists public.weapon_stock_movements alter column group_id set not null;
alter table if exists public.equipment_stock_movements alter column group_id set not null;
alter table if exists public.drug_stock_movements alter column group_id set not null;
alter table if exists public.expenses alter column group_id set not null;

-- 8) Helpful indexes for tenant-scoped queries
create index if not exists objects_group_id_idx on public.objects(group_id);
create index if not exists weapons_group_id_idx on public.weapons(group_id);
create index if not exists weapon_loans_group_id_idx on public.weapon_loans(group_id);
create index if not exists equipment_group_id_idx on public.equipment(group_id);
create index if not exists drug_items_group_id_idx on public.drug_items(group_id);
create index if not exists transactions_group_id_idx on public.transactions(group_id);
create index if not exists transaction_items_group_id_idx on public.transaction_items(group_id);
create index if not exists stock_movements_group_id_idx on public.stock_movements(group_id);
create index if not exists weapon_stock_movements_group_id_idx on public.weapon_stock_movements(group_id);
create index if not exists equipment_stock_movements_group_id_idx on public.equipment_stock_movements(group_id);
create index if not exists drug_stock_movements_group_id_idx on public.drug_stock_movements(group_id);
create index if not exists expenses_group_id_idx on public.expenses(group_id);

commit;

-- Optional security hardening (RLS) can be added later.
-- Current app uses anon client-side access patterns and relies on app-level scoping.
