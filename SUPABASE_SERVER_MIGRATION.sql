-- PykeWeb server-first session + layout/preferences migration
-- Run with service_role in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  login_id text null,
  group_id uuid null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  user_agent text null,
  ip inet null,
  constraint sessions_owner_check check (user_id is not null or login_id is not null)
);

create index if not exists sessions_group_idx on public.sessions (group_id);
create index if not exists sessions_expires_idx on public.sessions (expires_at);
create index if not exists sessions_login_idx on public.sessions (login_id);

alter table public.ui_layouts
  add column if not exists scope_type text not null default 'group',
  add column if not exists scope_id text null,
  add column if not exists page_key text not null default 'unknown',
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists ui_layouts_scope_unique
  on public.ui_layouts (scope_type, coalesce(scope_id, ''), page_key);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  group_id uuid null,
  scope_type text not null default 'group' check (scope_type in ('global','group','user')),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_preferences_scope_key_unique
  on public.user_preferences (scope_type, coalesce(group_id::text, ''), coalesce(user_id::text, ''), key);

alter table public.sessions enable row level security;
alter table public.ui_layouts enable row level security;
alter table public.user_preferences enable row level security;

-- service role full access

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sessions' and policyname='sessions_service_role_all') then
    create policy sessions_service_role_all on public.sessions
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ui_layouts' and policyname='ui_layouts_service_role_all') then
    create policy ui_layouts_service_role_all on public.ui_layouts
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_preferences' and policyname='user_preferences_service_role_all') then
    create policy user_preferences_service_role_all on public.user_preferences
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
