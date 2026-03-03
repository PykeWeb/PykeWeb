# Supabase setup

## Duplication complète
1. Créer un nouveau projet Supabase.
2. Ouvrir **SQL Editor**.
3. Exécuter `supabase/SUPABASE_SQL_FULL_SETUP.sql`.
4. Configurer les variables Vercel.
5. Déployer.

## Vérification post-setup
- Vérifier les tables clés (ex: `tenant_groups`, `objects`, `weapons`, `equipment`, `drug_items`, `transactions`, `patch_notes`, `support_tickets`).
- Vérifier les buckets storage:
  - `object-images`
  - `weapon-images`
  - `equipment-images`
  - `drug-images`
  - `expense-proofs`
  - `global-item-images`
- Faire un smoke test applicatif (`/login`, lecture patch notes, page admin).

## Notes importantes
- Le script `SUPABASE_SQL_FULL_SETUP.sql` est **idempotent** (relançable).
- Le script **recrée la structure** (schéma), pas les données existantes métier (hors insertions de base prévues par le script).
- Les migrations sous `supabase/migrations/` sont conservées pour l’historique de production.


## Admin 
1. Executer le code en modifiant le MDP pour le compte admin
2. Bien modifier le mdp : 'TonNouveauMdpFort!2026'
3. 
-- 1) Vérifier les comptes admin potentiels
select id, name, badge, login, active, paid_until
from public.tenant_groups
where lower(login) = 'admin' or upper(coalesce(badge, '')) = 'ADMIN';

-- 2) Si le compte existe, réinitialiser le mot de passe
update public.tenant_groups
set password = 'TonNouveauMdpFort!2026', active = true
where lower(login) = 'admin' or upper(coalesce(badge, '')) = 'ADMIN';

-- 3) Si aucun compte admin n'existe, en créer un
insert into public.tenant_groups (name, badge, login, password, active, paid_until)
select 'Administration', 'ADMIN', 'admin', 'TonNouveauMdpFort!2026', true, null
where not exists (
  select 1 from public.tenant_groups
  where lower(login) = 'admin' or upper(coalesce(badge, '')) = 'ADMIN'
);
