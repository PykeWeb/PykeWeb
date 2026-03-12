alter table if exists public.group_activity_settings
  add column if not exists default_percent_per_object numeric(6,2) not null default 2;

update public.group_activity_settings
set default_percent_per_object = coalesce(default_percent_per_object, percent_per_object, 2)
where true;

alter table if exists public.group_activity_entries
  add column if not exists object_item_id uuid,
  add column if not exists object_name text,
  add column if not exists object_unit_price numeric(12,2) not null default 0,
  add column if not exists percent_per_object numeric(6,2) not null default 2,
  add column if not exists salary_amount numeric(12,2) not null default 0,
  add column if not exists equipment_item_id uuid,
  add column if not exists equipment_name text;

create index if not exists idx_group_activity_entries_object on public.group_activity_entries(group_id, object_item_id);
