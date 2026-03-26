-- Suivi des productions externes (coke, meth, autres)

create table if not exists public.drug_production_tracking (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  partner_name text not null,
  type text not null check (type in ('coke', 'meth', 'other')),
  quantity_sent integer not null default 0 check (quantity_sent >= 0),
  ratio numeric(10,2) not null default 1 check (ratio >= 0),
  expected_output integer not null default 0 check (expected_output >= 0),
  received_output integer not null default 0 check (received_output >= 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  expected_date date
);

create index if not exists drug_production_tracking_group_created_idx
  on public.drug_production_tracking (group_id, created_at desc);

create index if not exists drug_production_tracking_group_status_idx
  on public.drug_production_tracking (group_id, status);
