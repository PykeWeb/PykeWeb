alter table if exists public.group_activity_entries
  add column if not exists equipment_quantity integer not null default 0;

update public.group_activity_entries
set equipment_quantity = case when equipment_item_id is null then 0 else 1 end
where equipment_quantity is null or equipment_quantity < 0;
