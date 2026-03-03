begin;

alter table if exists public.ui_layouts rename to ui_layouts_legacy;

create table if not exists public.ui_layouts (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('global','group')),
  scope_id text null,
  page_key text not null,
  "order" jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists ui_layouts_scope_page_key_uidx
  on public.ui_layouts (scope_type, scope_id, page_key);

alter table public.ui_layouts enable row level security;

drop policy if exists ui_layouts_select_policy on public.ui_layouts;
create policy ui_layouts_select_policy on public.ui_layouts
for select
using (true);

drop policy if exists ui_layouts_group_upsert_policy on public.ui_layouts;
create policy ui_layouts_group_upsert_policy on public.ui_layouts
for all
using (
  scope_type = 'group'
)
with check (
  scope_type = 'group'
);

drop policy if exists ui_layouts_global_admin_policy on public.ui_layouts;
create policy ui_layouts_global_admin_policy on public.ui_layouts
for all
using (
  scope_type = 'global'
)
with check (
  scope_type = 'global'
);

commit;
