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
