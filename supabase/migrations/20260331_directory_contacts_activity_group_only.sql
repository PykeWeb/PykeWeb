alter table if exists public.directory_contacts
  drop constraint if exists directory_contacts_activity_check;

alter table if exists public.directory_contacts
  add constraint directory_contacts_activity_check
  check (activity in ('coke', 'meth', 'objects', 'weapons', 'equipment', 'group', 'other'));
