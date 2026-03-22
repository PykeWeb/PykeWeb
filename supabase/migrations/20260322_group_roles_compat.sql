-- Ensure role/member tables exist and keep backward compatibility with legacy "grades" naming.

create table if not exists public.group_roles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  name text not null,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists group_roles_group_name_idx
  on public.group_roles (group_id, name);

create index if not exists group_roles_group_id_idx
  on public.group_roles (group_id);

do $$
begin
  if to_regclass('public.group_member_grades') is not null then
    insert into public.group_roles (id, group_id, name, permissions, created_at, updated_at)
    select g.id, g.group_id, g.name, coalesce(to_jsonb(g.permissions), '[]'::jsonb), g.created_at, g.updated_at
    from public.group_member_grades g
    where not exists (
      select 1 from public.group_roles r where r.id = g.id
    )
    on conflict (id) do nothing;
  end if;
end $$;

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  player_name text not null,
  player_identifier text null,
  grade_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_members_group_id_idx on public.group_members (group_id);
create index if not exists group_members_grade_id_idx on public.group_members (grade_id);

alter table if exists public.group_member_grades disable row level security;
alter table if exists public.group_roles disable row level security;
alter table if exists public.group_members disable row level security;
