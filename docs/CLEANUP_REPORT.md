# Cleanup Report

## Périmètre
Refactor interne uniquement (sans changement de routes, design ou logique métier).

## Fichiers supprimés (100% safe)
- `New SQL.sql` — aucun import/référence runtime, script legacy divergent.
- `SUPABASE_SQL_NEW_CATEGORIES.sql` — script SQL redondant avec `SUPABASE_SQL_FULL_SETUP.sql`.
- `SUPABASE_SQL_UI_SETTINGS.sql` — script isolé déjà couvert par le setup full.

## Fichiers déplacés
- `CLEANUP_REPORT.md` → `docs/CLEANUP_REPORT.md`.
- `src/lib/brand.ts` → `src/lib/constants/brand.ts`.
- `src/lib/supabaseClient.ts` → `src/lib/supabase/client.ts`.
- `src/lib/server/supabaseAdmin.ts` → `src/lib/supabase/admin.ts`.
- `src/components/dashboard/StatCard.tsx` → `src/components/modules/dashboard/StatCard.tsx`.
- `src/components/transactions/TransactionBuilder.tsx` → `src/components/modules/transactions/TransactionBuilder.tsx`.
- `src/components/objets/ImageDropzone.tsx` → `src/components/modules/objets/ImageDropzone.tsx`.

## Imports mis à jour
- `@/lib/brand` → `@/lib/constants/brand`
- `@/lib/supabaseClient` → `@/lib/supabase/client`
- `@/lib/server/supabaseAdmin` → `@/lib/supabase/admin`
- `@/components/dashboard/StatCard` → `@/components/modules/dashboard/StatCard`
- `@/components/transactions/TransactionBuilder` → `@/components/modules/transactions/TransactionBuilder`
- `@/components/objets/ImageDropzone` → `@/components/modules/objets/ImageDropzone`

## Fichiers suspects conservés (prudence)
- `src/components/dashboard/DashboardHeader.tsx` — non référencé actuellement, conservé pour éviter suppression d’un composant potentiel en attente d’intégration.
- `src/components/drag/DraggableModules.tsx` — non référencé actuellement, conservé faute de preuve produit/feature formellement abandonnée.
- `supabase/migrations/*.sql` — conservées pour traçabilité historique prod.

## Vérifications d’audit effectuées
- Recherche d’usages/imports via `rg` sur composants/modules/lib.
- Vérification des variables env réellement utilisées via recherche `process.env`.
- Vérification des routes API patch notes/admin pour séparation public/admin.

## TODO optionnels
- Ajouter un check de dead-code en CI (ex: `ts-prune`) pour fiabiliser les suppressions futures.
- Ajouter un contrôle de drift schéma SQL vs code applicatif.
