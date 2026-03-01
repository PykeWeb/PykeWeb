-- =========================================================
-- PYKEWEB / PYKESTOCK - FULL SUPABASE SETUP (V1)
-- Tables + Triggers + Indexes + RLS + Storage Buckets/Policies
-- =========================================================

-- 0) Extensions
create extension if not exists pgcrypto;

-- =========================================================
-- 1) Helpers: updated_at trigger
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- 2) UI SETTINGS
-- =========================================================
create table if not exists public.ui_settings (
  id text primary key,              -- ex: 'default'
  app_title text not null default 'PykeStock',
  theme jsonb not null default '{}'::jsonb,
  sidebar jsonb not null default '{}'::jsonb,
  categories jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_ui_settings_updated_at on public.ui_settings;
create trigger trg_ui_settings_updated_at
before update on public.ui_settings
for each row execute function public.set_updated_at();

-- seed default row
insert into public.ui_settings (id)
values ('default')
on conflict (id) do nothing;

-- =========================================================
-- 3) EXPENSES (Remboursements)
-- =========================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  label text not null,
  category text null,
  unit_price numeric(12,2) not null default 0,
  quantity int not null default 1,
  total_price numeric(12,2) not null default 0,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.expenses_compute_total()
returns trigger
language plpgsql
as $$
begin
  new.total_price = coalesce(new.unit_price,0) * coalesce(new.quantity,0);
  return new;
end;
$$;

drop trigger if exists trg_expenses_total on public.expenses;
create trigger trg_expenses_total
before insert or update on public.expenses
for each row execute function public.expenses_compute_total();

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create index if not exists idx_expenses_date on public.expenses(date);

-- =========================================================
-- 4) OBJECTS + MOVEMENTS
-- =========================================================
create table if not exists public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'OBJET',
  description text null,
  image_path text null, -- storage path in object-images
  quantity int not null default 0,
  min_quantity int not null default 0,
  unit text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_objects_updated_at on public.objects;
create trigger trg_objects_updated_at
before update on public.objects
for each row execute function public.set_updated_at();

create index if not exists idx_objects_name on public.objects(name);
create index if not exists idx_objects_category on public.objects(category);

create table if not exists public.object_stock_movements (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects(id) on delete cascade,
  movement_type text not null check (movement_type in ('IN','OUT','ADJUST')),
  quantity int not null check (quantity >= 0),
  reason text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_object_mov_object on public.object_stock_movements(object_id);
create index if not exists idx_object_mov_created on public.object_stock_movements(created_at);

-- =========================================================
-- 5) EQUIPMENT + MOVEMENTS
-- =========================================================
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'EQUIPEMENT',
  description text null,
  image_path text null, -- storage path in equipment-images
  quantity int not null default 0,
  min_quantity int not null default 0,
  unit text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_equipment_updated_at on public.equipment;
create trigger trg_equipment_updated_at
before update on public.equipment
for each row execute function public.set_updated_at();

create index if not exists idx_equipment_name on public.equipment(name);

create table if not exists public.equipment_stock_movements (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  movement_type text not null check (movement_type in ('IN','OUT','ADJUST')),
  quantity int not null check (quantity >= 0),
  reason text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_equipment_mov_equip on public.equipment_stock_movements(equipment_id);
create index if not exists idx_equipment_mov_created on public.equipment_stock_movements(created_at);

-- =========================================================
-- 6) DRUG ITEMS + MOVEMENTS
-- =========================================================
create table if not exists public.drug_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'DROGUE',
  description text null,
  image_path text null, -- storage path in drug-images
  quantity int not null default 0,
  min_quantity int not null default 0,
  unit text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_drug_items_updated_at on public.drug_items;
create trigger trg_drug_items_updated_at
before update on public.drug_items
for each row execute function public.set_updated_at();

create index if not exists idx_drug_items_name on public.drug_items(name);

create table if not exists public.drug_stock_movements (
  id uuid primary key default gen_random_uuid(),
  drug_item_id uuid not null references public.drug_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('IN','OUT','ADJUST')),
  quantity int not null check (quantity >= 0),
  reason text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_drug_mov_item on public.drug_stock_movements(drug_item_id);
