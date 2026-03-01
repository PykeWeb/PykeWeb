-- ============================================
-- PYKE STOCK - UI SETTINGS (labels + layouts)
-- ============================================
-- Run in Supabase SQL Editor.

create table if not exists public.ui_settings (
  id uuid primary key default gen_random_uuid(),
  group_key text not null unique,
  labels jsonb,
  layouts jsonb,
  updated_at timestamptz not null default now()
);

-- update timestamp
create or replace function public.touch_ui_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_ui_settings on public.ui_settings;
create trigger trg_touch_ui_settings
before update on public.ui_settings
for each row execute function public.touch_ui_settings_updated_at();

-- Basic RLS: allow anon read/write for now (adjust later)
alter table public.ui_settings enable row level security;

drop policy if exists "ui_settings_read_all" on public.ui_settings;
create policy "ui_settings_read_all"
on public.ui_settings
for select
to anon, authenticated
using (true);

drop policy if exists "ui_settings_upsert_all" on public.ui_settings;
create policy "ui_settings_upsert_all"
on public.ui_settings
for insert
to anon, authenticated
with check (true);

drop policy if exists "ui_settings_update_all" on public.ui_settings;
create policy "ui_settings_update_all"
on public.ui_settings
for update
to anon, authenticated
using (true)
with check (true);
