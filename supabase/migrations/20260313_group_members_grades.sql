begin;

create extension if not exists pgcrypto;

create table if not exists public.group_member_grades (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  name text not null,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tenant_groups(id) on delete cascade,
  player_name text not null,
  player_identifier text,
  grade_id uuid references public.group_member_grades(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists group_member_grades_group_name_idx
  on public.group_member_grades (group_id, name);

create index if not exists group_member_grades_group_id_idx
  on public.group_member_grades (group_id);

create index if not exists group_members_group_id_idx
  on public.group_members (group_id);

create index if not exists group_members_grade_id_idx
  on public.group_members (grade_id);

create unique index if not exists group_members_group_player_identifier_idx
  on public.group_members (group_id, player_identifier)
  where player_identifier is not null and length(trim(player_identifier)) > 0;

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_group_member_grades_updated_at on public.group_member_grades;
create trigger trg_group_member_grades_updated_at
before update on public.group_member_grades
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_group_members_updated_at on public.group_members;
create trigger trg_group_members_updated_at
before update on public.group_members
for each row execute function public.set_updated_at_timestamp();

alter table if exists public.group_member_grades disable row level security;
alter table if exists public.group_members disable row level security;

commit;
