begin;

alter table if exists public.group_members
  add column if not exists password_hash text null,
  add column if not exists discord_user_id text null,
  add column if not exists discord_username text null,
  add column if not exists rp_phone_number text null,
  add column if not exists is_active boolean not null default true,
  add column if not exists disabled_at timestamptz null;

create unique index if not exists group_members_group_discord_user_id_idx
  on public.group_members (group_id, discord_user_id)
  where discord_user_id is not null and length(trim(discord_user_id)) > 0;

create unique index if not exists group_members_group_rp_phone_active_idx
  on public.group_members (group_id, rp_phone_number)
  where is_active = true and rp_phone_number is not null and length(trim(rp_phone_number)) > 0;

create index if not exists group_members_group_active_idx
  on public.group_members (group_id, is_active);

commit;
