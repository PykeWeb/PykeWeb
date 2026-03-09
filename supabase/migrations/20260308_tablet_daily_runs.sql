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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tablet_daily_runs_qty_check check (
    disqueuse_qty >= 0 and disqueuse_qty <= 2
    and kit_cambus_qty >= 0 and kit_cambus_qty <= 2
    and total_items = disqueuse_qty + kit_cambus_qty
  )
);

create unique index if not exists tablet_daily_runs_group_day_member_idx
  on public.tablet_daily_runs (group_id, day_key, member_name_normalized);

create index if not exists tablet_daily_runs_group_created_idx
  on public.tablet_daily_runs (group_id, created_at desc);

drop trigger if exists trg_tablet_daily_runs_updated_at on public.tablet_daily_runs;
create trigger trg_tablet_daily_runs_updated_at
before update on public.tablet_daily_runs
for each row execute function public.set_updated_at();
