-- Pyke Stock - Full Supabase setup (idempotent)
-- Safe to run multiple times in Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

insert into public.tenant_groups (name, badge, login, password, active, paid_until)
select 'Groupe Test', 'TEST', 'main', 'change_me_main_password', true, null
where not exists (select 1 from public.tenant_groups where login = 'main');

create table if not exists public.objects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  description text,
  image_url text,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists objects_group_id_idx on public.objects(group_id);
create index if not exists objects_name_idx on public.objects(name);

create table if not exists public.weapons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  weapon_id text,
  name text,
  description text,
  image_url text,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists weapons_group_id_idx on public.weapons(group_id);
create index if not exists weapons_name_idx on public.weapons(name);

create table if not exists public.weapon_loans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  weapon_id uuid not null references public.weapons(id) on delete cascade,
  borrower_name text not null,
  quantity integer not null default 1,
  loaned_at timestamptz not null default now(),
  returned_at timestamptz,
  note text
);
create index if not exists weapon_loans_group_id_idx on public.weapon_loans(group_id);
create index if not exists weapon_loans_weapon_id_idx on public.weapon_loans(weapon_id);
create index if not exists weapon_loans_returned_at_idx on public.weapon_loans(returned_at);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  description text,
  image_url text,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists equipment_group_id_idx on public.equipment(group_id);
create index if not exists equipment_name_idx on public.equipment(name);

create table if not exists public.drug_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  type text not null default 'other' check (type in ('drug','seed','planting','pouch','other')),
  name text not null,
  price numeric not null default 0,
  description text,
  image_url text,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists drug_items_group_id_idx on public.drug_items(group_id);
create index if not exists drug_items_name_idx on public.drug_items(name);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  type text not null check (type in ('purchase','sale')),
  counterparty text,
  total numeric,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists transactions_group_id_idx on public.transactions(group_id);
create index if not exists transactions_created_at_idx on public.transactions(created_at desc);

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  object_id uuid references public.objects(id) on delete set null,
  name_snapshot text,
  unit_price_snapshot numeric,
  quantity integer not null default 1,
  line_total numeric,
  created_at timestamptz not null default now()
);
create index if not exists transaction_items_group_id_idx on public.transaction_items(group_id);
create index if not exists transaction_items_transaction_id_idx on public.transaction_items(transaction_id);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  object_id uuid references public.objects(id) on delete cascade,
  delta integer not null,
  unit_price_snapshot numeric,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_group_id_idx on public.stock_movements(group_id);

create table if not exists public.weapon_stock_movements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  weapon_id uuid not null references public.weapons(id) on delete cascade,
  delta integer not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists weapon_stock_movements_group_id_idx on public.weapon_stock_movements(group_id);

create table if not exists public.equipment_stock_movements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  delta integer not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists equipment_stock_movements_group_id_idx on public.equipment_stock_movements(group_id);

create table if not exists public.drug_stock_movements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  drug_item_id uuid not null references public.drug_items(id) on delete cascade,
  delta integer not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists drug_stock_movements_group_id_idx on public.drug_stock_movements(group_id);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  member_name text not null,
  item_source text not null check (item_source in ('objects','weapons','equipment','drugs','custom')),
  item_id uuid,
  item_label text not null,
  unit_price numeric not null default 0,
  quantity integer not null default 1,
  total numeric not null default 0,
  description text,
  proof_image_url text,
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists expenses_group_id_idx on public.expenses(group_id);
create index if not exists expenses_created_at_idx on public.expenses(created_at desc);

create table if not exists public.patch_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists patch_notes_is_active_idx on public.patch_notes(is_active);
create index if not exists patch_notes_created_at_idx on public.patch_notes(created_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  kind text not null check (kind in ('bug','message')),
  message text not null,
  image_url text,
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at timestamptz not null default now()
);
create index if not exists support_tickets_group_id_idx on public.support_tickets(group_id);
create index if not exists support_tickets_kind_idx on public.support_tickets(kind);
create index if not exists support_tickets_status_idx on public.support_tickets(status);

