# Cleanup Report

## Fichiers supprimés (safe)
- `New SQL.sql` — ancien script SQL non référencé, schéma partiellement divergent du code actuel.
- `SUPABASE_SQL_NEW_CATEGORIES.sql` — script SQL historique redondant avec le nouveau setup full.
- `SUPABASE_SQL_UI_SETTINGS.sql` — script SQL isolé désormais intégré dans le setup full.

## Fichiers déplacés
- `src/components/AppFrame.tsx` → `src/components/layout/AppFrame.tsx`
- `src/components/Sidebar.tsx` → `src/components/layout/Sidebar.tsx`
- `src/components/Topbar.tsx` → `src/components/layout/Topbar.tsx`

## Fichiers conservés “par prudence”
- `docs/supabase-multitenant.md` — doc historique utile pour contexte migration.
- `supabase/migrations/*.sql` — conservés pour traçabilité historique des changements DB en prod.
- `src/components/dashboard/DashboardHeader.tsx` — potentiellement réutilisable ; suppression non garantie 100% safe sans audit runtime complet.
- `src/components/drag/DraggableModules.tsx` — composant de module potentiellement utilisé par configuration UI.
- `node_modules/` (non versionné) — conservé localement, hors scope git.

## TODO éventuels
- Ajouter une vérification automatisée de dead code (ex: `ts-prune`) dans CI.
- Ajouter un check de schéma SQL ↔ code (lint SQL / migration drift check).
