-- Finance patch: expenses delete compatibility, price override, unified finance view

begin;

alter table if exists public.expenses
  add column if not exists unit_price_override numeric null;

-- Replace the restrictive check with a version that allows catalog items with a per-expense override.
alter table if exists public.expenses
  drop constraint if exists expenses_item_source_check;

alter table if exists public.expenses
  add constraint expenses_item_source_check
  check (
    (
      item_source = 'custom'
      and item_id is null
    )
    or (
      item_source in ('objects', 'weapons', 'equipment', 'drugs')
      and item_id is not null
    )
  );

create index if not exists expenses_group_created_idx on public.expenses(group_id, created_at desc);
create index if not exists transactions_group_created_idx on public.transactions(group_id, created_at desc);
create index if not exists weapon_stock_movements_group_created_idx on public.weapon_stock_movements(group_id, created_at desc);
create index if not exists equipment_stock_movements_group_created_idx on public.equipment_stock_movements(group_id, created_at desc);
create index if not exists drug_stock_movements_group_created_idx on public.drug_stock_movements(group_id, created_at desc);

create or replace view public.finance_movements as
select
  e.id,
  e.group_id,
  'expenses'::text as source,
  'expense'::text as movement_type,
  e.item_source::text as category,
  e.item_label,
  e.member_name,
  e.quantity::numeric as quantity,
  e.total::numeric as amount,
  e.status::text as expense_status,
  e.created_at
from public.expenses e

union all

select
  t.id,
  t.group_id,
  'transactions'::text as source,
  case when t.type = 'purchase' then 'purchase' else 'sale' end as movement_type,
  'objects'::text as category,
  coalesce((select ti.name_snapshot from public.transaction_items ti where ti.transaction_id = t.id order by ti.created_at asc limit 1), 'Transaction') as item_label,
  t.counterparty as member_name,
  coalesce((select sum(ti.quantity)::numeric from public.transaction_items ti where ti.transaction_id = t.id), 0::numeric) as quantity,
  t.total::numeric as amount,
  null::text as expense_status,
  t.created_at
from public.transactions t

union all

select
  wsm.id,
  wsm.group_id,
  'weapon_stock_movements'::text as source,
  case when wsm.delta >= 0 then 'purchase' else 'sale' end as movement_type,
  'weapons'::text as category,
  coalesce(w.name, wsm.note, 'Mouvement arme') as item_label,
  null::text as member_name,
  abs(wsm.delta)::numeric as quantity,
  null::numeric as amount,
  null::text as expense_status,
  wsm.created_at
from public.weapon_stock_movements wsm
left join public.weapons w on w.id = wsm.weapon_id

union all

select
  esm.id,
  esm.group_id,
  'equipment_stock_movements'::text as source,
  case when esm.delta >= 0 then 'purchase' else 'sale' end as movement_type,
  'equipment'::text as category,
  coalesce(eq.name, esm.note, 'Mouvement équipement') as item_label,
  null::text as member_name,
  abs(esm.delta)::numeric as quantity,
  null::numeric as amount,
  null::text as expense_status,
  esm.created_at
from public.equipment_stock_movements esm
left join public.equipment eq on eq.id = esm.equipment_id

union all

select
  dsm.id,
  dsm.group_id,
  'drug_stock_movements'::text as source,
  case when dsm.delta >= 0 then 'purchase' else 'sale' end as movement_type,
  'drugs'::text as category,
  coalesce(di.name, dsm.note, 'Mouvement drogue') as item_label,
  null::text as member_name,
  abs(dsm.delta)::numeric as quantity,
  null::numeric as amount,
  null::text as expense_status,
  dsm.created_at
from public.drug_stock_movements dsm
left join public.drug_items di on di.id = dsm.drug_item_id;

commit;