create index if not exists idx_drug_mov_created on public.drug_stock_movements(created_at);

-- =========================================================
-- 7) WEAPONS + MOVEMENTS + LOANS
-- =========================================================
create table if not exists public.weapons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'ARME',
  description text null,
  image_path text null, -- storage path in weapon-images
  quantity int not null default 0,
  min_quantity int not null default 0,
  unit text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_weapons_updated_at on public.weapons;
create trigger trg_weapons_updated_at
before update on public.weapons
for each row execute function public.set_updated_at();

create index if not exists idx_weapons_name on public.weapons(name);

create table if not exists public.weapon_stock_movements (
  id uuid primary key default gen_random_uuid(),
  weapon_id uuid not null references public.weapons(id) on delete cascade,
  movement_type text not null check (movement_type in ('IN','OUT','ADJUST')),
  quantity int not null check (quantity >= 0),
  reason text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_weapon_mov_weapon on public.weapon_stock_movements(weapon_id);
create index if not exists idx_weapon_mov_created on public.weapon_stock_movements(created_at);

create table if not exists public.weapon_loans (
  id uuid primary key default gen_random_uuid(),
  weapon_id uuid not null references public.weapons(id) on delete cascade,
  borrower_name text not null,
  borrower_id text null, -- si tu stockes un ID RP / discord / etc
  quantity int not null default 1 check (quantity > 0),
  loaned_at timestamptz not null default now(),
  due_at timestamptz null,
  returned_at timestamptz null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_weapon_loans_updated_at on public.weapon_loans;
create trigger trg_weapon_loans_updated_at
before update on public.weapon_loans
for each row execute function public.set_updated_at();

create index if not exists idx_weapon_loans_weapon on public.weapon_loans(weapon_id);
create index if not exists idx_weapon_loans_returned on public.weapon_loans(returned_at);

-- =========================================================
-- 8) TRANSACTIONS (si ta page /transactions est active)
-- =========================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  type text not null check (type in ('BUY','SELL','TRANSFER','OTHER')),
  label text not null,
  amount numeric(12,2) not null default 0,
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_date on public.transactions(date);

-- =========================================================
-- 9) RLS + POLICIES (Choisis un mode)
-- =========================================================
alter table public.ui_settings enable row level security;
alter table public.expenses enable row level security;
alter table public.objects enable row level security;
alter table public.object_stock_movements enable row level security;
alter table public.equipment enable row level security;
alter table public.equipment_stock_movements enable row level security;
alter table public.drug_items enable row level security;
alter table public.drug_stock_movements enable row level security;
alter table public.weapons enable row level security;
alter table public.weapon_stock_movements enable row level security;
alter table public.weapon_loans enable row level security;
alter table public.transactions enable row level security;

-- Nettoyage (au cas où tu relances)
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'ui_settings','expenses',
        'objects','object_stock_movements',
        'equipment','equipment_stock_movements',
        'drug_items','drug_stock_movements',
        'weapons','weapon_stock_movements','weapon_loans',
        'transactions'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- =========================================================
-- MODE A) PUBLIC (SANS LOGIN) ✅
-- Décommenter ce bloc si tu veux "open bar" (anon peut CRUD)
-- =========================================================
create policy "public_crud_ui_settings" on public.ui_settings
for all using (true) with check (true);

create policy "public_crud_expenses" on public.expenses
for all using (true) with check (true);

create policy "public_crud_objects" on public.objects
for all using (true) with check (true);

create policy "public_crud_object_mov" on public.object_stock_movements
for all using (true) with check (true);

create policy "public_crud_equipment" on public.equipment
for all using (true) with check (true);

create policy "public_crud_equipment_mov" on public.equipment_stock_movements
for all using (true) with check (true);

create policy "public_crud_drug_items" on public.drug_items
for all using (true) with check (true);

create policy "public_crud_drug_mov" on public.drug_stock_movements
for all using (true) with check (true);

create policy "public_crud_weapons" on public.weapons
for all using (true) with check (true);

create policy "public_crud_weapon_mov" on public.weapon_stock_movements
for all using (true) with check (true);

create policy "public_crud_weapon_loans" on public.weapon_loans
for all using (true) with check (true);

