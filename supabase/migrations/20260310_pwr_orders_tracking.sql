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

create index if not exists pwr_orders_group_idx on public.pwr_orders(group_id, created_at desc);

create table if not exists public.pwr_order_checkpoints (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pwr_orders(id) on delete cascade,
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  delivered_qty integer not null default 0 check (delivered_qty >= 0),
  note text null,
  photo_url text null,
  created_at timestamptz not null default now()
);

create index if not exists pwr_checkpoints_order_idx on public.pwr_order_checkpoints(order_id, created_at desc);
create index if not exists pwr_checkpoints_group_idx on public.pwr_order_checkpoints(group_id, created_at desc);

create or replace function public.pwr_orders_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pwr_orders_touch_updated_at on public.pwr_orders;
create trigger pwr_orders_touch_updated_at
before update on public.pwr_orders
for each row
execute procedure public.pwr_orders_touch_updated_at();
