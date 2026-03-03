# Architecture Pyke Stock

## Vue d’ensemble
Le projet est organisé pour séparer clairement :
- **routes/pages** (`src/app`)
- **composants UI génériques** (`src/components/ui`)
- **composants de layout** (`src/components/layout`)
- **composants métier** (`src/components/modules/*`)
- **accès données / clients** (`src/lib/*`)

## Arborescence logique
- `src/app` : App Router Next.js (pages + API routes)
- `src/components/ui` : composants réutilisables génériques
- `src/components/layout` : AppFrame, Sidebar, Topbar
- `src/components/modules` : composants par domaine
  - `dashboard`
  - `objets`
  - `transactions`
- `src/lib/constants` : constantes globales (branding)
- `src/lib/supabase` : clients Supabase (client public + admin server)
- `src/lib/*` : APIs domaine, utilitaires, scope/session tenant
- `supabase/` : SQL full setup + migrations
- `docs/` : documentation opérationnelle

## Conventions
- **Composants React** : `PascalCase.tsx`
- **Dossiers métier** : `kebab-case`
- **Alias imports** : `@/` (basé sur `src`)
- **Aucune logique métier dans `components/ui`**

## Où modifier quoi
- Objets : `src/app/objets/*`, `src/lib/objectsApi.ts`, `src/components/modules/objets/*`
- Armes : `src/app/armes/*`, `src/lib/weaponsApi.ts`
- Équipement : `src/app/equipement/*`, `src/lib/equipmentApi.ts`
- Drogues : `src/app/drogues/*`, `src/lib/drugsApi.ts`
- Dépenses : `src/app/depenses/*`, `src/lib/expensesApi.ts`
- Transactions : `src/app/transactions/*`, `src/lib/transactionsApi.ts`, `src/components/modules/transactions/*`
- Admin : `src/app/admin/*`, `src/app/api/admin/*`
- Patch notes/support : `src/app/login/page.tsx`, `src/app/admin/patch-notes/page.tsx`, `src/lib/communicationApi.ts`

## Flux principal (auth groupe -> supabase -> pages)
1. Login groupe (`src/app/login/page.tsx`) appelle `loginTenant`.
2. Session tenant stockée côté client (`tenantSession`).
3. Pages métiers utilisent `tenantScope` / APIs lib.
4. API routes serveur admin utilisent `src/lib/supabase/admin.ts` (service role key côté serveur uniquement).
5. Les pages affichent les données via les clients `src/lib/*Api.ts`.

## Fichiers racine (rôle + raison)
- `.env.example` : modèle des variables d’environnement.
- `.eslintrc.json` : configuration ESLint.
- `README.md` : documentation principale du repo.
- `middleware.ts` : middleware Next.js (routing/guards globaux).
- `next-env.d.ts` : types Next.js générés/requis.
- `next.config.mjs` : configuration Next.js (doit rester racine).
- `package.json` : scripts + dépendances npm.
- `postcss.config.mjs` : pipeline PostCSS/Tailwind.
- `tailwind.config.ts` : configuration Tailwind.
- `tsconfig.json` : configuration TypeScript.

Tous ces fichiers sont correctement placés et doivent rester à la racine.

## Ajouter une feature proprement
1. Créer la route/page dans `src/app/...`.
2. Ajouter la logique de données dans `src/lib/...Api.ts`.
3. Ajouter composants métier dans `src/components/modules/<feature>`.
4. Garder `components/ui` uniquement pour briques génériques.
5. Vérifier `npm run lint`, `npx tsc --noEmit`, `npm run build`.
