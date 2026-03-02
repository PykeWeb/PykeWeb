begin;

create extension if not exists pgcrypto;

create table if not exists public.ui_texts (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value text not null,
  scope text not null default 'global' check (scope in ('global','group')),
  group_id uuid null references public.tenant_groups(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create unique index if not exists ui_texts_unique_scope_key_group_idx
  on public.ui_texts (key, scope, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists ui_texts_scope_idx on public.ui_texts(scope);
create index if not exists ui_texts_group_id_idx on public.ui_texts(group_id);

commit;
