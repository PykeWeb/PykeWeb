-- Ajout des champs de pricing par demande pour conserver les estimations

alter table if exists public.drug_production_tracking
  add column if not exists seed_price numeric(12,2),
  add column if not exists pouch_sale_price numeric(12,2),
  add column if not exists brick_transform_cost numeric(12,2),
  add column if not exists pouch_transform_cost numeric(12,2);
