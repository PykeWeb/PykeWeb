# Pyke Stock — Setup local

## Prérequis
- Node.js 18+
- npm
- Un projet Supabase

## Installation
```bash
npm install
```

## Setup Supabase
1. Créer un projet Supabase.
2. Ouvrir SQL Editor.
3. Exécuter `supabase/SUPABASE_SQL_FULL_SETUP.sql`.
4. Vérifier les buckets storage créés.

## Variables d’environnement
Copier `.env.example` vers `.env.local` puis renseigner:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_GROUP_NAME` (optionnel branding)
- `NEXT_PUBLIC_GROUP_BADGE` (optionnel branding)

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

## Déploiement
Voir `docs/DEPLOY_VERCEL.md`.

## Troubleshooting rapide
- Missing Supabase URL/Anon key: vérifier `.env.local`.
- Erreur admin API: vérifier `SUPABASE_SERVICE_ROLE_KEY`.
- Upload images KO: vérifier buckets/policies dans Supabase.