create policy "public_crud_transactions" on public.transactions
for all using (true) with check (true);

-- =========================================================
-- MODE B) PROTÉGÉ (AVEC LOGIN) 🔒
-- Si tu veux protéger, COMMMMENTE le MODE A ci-dessus,
-- et DÉCOMMENTE le bloc ci-dessous (authenticated only).
-- =========================================================
-- create policy "auth_crud_ui_settings" on public.ui_settings
-- for all to authenticated using (true) with check (true);
-- create policy "auth_crud_expenses" on public.expenses
-- for all to authenticated using (true) with check (true);
-- create policy "auth_crud_objects" on public.objects
-- for all to authenticated using (true) with check (true);
-- create policy "auth_crud_object_mov" on public.object_stock_movements
-- for all to authenticated using (true) with check (true);
-- create policy "auth_crud_equipment" on public.equipment
-- for all to authenticated using (true) with check (true);
-- create policy "auth_crud_equipment_mov" on public.equipment_stock_movements
-- for all to authenticated using (true) with check (true);
-- create policy "auth_crud_drug_items" on public.drug_items
-- for all to authenticated using (true) with check (true);
-- create policy "auth_crud_drug_mov" on public.drug_stock_movements
-- for all to authenticated using (true) with check (true);
-- create policy "auth_crud_weapons" on public.weapons
-- for all to authenticated using (true) with check (true);
-- create policy "auth_crud_weapon_mov" on public.weapon_stock_movements
-- for all to authenticated using (true) with check (true);
-- create policy "auth_crud_weapon_loans" on public.weapon_loans
-- for all to authenticated using (true) with check (true);
-- create policy "auth_crud_transactions" on public.transactions
-- for all to authenticated using (true) with check (true);

-- =========================================================
-- 10) STORAGE BUCKETS + POLICIES
-- =========================================================
-- Create buckets (public = true for easy display)
insert into storage.buckets (id, name, public)
values
  ('object-images','object-images', true),
  ('equipment-images','equipment-images', true),
  ('drug-images','drug-images', true),
  ('weapon-images','weapon-images', true)
on conflict (id) do nothing;

-- Enable RLS on storage objects
alter table storage.objects enable row level security;

-- Drop existing policies safely
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='storage' and tablename='objects'
  loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
  end loop;
end $$;

-- Storage policies (PUBLIC mode)
-- Allow read for everyone (public buckets)
create policy "public_read_storage_objects"
on storage.objects for select
using (bucket_id in ('object-images','equipment-images','drug-images','weapon-images'));

-- Allow upload/update/delete for everyone (PUBLIC)
create policy "public_write_storage_objects"
on storage.objects for insert
with check (bucket_id in ('object-images','equipment-images','drug-images','weapon-images'));

create policy "public_update_storage_objects"
on storage.objects for update
using (bucket_id in ('object-images','equipment-images','drug-images','weapon-images'))
with check (bucket_id in ('object-images','equipment-images','drug-images','weapon-images'));

create policy "public_delete_storage_objects"
on storage.objects for delete
using (bucket_id in ('object-images','equipment-images','drug-images','weapon-images'));

-- Storage policies (PROTECTED mode) -> si tu passes en auth-only,
-- commente les 4 policies "public_*" au-dessus et décommente ça :
-- create policy "auth_read_storage_objects"
-- on storage.objects for select to authenticated
-- using (bucket_id in ('object-images','equipment-images','drug-images','weapon-images'));
-- create policy "auth_write_storage_objects"
-- on storage.objects for insert to authenticated
-- with check (bucket_id in ('object-images','equipment-images','drug-images','weapon-images'));
-- create policy "auth_update_storage_objects"
-- on storage.objects for update to authenticated
-- using (bucket_id in ('object-images','equipment-images','drug-images','weapon-images'))
-- with check (bucket_id in ('object-images','equipment-images','drug-images','weapon-images'));
-- create policy "auth_delete_storage_objects"
-- on storage.objects for delete to authenticated
-- using (bucket_id in ('object-images','equipment-images','drug-images','weapon-images'));

-- =========================================================
-- DONE ✅
-- =========================================================