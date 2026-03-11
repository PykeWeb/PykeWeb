do $$
declare
  pwr_group_id uuid;
  table_name text;
  table_list text[] := array[
    'pwr_order_checkpoints',
    'pwr_orders',
    'finance_transactions',
    'finance_trades',
    'transactions',
    'expenses',
    'objects',
    'weapons',
    'equipment',
    'drug_items',
    'catalog_items_group_overrides',
    'catalog_items',
    'tablet_daily_runs',
    'tablette_rental_requests',
    'support_tickets',
    'logs',
    'ui_text_entries'
  ];
begin
  select id into pwr_group_id
  from public.tenant_groups
  where lower(login) = 'pwr'
  limit 1;

  if pwr_group_id is null then
    return;
  end if;

  foreach table_name in array table_list loop
    if to_regclass('public.' || table_name) is not null then
      execute format('delete from public.%I where group_id = $1', table_name) using pwr_group_id;
    end if;
  end loop;

  if to_regclass('public.transaction_items') is not null and to_regclass('public.transactions') is not null then
    delete from public.transaction_items where transaction_id not in (select id from public.transactions);
  end if;

  if to_regclass('public.ui_layouts') is not null then
    delete from public.ui_layouts where scope_type = 'group' and scope_id = pwr_group_id::text;
  end if;
end $$;
