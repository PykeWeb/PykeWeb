# Architecture rapide

## Dossiers clés
- `src/app` : routes Next.js (pages + API routes)
- `src/components/ui` : composants UI génériques
- `src/components/layout` : shell/app frame/topbar/sidebar
- `src/components/*` : composants métier (dashboard, transactions, etc.)
- `src/lib` : accès Supabase, API clients, utilitaires
- `supabase` : SQL de setup + migrations
- `docs` : guides de setup/architecture

## Où modifier quoi
- Objets: `src/app/objets/*` + `src/lib/objectsApi.ts`
- Armes: `src/app/armes/*` + `src/lib/weaponsApi.ts`
- Équipement: `src/app/equipement/*` + `src/lib/equipmentApi.ts`
- Drogues: `src/app/drogues/*` + `src/lib/drugsApi.ts`
- Admin: `src/app/admin/*` + `src/app/api/admin/*`
- Dashboard: `src/app/ui/DashboardClient.tsx`
