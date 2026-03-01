-- ============================================
-- PYKE STOCK - NEW CATEGORIES (EQUIPEMENT / DROGUES / DEPENSES)
-- Run in Supabase SQL Editor
-- ============================================

-- 1) EQUIPEMENT
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12,2) not null default 0,
  description text,
  image_url text,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_stock_movements (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  delta integer not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.equipment enable row level security;
alter table public.equipment_stock_movements enable row level security;

do $$ begin
  create policy "public equipment access" on public.equipment for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public equipment movements access" on public.equipment_stock_movements for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- 2) DROGUES (catalog + stock + production)
create table if not exists public.drug_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('drug','seed','supply','lab','output')),
  name text not null,
  price numeric(12,2) not null default 0,
  description text,
  image_url text,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.drug_stock_movements (
  id uuid primary key default gen_random_uuid(),
  drug_item_id uuid not null references public.drug_items(id) on delete cascade,
  delta integer not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.drug_items enable row level security;
alter table public.drug_stock_movements enable row level security;

do $$ begin
  create policy "public drug items access" on public.drug_items for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public drug movements access" on public.drug_stock_movements for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- 3) DEPENSES (remboursements)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  member_name text not null,
  item_type text not null check (item_type in ('object','weapon','equipment','drug','custom')),
  item_ref_id uuid,
  item_name text not null,
  unit_price numeric(12,2) not null default 0,
  quantity integer not null default 1,
  total_price numeric(12,2) not null default 0,
  description text,
  proof_image_url text,
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.expenses enable row level security;

do $$ begin
  create policy "public expenses access" on public.expenses for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- 4) STORAGE BUCKETS
-- Create buckets in Supabase Dashboard > Storage if you prefer UI:
-- - equipment-images (public)
-- - drug-images (public)
-- - expense-proofs (public)

-- If you want SQL creation (may require elevated privileges), try:
-- insert into storage.buckets (id, name, public) values ('equipment-images','equipment-images', true) on conflict (id) do nothing;
-- insert into storage.buckets (id, name, public) values ('drug-images','drug-images', true) on conflict (id) do nothing;
-- insert into storage.buckets (id, name, public) values ('expense-proofs','expense-proofs', true) on conflict (id) do nothing;

-- Policies (open access) for these buckets:
-- NOTE: Storage policies target storage.objects
alter table storage.objects enable row level security;

do $$ begin
  create policy "public read equipment-images" on storage.objects for select using (bucket_id = 'equipment-images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public write equipment-images" on storage.objects for insert with check (bucket_id = 'equipment-images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public update equipment-images" on storage.objects for update using (bucket_id = 'equipment-images') with check (bucket_id = 'equipment-images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public read drug-images" on storage.objects for select using (bucket_id = 'drug-images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public write drug-images" on storage.objects for insert with check (bucket_id = 'drug-images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public update drug-images" on storage.objects for update using (bucket_id = 'drug-images') with check (bucket_id = 'drug-images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public read expense-proofs" on storage.objects for select using (bucket_id = 'expense-proofs');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public write expense-proofs" on storage.objects for insert with check (bucket_id = 'expense-proofs');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public update expense-proofs" on storage.objects for update using (bucket_id = 'expense-proofs') with check (bucket_id = 'expense-proofs');
exception when duplicate_object then null; end $$;
