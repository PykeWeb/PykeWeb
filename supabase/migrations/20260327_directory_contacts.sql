create table if not exists public.directory_contacts (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  name text not null,
  partner_group text null,
  phone text null,
  activity text not null default 'other' check (activity in ('coke', 'meth', 'objects', 'weapons', 'equipment', 'other')),
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_directory_contacts_group_created_at on public.directory_contacts(group_id, created_at desc);
create index if not exists idx_directory_contacts_group_activity on public.directory_contacts(group_id, activity);
create index if not exists idx_directory_contacts_group_name on public.directory_contacts(group_id, name);
