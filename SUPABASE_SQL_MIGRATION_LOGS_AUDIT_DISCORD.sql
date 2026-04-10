-- Refonte logs audit + webhook Discord par groupe (multi-tenant)

alter table if exists public.app_logs
  add column if not exists user_id uuid null,
  add column if not exists user_name text null,
  add column if not exists category text not null default 'other',
  add column if not exists action_type text not null default 'autre',
  add column if not exists target_type text null,
  add column if not exists target_name text null,
  add column if not exists quantity numeric null,
  add column if not exists amount numeric null,
  add column if not exists before_value text null,
  add column if not exists after_value text null,
  add column if not exists note text null,
  add column if not exists metadata jsonb null,
  add column if not exists source text not null default 'web';

update public.app_logs
set
  source = coalesce(nullif(source, ''), actor_source, 'web'),
  user_name = coalesce(nullif(user_name, ''), actor_name),
  target_type = coalesce(nullif(target_type, ''), entity_type),
  category = case
    when lower(coalesce(area, '')) like '%finance%' or lower(coalesce(area, '')) like '%cash%' then 'finance'
    when lower(coalesce(area, '')) like '%stock%' or lower(coalesce(area, '')) like '%item%' or lower(coalesce(area, '')) like '%tablette%' then 'stock'
    when lower(coalesce(area, '')) like '%drog%' or lower(coalesce(area, '')) like '%meth%' then 'drugs'
    when lower(coalesce(area, '')) like '%arme%' or lower(coalesce(area, '')) like '%weapon%' then 'weapons'
    when lower(coalesce(area, '')) like '%admin%' or lower(coalesce(area, '')) like '%group%' then 'admin'
    when lower(coalesce(area, '')) like '%discord%' or lower(coalesce(area, '')) like '%webhook%' then 'discord'
    when lower(coalesce(area, '')) like '%system%' then 'system'
    else coalesce(nullif(category, ''), 'other')
  end,
  action_type = case
    when lower(coalesce(action, '')) like '%create%' or lower(coalesce(action, '')) like '%add%' then 'creation'
    when lower(coalesce(action, '')) like '%update%' or lower(coalesce(action, '')) like '%edit%' then 'modification'
    when lower(coalesce(action, '')) like '%delete%' or lower(coalesce(action, '')) like '%remove%' then 'suppression'
    when lower(coalesce(action, '')) like '%buy%' or lower(coalesce(action, '')) like '%achat%' then 'achat'
    when lower(coalesce(action, '')) like '%sell%' or lower(coalesce(action, '')) like '%vente%' then 'vente'
    when lower(coalesce(action, '')) like '%depot%' or lower(coalesce(action, '')) like '%deposit%' then 'depot'
    when lower(coalesce(action, '')) like '%retrait%' or lower(coalesce(action, '')) like '%withdraw%' then 'retrait'
    when lower(coalesce(action, '')) like '%entree%' then 'entree'
    when lower(coalesce(action, '')) like '%sortie%' then 'sortie'
    when lower(coalesce(action, '')) like '%pret%' then 'pret'
    when lower(coalesce(action, '')) like '%retour%' then 'retour'
    when lower(coalesce(action, '')) like '%permission%' then 'permission_modifiee'
    when lower(coalesce(action, '')) like '%webhook%' and lower(coalesce(action, '')) like '%test%' then 'webhook_test'
    when lower(coalesce(action, '')) like '%webhook%' then 'webhook_configuration'
    else coalesce(nullif(action_type, ''), 'autre')
  end
where true;

alter table if exists public.tenant_groups
  add column if not exists discord_webhook_url text null,
  add column if not exists discord_webhook_valid boolean null,
  add column if not exists discord_webhook_last_error text null,
  add column if not exists discord_webhook_updated_at timestamptz null;

create index if not exists idx_app_logs_group_created_at on public.app_logs (group_id, created_at desc);
create index if not exists idx_app_logs_group_category_action on public.app_logs (group_id, category, action_type, created_at desc);

-- Optional RLS hardening (uncomment if your project uses JWT claims with group_id):
-- alter table public.app_logs enable row level security;
-- create policy "app_logs_group_select" on public.app_logs for select using (group_id::text = auth.jwt()->>'group_id');
-- create policy "app_logs_group_insert" on public.app_logs for insert with check (group_id::text = auth.jwt()->>'group_id');
-- alter table public.tenant_groups enable row level security;
-- create policy "tenant_groups_self_update_webhook" on public.tenant_groups
--   for update using (id::text = auth.jwt()->>'group_id') with check (id::text = auth.jwt()->>'group_id');
