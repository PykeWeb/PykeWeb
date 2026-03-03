-- Pyke Stock patch: equipment RLS compatibility for anon/authenticated client inserts.
-- Idempotent migration.

begin;

alter table if exists public.equipment enable row level security;

-- Keep scoped access (group_id must be present) while allowing frontend anon/authenticated clients.
drop policy if exists equipment_select_policy on public.equipment;
create policy equipment_select_policy
  on public.equipment
  for select
  to anon, authenticated
  using (group_id is not null);

drop policy if exists equipment_insert_policy on public.equipment;
create policy equipment_insert_policy
  on public.equipment
  for insert
  to anon, authenticated
  with check (group_id is not null);

drop policy if exists equipment_update_policy on public.equipment;
create policy equipment_update_policy
  on public.equipment
  for update
  to anon, authenticated
  using (group_id is not null)
  with check (group_id is not null);

drop policy if exists equipment_delete_policy on public.equipment;
create policy equipment_delete_policy
  on public.equipment
  for delete
  to anon, authenticated
  using (group_id is not null);

grant select, insert, update, delete on public.equipment to anon, authenticated;

commit;
