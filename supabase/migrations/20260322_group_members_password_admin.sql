alter table if exists public.group_members
  add column if not exists password text null,
  add column if not exists is_admin boolean not null default false;