create table if not exists public.ui_settings (
  key text primary key,
  labels jsonb not null default '{}'::jsonb,
  layouts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.ui_settings(key, labels, layouts)
values (
  'default',
  '{"site_name":"Pyke Stock","site_tagline":"Dashboard RP (FiveM)","nav_dashboard":"Dashboard","nav_objets":"Objets","nav_armes":"Armes","nav_equipement":"Équipement","nav_drogues":"Drogues","nav_depenses":"Dépenses"}'::jsonb,
  '{"drogues_plantations":["prod","coke","meth"]}'::jsonb
)
on conflict (key) do nothing;

create table if not exists public.ui_texts (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value text not null,
  scope text not null default 'global' check (scope in ('global','group')),
  group_id uuid null references public.tenant_groups(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create unique index if not exists ui_texts_unique_scope_key_group_idx
  on public.ui_texts (key, scope, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid));
create unique index if not exists ui_texts_unique_global_key_idx
  on public.ui_texts (key) where scope = 'global' and group_id is null;
create unique index if not exists ui_texts_unique_group_key_idx
  on public.ui_texts (key, group_id) where scope = 'group' and group_id is not null;
create index if not exists ui_texts_scope_idx on public.ui_texts(scope);
create index if not exists ui_texts_group_id_idx on public.ui_texts(group_id);

create table if not exists public.catalog_items_global (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('object','weapon','equipment','drug')),
  item_type text,
  name text not null,
  price numeric not null default 0,
  default_quantity integer not null default 0 check (default_quantity >= 0),
  description text,
  image_url text,
  weapon_id text,
  slug text generated always as (lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists catalog_items_global_slug_category_idx on public.catalog_items_global (category, slug);
create unique index if not exists catalog_items_global_category_name_idx on public.catalog_items_global (category, lower(name));
create index if not exists catalog_items_global_category_idx on public.catalog_items_global (category);

create table if not exists public.catalog_items_group_overrides (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  global_item_id uuid not null references public.catalog_items_global(id) on delete cascade,
  override_name text,
  override_price numeric,
  override_quantity integer check (override_quantity is null or override_quantity >= 0),
  override_description text,
  override_image_url text,
  override_item_type text,
  override_weapon_id text,
  is_hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (group_id, global_item_id)
);
create index if not exists catalog_overrides_group_idx on public.catalog_items_group_overrides(group_id);
create index if not exists catalog_overrides_global_idx on public.catalog_items_group_overrides(global_item_id);

create table if not exists public.ui_layouts (
  group_id uuid primary key references public.tenant_groups(id) on delete cascade,
  dashboard_quick_actions jsonb not null default '[]'::jsonb,
  dashboard_cards jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- updated_at triggers
drop trigger if exists trg_catalog_items_global_updated_at on public.catalog_items_global;
create trigger trg_catalog_items_global_updated_at
before update on public.catalog_items_global
for each row execute function public.set_updated_at();

drop trigger if exists trg_catalog_items_group_overrides_updated_at on public.catalog_items_group_overrides;
create trigger trg_catalog_items_group_overrides_updated_at
before update on public.catalog_items_group_overrides
for each row execute function public.set_updated_at();

drop trigger if exists trg_ui_settings_updated_at on public.ui_settings;
create trigger trg_ui_settings_updated_at
before update on public.ui_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_ui_layouts_updated_at on public.ui_layouts;
create trigger trg_ui_layouts_updated_at
before update on public.ui_layouts
for each row execute function public.set_updated_at();

drop trigger if exists trg_ui_texts_updated_at on public.ui_texts;
create trigger trg_ui_texts_updated_at
before update on public.ui_texts
for each row execute function public.set_updated_at();

-- Storage buckets used by app
insert into storage.buckets (id, name, public)
values
  ('object-images', 'object-images', true),
  ('weapon-images', 'weapon-images', true),
  ('equipment-images', 'equipment-images', true),
  ('drug-images', 'drug-images', true),
  ('expense-proofs', 'expense-proofs', true),
  ('global-item-images', 'global-item-images', true)
on conflict (id) do nothing;

alter table if exists storage.objects enable row level security;

-- permissive storage policies for public app model
DO $$
declare
  b text;
  buckets text[] := array['object-images','weapon-images','equipment-images','drug-images','expense-proofs','global-item-images'];
begin
  foreach b in array buckets loop
    begin
      execute format('create policy %I on storage.objects for select using (bucket_id = %L)', 'read_'||b, b);
    exception when duplicate_object then null;
    end;
    begin
      execute format('create policy %I on storage.objects for insert with check (bucket_id = %L)', 'insert_'||b, b);
    exception when duplicate_object then null;
    end;
    begin
      execute format('create policy %I on storage.objects for update using (bucket_id = %L) with check (bucket_id = %L)', 'update_'||b, b, b);
    exception when duplicate_object then null;
    end;
    begin
      execute format('create policy %I on storage.objects for delete using (bucket_id = %L)', 'delete_'||b, b);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- app relies on app-level scoping, keep tables open without RLS blocks
alter table if exists public.tenant_groups disable row level security;
alter table if exists public.objects disable row level security;
alter table if exists public.weapons disable row level security;
alter table if exists public.weapon_loans disable row level security;
alter table if exists public.equipment disable row level security;
alter table if exists public.drug_items disable row level security;
alter table if exists public.transactions disable row level security;
alter table if exists public.transaction_items disable row level security;
alter table if exists public.stock_movements disable row level security;
alter table if exists public.weapon_stock_movements disable row level security;
alter table if exists public.equipment_stock_movements disable row level security;
alter table if exists public.drug_stock_movements disable row level security;
alter table if exists public.expenses disable row level security;
alter table if exists public.patch_notes disable row level security;
alter table if exists public.support_tickets disable row level security;
alter table if exists public.ui_settings disable row level security;
alter table if exists public.ui_texts disable row level security;
alter table if exists public.catalog_items_global disable row level security;
alter table if exists public.catalog_items_group_overrides disable row level security;
alter table if exists public.ui_layouts disable row level security;

commit;
