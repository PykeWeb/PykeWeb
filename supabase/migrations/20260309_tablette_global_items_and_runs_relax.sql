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
  constraint tablet_daily_item_options_max_check check (max_per_day >= 0 and max_per_day <= 100),
  constraint tablet_daily_item_options_price_check check (unit_price >= 0)
);

insert into public.tablet_daily_item_options (key, name, unit_price, max_per_day, image_url, is_active, sort_order)
values
  ('disqueuse', 'Disqueuse', 150, 2, '/images/tablette/image-2.svg', true, 10),
  ('kit_cambus', 'Kit de Cambriolage', 50, 2, '/images/tablette/image-1.svg', true, 20)
on conflict (key) do update
set
  name = excluded.name,
  unit_price = excluded.unit_price,
  max_per_day = excluded.max_per_day,
  image_url = excluded.image_url,
  is_active = true,
  updated_at = now();

alter table public.tablet_daily_runs
  add column if not exists items_json jsonb not null default '[]'::jsonb;

alter table public.tablet_daily_runs
  drop constraint if exists tablet_daily_runs_qty_check;

alter table public.tablet_daily_runs
  add constraint tablet_daily_runs_qty_check check (
    disqueuse_qty >= 0
    and kit_cambus_qty >= 0
    and total_items >= 0
    and total_cost >= 0
  );
