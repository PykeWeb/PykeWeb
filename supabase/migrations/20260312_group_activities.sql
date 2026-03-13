create table if not exists public.group_activity_settings (
  group_id text primary key,
  percent_per_object numeric(6,2) not null default 2,
  weekly_base_salary numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_activity_entries (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  member_name text not null,
  activity_type text not null,
  equipment text null,
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  proof_image_data text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_group_activity_entries_group_date on public.group_activity_entries(group_id, created_at desc);
create index if not exists idx_group_activity_entries_member on public.group_activity_entries(group_id, member_name);
