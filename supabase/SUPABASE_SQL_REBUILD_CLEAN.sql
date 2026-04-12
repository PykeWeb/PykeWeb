-- Pyke Stock / Pyke Web
-- Reconstruction SQL propre pour projet Supabase vierge
-- Date: 2026-04-12

begin;

create extension if not exists pgcrypto;

-- ============================================================================
-- Fonctions utilitaires
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.jwt_claim(claim text)
returns text
language sql
stable
as $$
  select coalesce((current_setting('request.jwt.claims', true)::jsonb ->> claim), '');
$$;

create or replace function public.request_group_id()
returns uuid
language plpgsql
stable
as $$
declare
  raw text;
begin
  raw := nullif(public.jwt_claim('group_id'), '');
  if raw is null then
    return null;
  end if;
  return raw::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.jwt_claim('is_admin') in ('true', '1'), false)
      or coalesce(public.jwt_claim('role') = 'service_role', false)
      or auth.role() = 'service_role';
$$;

create or replace function public.can_access_group(target_group_id uuid)
returns boolean
language sql
stable
as $$
  select public.is_app_admin() or target_group_id = public.request_group_id();
$$;

-- ============================================================================
-- Référentiel groupes / accès
-- ============================================================================

create table if not exists public.tenant_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  badge text,
  login text not null,
  password text not null,
  image_url text,
  active boolean not null default true,
  paid_until timestamptz,
  discord_webhook_url text,
  discord_webhook_valid boolean,
  discord_webhook_last_error text,
  discord_webhook_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_groups_login_key unique (login)
);

create table if not exists public.group_roles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  name text not null,
  permissions text[] not null default '{}',
  salary numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_roles_group_name_key unique (group_id, name)
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  player_name text not null,
  player_identifier text,
  password text,
  is_admin boolean not null default false,
  grade_id uuid references public.group_roles(id) on delete set null,
  salary numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists group_members_group_identifier_key
  on public.group_members(group_id, player_identifier)
  where player_identifier is not null and length(trim(player_identifier)) > 0;

create unique index if not exists group_members_identifier_password_global_key
  on public.group_members(player_identifier, password)
  where player_identifier is not null and password is not null
    and length(trim(player_identifier)) > 0 and length(trim(password)) > 0;

-- ============================================================================
-- Catalogues / stocks / transactions
-- ============================================================================

create table if not exists public.catalog_items_global (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('objects','weapons','equipment','drugs')),
  item_type text,
  name text not null,
  price numeric(12,2) not null default 0 check (price >= 0),
  default_quantity integer not null default 0 check (default_quantity >= 0),
  description text,
  image_url text,
  weapon_id text,
  slug text generated always as (lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_items_global_category_name_key unique (category, name)
);

create table if not exists public.catalog_items_group_overrides (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  global_item_id uuid not null references public.catalog_items_global(id) on delete cascade,
  override_name text,
  override_price numeric(12,2),
  override_quantity integer check (override_quantity is null or override_quantity >= 0),
  override_description text,
  override_image_url text,
  override_item_type text,
  override_weapon_id text,
  is_hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint catalog_items_group_overrides_unique unique (group_id, global_item_id)
);

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  internal_id text not null,
  name text not null,
  category text not null check (category in ('objects','weapons','drugs','equipment','custom')),
  item_type text not null default 'other',
  description text,
  image_url text,
  buy_price numeric(12,2) not null default 0 check (buy_price >= 0),
  sell_price numeric(12,2) not null default 0 check (sell_price >= 0),
  internal_value numeric(12,2) not null default 0 check (internal_value >= 0),
  show_in_finance boolean not null default true,
  is_active boolean not null default true,
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  stackable boolean not null default true,
  max_stack integer not null default 100 check (max_stack >= 1),
  weight numeric(12,3),
  fivem_item_id text,
  hash text,
  rarity text check (rarity in ('common','rare','epic','legendary') or rarity is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_items_group_internal_id_key unique (group_id, internal_id)
);

