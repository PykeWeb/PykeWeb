-- ============================================
-- PYKEWEB - UI SETTINGS (labels + layouts)
-- Run in Supabase SQL Editor
-- ============================================

create table if not exists public.ui_settings (
  key text primary key,
  labels jsonb not null default '{}'::jsonb,
  layouts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Optional: ensure default row exists
insert into public.ui_settings (key, labels, layouts)
values (
  'default',
  '{"site_name":"Pyke Stock","site_tagline":"Dashboard RP (FiveM)","nav_dashboard":"Dashboard","nav_objets":"Objets","nav_armes":"Armes","nav_equipement":"Équipement","nav_drogues":"Drogues","nav_depenses":"Dépenses","nav_reglages":"Réglages"}'::jsonb,
  '{"drogues_plantations":["prod","coke","meth"]}'::jsonb
)
on conflict (key) do nothing;
