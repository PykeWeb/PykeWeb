# Pyke Stock

## Présentation
Pyke Stock est une plateforme de gestion de stock RP multi-groupes.
Application web Next.js avec backend Supabase, pensée pour un usage opérationnel (catalogues, mouvements, administration et suivi).

## Fonctionnalités
- Objets
- Armes
- Équipement
- Drogues (catalogue, plantations, recettes, production, calculateur)
- Transactions
- Admin groupes
- Patch notes
- Support

## Stack
- Next.js (App Router)
- Supabase
- Vercel

## Installation locale
1. `git clone <repo>`
2. `npm install`
3. Copier `.env.example` vers `.env.local`
4. Exécuter `supabase/SUPABASE_SQL_FULL_SETUP.sql` dans Supabase SQL Editor
5. `npm run dev`

## Base de données
- Script principal : `supabase/SUPABASE_SQL_FULL_SETUP.sql`
- Script idempotent (relançable)
- Contient : tables, index, triggers, fonctions et configuration associée

## Variables d’environnement
Variables réellement utilisées :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement)
- `NEXT_PUBLIC_GROUP_NAME`
- `NEXT_PUBLIC_GROUP_BADGE`

## Déploiement
Guide détaillé : `docs/DEPLOY_VERCEL.md`

## Duplication du projet (checklist)
- [ ] Créer un nouveau projet Supabase
- [ ] Exécuter `supabase/SUPABASE_SQL_FULL_SETUP.sql`
- [ ] Configurer les variables d’environnement dans Vercel
- [ ] Déployer

## Référence architecture
- `docs/ARCHITECTURE.md`
- `docs/CLEANUP_REPORT.md`
- `docs/DISCORD_BOT.md` (onboarding Discord ↔ membres tablette)
