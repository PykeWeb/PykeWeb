-- Add dedicated empty tenant group for PWR operations tracking
insert into public.tenant_groups (name, badge, login, password, active, paid_until)
select 'PWR', 'PWR', 'pwr', 'pwr', true, null
where not exists (
  select 1
  from public.tenant_groups
  where lower(login) = 'pwr'
);
