create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  group_name text null,
  actor_name text null,
  actor_source text not null default 'web',
  area text not null,
  action text not null,
  entity_type text null,
  entity_id text null,
  message text not null,
  payload jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists app_logs_group_created_idx on public.app_logs (group_id, created_at desc);
create index if not exists app_logs_created_idx on public.app_logs (created_at desc);
create index if not exists app_logs_area_action_idx on public.app_logs (area, action);

alter table public.app_logs enable row level security;

drop policy if exists "service role all app_logs" on public.app_logs;
create policy "service role all app_logs"
  on public.app_logs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
