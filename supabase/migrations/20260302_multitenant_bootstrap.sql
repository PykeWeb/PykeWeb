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


-- Allow admin group management from client app (anon key) when RLS is enabled in project defaults
alter table if exists public.tenant_groups disable row level security;

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

-- 5) Backfill group_id + FK + NOT NULL + index
--    Important: some projects do not have all stock_movement tables.
--    We therefore run these steps only for tables that actually exist.
do $$
declare
  tbl text;
  fk_name text;
  idx_name text;
  scoped_tables text[] := array[
    'objects',
    'weapons',
    'weapon_loans',
    'equipment',
    'drug_items',
    'transactions',
    'transaction_items',
    'stock_movements',
    'weapon_stock_movements',
    'equipment_stock_movements',
    'drug_stock_movements',
    'expenses'
  ];
begin
  foreach tbl in array scoped_tables loop
    if to_regclass(format('public.%I', tbl)) is not null then
      -- Backfill current table with the fallback tenant.
      execute format(
        'with fallback as (
           select id as group_id from public.tenant_groups where login = %L limit 1
         )
         update public.%I t
         set group_id = f.group_id
         from fallback f
         where t.group_id is null',
        'main',
        tbl
      );

      -- Add FK only when missing.
      fk_name := format('%s_group_id_fkey', tbl);
      if not exists (
        select 1
        from pg_constraint
        where conname = fk_name
          and conrelid = to_regclass(format('public.%I', tbl))
      ) then
        execute format(
          'alter table public.%I
             add constraint %I
             foreign key (group_id)
             references public.tenant_groups(id)
             on delete cascade',
          tbl,
          fk_name
        );
      end if;

      -- Lock multi-tenant invariants.
      execute format('alter table public.%I alter column group_id set not null', tbl);

      idx_name := format('%s_group_id_idx', tbl);
      execute format('create index if not exists %I on public.%I(group_id)', idx_name, tbl);
    end if;
  end loop;
end $$;

commit;

-- Optional security hardening (RLS) can be added later.
-- Current app uses anon client-side access patterns and relies on app-level scoping.
