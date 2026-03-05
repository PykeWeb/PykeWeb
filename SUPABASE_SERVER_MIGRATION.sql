-- Server-first session and UI layout normalization for PykeWeb
-- Safe to run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.server_sessions (
  id uuid primary key default gen_random_uuid(),
  principal_login text not null,
  group_id uuid,
  is_admin boolean not null default false,
  user_agent text,
  ip inet,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists server_sessions_principal_idx on public.server_sessions (principal_login);
create index if not exists server_sessions_group_idx on public.server_sessions (group_id);
create index if not exists server_sessions_exp_idx on public.server_sessions (expires_at);

alter table if exists public.ui_layouts
  add column if not exists scope_type text not null default 'group',
  add column if not exists scope_id text,
  add column if not exists page_key text not null default 'unknown',
  add column if not exists item_order jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists ui_layouts_scope_page_idx
  on public.ui_layouts (scope_type, scope_id, page_key);

-- Optional RLS baseline (uncomment if you use Supabase auth users)
-- alter table public.server_sessions enable row level security;
-- create policy "service role only" on public.server_sessions
--   using (auth.role() = 'service_role')
--   with check (auth.role() = 'service_role');
