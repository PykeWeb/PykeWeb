# Pyke Stock — Setup

## Prérequis
- Node.js 18+
- npm
- Un projet Supabase

## Installation
```bash
npm install
```

## Setup Supabase
1. Crée un projet Supabase.
2. Dans **SQL Editor**, exécute:
   - `supabase/SUPABASE_SQL_FULL_SETUP.sql`
3. Vérifie que les buckets Storage existent (créés par le script).

## Variables d’environnement
Copie `.env.example` vers `.env.local` et renseigne:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Lancer en local
```bash
npm run dev
```

## Vérifications qualité
```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Déploiement Vercel
1. Importer le repo dans Vercel.
2. Définir les variables d’environnement (mêmes clés que `.env.local`).
3. Déployer.

## Dupliquer le projet (checklist)
- [ ] Nouveau projet Supabase créé
- [ ] SQL full setup exécuté
- [ ] Variables `.env.local`/Vercel renseignées
- [ ] `npm install` + `npm run build` OK

## Troubleshooting
- **Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY**: vérifier `.env.local`.
- **Erreur accès API admin**: vérifier `SUPABASE_SERVICE_ROLE_KEY`.
- **Images upload KO**: vérifier buckets/policies Storage.