create table if not exists public.objects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0,
  description text,
  image_url text,
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weapons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  weapon_id text,
  name text not null,
  description text,
  image_url text,
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0,
  description text,
  image_url text,
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drug_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  type text not null default 'other' check (type in ('drug','seed','planting','pouch','other')),
  name text not null,
  price numeric(12,2) not null default 0,
  description text,
  image_url text,
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  type text not null check (type in ('purchase','sale')),
  counterparty text,
  total numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  object_id uuid references public.objects(id) on delete set null,
  name_snapshot text,
  unit_price_snapshot numeric(12,2),
  image_url_snapshot text,
  quantity integer not null default 1 check (quantity > 0),
  line_total numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  object_id uuid references public.objects(id) on delete cascade,
  delta integer not null,
  unit_price_snapshot numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists public.weapon_stock_movements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  weapon_id uuid not null references public.weapons(id) on delete cascade,
  delta integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_stock_movements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  delta integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.drug_stock_movements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  drug_item_id uuid not null references public.drug_items(id) on delete cascade,
  delta integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.weapon_loans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  weapon_id uuid not null references public.weapons(id) on delete cascade,
  borrower_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  loaned_at timestamptz not null default now(),
  returned_at timestamptz,
  note text
);

-- ============================================================================
-- Finance
-- ============================================================================

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  member_name text not null,
  item_source text not null check (item_source in ('objects','weapons','equipment','drugs','custom')),
  item_id uuid,
  item_label text not null,
  unit_price numeric(12,2) not null default 0,
  unit_price_override numeric(12,2),
  quantity integer not null default 1 check (quantity > 0),
  total numeric(12,2) not null default 0,
  description text,
  proof_image_url text,
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint expenses_item_source_item_id_check check (
    (item_source = 'custom' and item_id is null) or
    (item_source in ('objects','weapons','equipment','drugs') and item_id is not null)
  )
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  item_id uuid not null references public.catalog_items(id) on delete restrict,
  mode text not null check (mode in ('buy','sell')),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  counterparty text,
  notes text,
  payment_mode text not null default 'cash' check (payment_mode in ('cash','bank','item','other','stock_in','stock_out')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_trades (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  mode text not null check (mode in ('buy','sell')),
  category text not null check (category in ('objects','weapons','equipment','drugs')),
  item_id uuid not null,
  item_name text not null,
  item_type text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Drogues / activités / annuaire / tablette / PWR
-- ============================================================================

create table if not exists public.drug_production_tracking (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  partner_name text not null,
  type text not null check (type in ('coke','meth','other')),
  quantity_sent integer not null default 0 check (quantity_sent >= 0),
  ratio numeric(10,2) not null default 1 check (ratio >= 0),
  expected_output integer not null default 0 check (expected_output >= 0),
  received_output integer not null default 0 check (received_output >= 0),
  status text not null default 'in_progress' check (status in ('in_progress','completed','cancelled')),
  note text,
  expected_date date,
  seed_price numeric(12,2),
  pouch_sale_price numeric(12,2),
  brick_transform_cost numeric(12,2),
  pouch_transform_cost numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_activity_settings (
  group_id uuid primary key references public.tenant_groups(id) on delete cascade,
  default_percent_per_object numeric(6,2) not null default 2,
  weekly_base_salary numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_activity_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  member_name text not null,
  activity_type text not null,
  object_item_id uuid,
  object_name text,
  item_name text not null,
  object_unit_price numeric(12,2),
  quantity integer not null default 1 check (quantity > 0),
  percent_per_object numeric(6,2) not null default 2,
  salary_amount numeric(12,2) not null default 0,
  equipment_item_id uuid,
  equipment_name text,
  equipment text,
  equipment_quantity integer not null default 0,
  proof_image_data text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.directory_contacts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  name text not null,
  partner_group text,
  phone text,
  activity text not null default 'other' check (activity in ('coke','meth','objects','weapons','equipment','group','other')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tablet_daily_item_options (
  key text primary key,
  name text not null,
  unit_price numeric(12,2) not null default 0,
  max_per_day integer not null default 2,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tablet_daily_item_options_price_check check (unit_price >= 0),
  constraint tablet_daily_item_options_max_check check (max_per_day >= 0 and max_per_day <= 100)
);

create table if not exists public.tablet_daily_runs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  member_name text not null,
  member_name_normalized text not null,
  day_key date not null,
  disqueuse_qty integer not null default 0,
  kit_cambus_qty integer not null default 0,
  total_items integer not null default 0,
  total_cost numeric(12,2) not null default 0,
  items_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tablet_daily_runs_group_day_member_key unique (group_id, day_key, member_name_normalized),
  constraint tablet_daily_runs_qty_check check (disqueuse_qty >= 0 and kit_cambus_qty >= 0 and total_items >= 0 and total_cost >= 0)
);

create table if not exists public.pwr_orders (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  title text not null,
  target_qty integer not null default 3000 check (target_qty > 0),
  truck_capacity integer not null default 475 check (truck_capacity > 0),
  delivered_qty integer not null default 0 check (delivered_qty >= 0),
  unit_label text not null default 'bidons',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pwr_order_checkpoints (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pwr_orders(id) on delete cascade,
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  delivered_qty integer not null default 0 check (delivered_qty >= 0),
  note text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Logs, support, UI
-- ============================================================================

create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  group_name text,
  user_id uuid,
  actor_name text,
  user_name text,
  actor_source text not null default 'web',
  source text not null default 'web',
  category text not null default 'other',
  area text not null,
  action_type text not null default 'autre',
  action text not null,
  target_type text,
  entity_type text,
  target_name text,
  entity_id text,
  quantity numeric(12,2),
  amount numeric(14,2),
  before_value text,
  after_value text,
  message text not null,
  note text,
  payload jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.patch_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  kind text not null check (kind in ('bug','message','rental')),
  message text not null,
  image_url text,
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ui_texts (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value text not null,
  scope text not null default 'global' check (scope in ('global','group')),
  group_id uuid references public.tenant_groups(id) on delete cascade,
  updated_at timestamptz not null default now(),
  constraint ui_texts_scope_group_consistency check (
    (scope = 'global' and group_id is null) or
    (scope = 'group' and group_id is not null)
  )
);

create table if not exists public.ui_layouts (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null default 'group' check (scope_type in ('global','group')),
  scope_id uuid references public.tenant_groups(id) on delete cascade,
  page_key text not null,
  "order" jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint ui_layouts_scope_id_check check (
    (scope_type = 'global' and scope_id is null) or
    (scope_type = 'group' and scope_id is not null)
  )
);

create table if not exists public.ui_settings (
  key text primary key,
  labels jsonb not null default '{}'::jsonb,
  layouts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  group_id uuid references public.tenant_groups(id) on delete cascade,
  scope_type text not null default 'group' check (scope_type in ('global','group','user')),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Index utiles
-- ============================================================================

create index if not exists idx_objects_group_created on public.objects(group_id, created_at desc);
create index if not exists idx_weapons_group_created on public.weapons(group_id, created_at desc);
create index if not exists idx_equipment_group_created on public.equipment(group_id, created_at desc);
create index if not exists idx_drug_items_group_created on public.drug_items(group_id, created_at desc);
create index if not exists idx_catalog_items_group_category on public.catalog_items(group_id, category);
create index if not exists idx_finance_transactions_group_created on public.finance_transactions(group_id, created_at desc);
create index if not exists idx_transactions_group_created on public.transactions(group_id, created_at desc);
create index if not exists idx_expenses_group_created on public.expenses(group_id, created_at desc);
create index if not exists idx_activity_entries_group_created on public.group_activity_entries(group_id, created_at desc);
create index if not exists idx_logs_group_created on public.app_logs(group_id, created_at desc);
create index if not exists idx_support_tickets_group_created on public.support_tickets(group_id, created_at desc);
create unique index if not exists idx_ui_texts_global_key on public.ui_texts(key) where scope='global' and group_id is null;
create unique index if not exists idx_ui_texts_group_key on public.ui_texts(group_id, key) where scope='group' and group_id is not null;
create unique index if not exists idx_ui_layouts_scope_page on public.ui_layouts(scope_type, scope_id, page_key);

-- ============================================================================
-- Triggers updated_at
-- ============================================================================

drop trigger if exists trg_tenant_groups_updated_at on public.tenant_groups;
create trigger trg_tenant_groups_updated_at before update on public.tenant_groups
for each row execute function public.set_updated_at();

drop trigger if exists trg_group_roles_updated_at on public.group_roles;
create trigger trg_group_roles_updated_at before update on public.group_roles
for each row execute function public.set_updated_at();

drop trigger if exists trg_group_members_updated_at on public.group_members;
create trigger trg_group_members_updated_at before update on public.group_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_catalog_items_global_updated_at on public.catalog_items_global;
create trigger trg_catalog_items_global_updated_at before update on public.catalog_items_global
for each row execute function public.set_updated_at();

drop trigger if exists trg_catalog_items_group_overrides_updated_at on public.catalog_items_group_overrides;
create trigger trg_catalog_items_group_overrides_updated_at before update on public.catalog_items_group_overrides
for each row execute function public.set_updated_at();

drop trigger if exists trg_catalog_items_updated_at on public.catalog_items;
create trigger trg_catalog_items_updated_at before update on public.catalog_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_objects_updated_at on public.objects;
create trigger trg_objects_updated_at before update on public.objects
for each row execute function public.set_updated_at();

drop trigger if exists trg_weapons_updated_at on public.weapons;
create trigger trg_weapons_updated_at before update on public.weapons
for each row execute function public.set_updated_at();

drop trigger if exists trg_equipment_updated_at on public.equipment;
create trigger trg_equipment_updated_at before update on public.equipment
for each row execute function public.set_updated_at();

drop trigger if exists trg_drug_items_updated_at on public.drug_items;
create trigger trg_drug_items_updated_at before update on public.drug_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at before update on public.expenses
for each row execute function public.set_updated_at();

drop trigger if exists trg_finance_transactions_updated_at on public.finance_transactions;
create trigger trg_finance_transactions_updated_at before update on public.finance_transactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_drug_production_tracking_updated_at on public.drug_production_tracking;
create trigger trg_drug_production_tracking_updated_at before update on public.drug_production_tracking
for each row execute function public.set_updated_at();

drop trigger if exists trg_group_activity_settings_updated_at on public.group_activity_settings;
create trigger trg_group_activity_settings_updated_at before update on public.group_activity_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_directory_contacts_updated_at on public.directory_contacts;
create trigger trg_directory_contacts_updated_at before update on public.directory_contacts
for each row execute function public.set_updated_at();

drop trigger if exists trg_tablet_daily_item_options_updated_at on public.tablet_daily_item_options;
create trigger trg_tablet_daily_item_options_updated_at before update on public.tablet_daily_item_options
for each row execute function public.set_updated_at();

drop trigger if exists trg_tablet_daily_runs_updated_at on public.tablet_daily_runs;
create trigger trg_tablet_daily_runs_updated_at before update on public.tablet_daily_runs
for each row execute function public.set_updated_at();

drop trigger if exists trg_pwr_orders_updated_at on public.pwr_orders;
create trigger trg_pwr_orders_updated_at before update on public.pwr_orders
for each row execute function public.set_updated_at();

drop trigger if exists trg_patch_notes_updated_at on public.patch_notes;
create trigger trg_patch_notes_updated_at before update on public.patch_notes
for each row execute function public.set_updated_at();

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at before update on public.support_tickets
for each row execute function public.set_updated_at();

drop trigger if exists trg_ui_texts_updated_at on public.ui_texts;
create trigger trg_ui_texts_updated_at before update on public.ui_texts
for each row execute function public.set_updated_at();

drop trigger if exists trg_ui_layouts_updated_at on public.ui_layouts;
create trigger trg_ui_layouts_updated_at before update on public.ui_layouts
for each row execute function public.set_updated_at();

drop trigger if exists trg_ui_settings_updated_at on public.ui_settings;
create trigger trg_ui_settings_updated_at before update on public.ui_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_preferences_updated_at on public.user_preferences;
create trigger trg_user_preferences_updated_at before update on public.user_preferences
for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS strict multi-tenant
-- ============================================================================

alter table public.tenant_groups enable row level security;
alter table public.group_roles enable row level security;
alter table public.group_members enable row level security;
alter table public.catalog_items_global enable row level security;
alter table public.catalog_items_group_overrides enable row level security;
alter table public.catalog_items enable row level security;
alter table public.objects enable row level security;
alter table public.weapons enable row level security;
alter table public.equipment enable row level security;
alter table public.drug_items enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.weapon_stock_movements enable row level security;
alter table public.equipment_stock_movements enable row level security;
alter table public.drug_stock_movements enable row level security;
alter table public.weapon_loans enable row level security;
alter table public.expenses enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_trades enable row level security;
alter table public.drug_production_tracking enable row level security;
alter table public.group_activity_settings enable row level security;
alter table public.group_activity_entries enable row level security;
alter table public.directory_contacts enable row level security;
alter table public.tablet_daily_item_options enable row level security;
alter table public.tablet_daily_runs enable row level security;
alter table public.pwr_orders enable row level security;
alter table public.pwr_order_checkpoints enable row level security;
alter table public.app_logs enable row level security;
alter table public.patch_notes enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ui_texts enable row level security;
alter table public.ui_layouts enable row level security;
alter table public.ui_settings enable row level security;
alter table public.user_preferences enable row level security;

-- nettoyage policy existantes
DO $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Table globale admin/service
create policy tenant_groups_select on public.tenant_groups
for select using (public.can_access_group(id));
create policy tenant_groups_update on public.tenant_groups
for update using (public.can_access_group(id)) with check (public.can_access_group(id));
create policy tenant_groups_insert on public.tenant_groups
for insert with check (public.is_app_admin());
create policy tenant_groups_delete on public.tenant_groups
for delete using (public.is_app_admin());

-- Helper pour tables group_id
DO $$
declare
  t text;
  tables text[] := array[
    'group_roles','group_members','catalog_items_group_overrides','catalog_items','objects','weapons','equipment','drug_items',
    'transactions','transaction_items','stock_movements','weapon_stock_movements','equipment_stock_movements','drug_stock_movements',
    'weapon_loans','expenses','finance_transactions','finance_trades','drug_production_tracking','group_activity_entries',
    'directory_contacts','tablet_daily_runs','pwr_orders','pwr_order_checkpoints','app_logs','support_tickets'
  ];
begin
  foreach t in array tables loop
    execute format('create policy %I on public.%I for select using (public.can_access_group(group_id))', t||'_select', t);
    execute format('create policy %I on public.%I for insert with check (public.can_access_group(group_id))', t||'_insert', t);
    execute format('create policy %I on public.%I for update using (public.can_access_group(group_id)) with check (public.can_access_group(group_id))', t||'_update', t);
    execute format('create policy %I on public.%I for delete using (public.can_access_group(group_id))', t||'_delete', t);
  end loop;
end $$;

create policy group_activity_settings_all on public.group_activity_settings
for all using (public.can_access_group(group_id)) with check (public.can_access_group(group_id));

create policy catalog_items_global_read on public.catalog_items_global
for select using (true);
create policy catalog_items_global_write_admin on public.catalog_items_global
for all using (public.is_app_admin()) with check (public.is_app_admin());

create policy tablet_daily_item_options_read on public.tablet_daily_item_options
for select using (true);
create policy tablet_daily_item_options_write_admin on public.tablet_daily_item_options
for all using (public.is_app_admin()) with check (public.is_app_admin());

create policy patch_notes_read on public.patch_notes
for select using (is_active or public.is_app_admin());
create policy patch_notes_write_admin on public.patch_notes
for all using (public.is_app_admin()) with check (public.is_app_admin());

create policy ui_texts_select on public.ui_texts
for select using (scope = 'global' or public.can_access_group(group_id));
create policy ui_texts_write on public.ui_texts
for all using (public.is_app_admin() or (scope='group' and public.can_access_group(group_id)))
with check (public.is_app_admin() or (scope='group' and public.can_access_group(group_id)));

create policy ui_layouts_select on public.ui_layouts
for select using ((scope_type = 'global') or public.can_access_group(scope_id));
create policy ui_layouts_write on public.ui_layouts
for all using (public.is_app_admin() or (scope_type='group' and public.can_access_group(scope_id)))
with check (public.is_app_admin() or (scope_type='group' and public.can_access_group(scope_id)));

create policy ui_settings_admin_only on public.ui_settings
for all using (public.is_app_admin()) with check (public.is_app_admin());

create policy user_preferences_select on public.user_preferences
for select using (
  public.is_app_admin()
  or (scope_type = 'group' and public.can_access_group(group_id))
  or (scope_type = 'global')
);
create policy user_preferences_write on public.user_preferences
for all using (
  public.is_app_admin()
  or (scope_type = 'group' and public.can_access_group(group_id))
) with check (
  public.is_app_admin()
  or (scope_type = 'group' and public.can_access_group(group_id))
);

-- ============================================================================
-- Storage buckets + policies
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('object-images', 'object-images', true),
  ('weapon-images', 'weapon-images', true),
  ('equipment-images', 'equipment-images', true),
  ('drug-images', 'drug-images', true),
  ('expense-proofs', 'expense-proofs', true),
  ('global-item-images', 'global-item-images', true),
  ('group-logos', 'group-logos', true),
  ('tablette-item-images', 'tablette-item-images', true),
  ('pwr-order-photos', 'pwr-order-photos', true)
on conflict (id) do nothing;

alter table if exists storage.objects enable row level security;

drop policy if exists storage_read_public on storage.objects;
create policy storage_read_public on storage.objects
for select using (bucket_id in (
  'object-images','weapon-images','equipment-images','drug-images','expense-proofs',
  'global-item-images','group-logos','tablette-item-images','pwr-order-photos'
));

drop policy if exists storage_write_admin_or_group on storage.objects;
create policy storage_write_admin_or_group on storage.objects
for all
using (
  public.is_app_admin()
  or (bucket_id in ('object-images','weapon-images','equipment-images','drug-images','expense-proofs','pwr-order-photos')
      and split_part(name, '/', 1) = coalesce(public.request_group_id()::text, '__none__'))
)
with check (
  public.is_app_admin()
  or (bucket_id in ('object-images','weapon-images','equipment-images','drug-images','expense-proofs','pwr-order-photos')
      and split_part(name, '/', 1) = coalesce(public.request_group_id()::text, '__none__'))
);

-- ============================================================================
-- Seeds minimales
-- ============================================================================

insert into public.ui_settings(key, labels, layouts)
values (
  'default',
  '{"site_name":"Pyke Stock","site_tagline":"Dashboard RP","nav_dashboard":"Dashboard","nav_items":"Items"}'::jsonb,
  '{}'::jsonb
)
on conflict (key) do nothing;

insert into public.tablet_daily_item_options(key, name, unit_price, max_per_day, image_url, sort_order, is_active)
values
  ('disqueuse', 'Disqueuse', 150, 2, '/images/tablette/image-2.svg', 10, true),
  ('kit_cambus', 'Kit de Cambriolage', 50, 2, '/images/tablette/image-1.svg', 20, true)
on conflict (key) do update set
  name = excluded.name,
  unit_price = excluded.unit_price,
  max_per_day = excluded.max_per_day,
  image_url = excluded.image_url,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

commit;
