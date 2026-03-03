# Déploiement Vercel

## 1) Importer le projet
1. Aller sur Vercel.
2. Importer le dépôt GitHub.
3. Framework détecté : **Next.js**.

## 2) Build settings
- Build command: `npm run build`
- Install command: `npm install`
- Output: standard Next.js (auto)

## 3) Variables d’environnement
## Obligatoires
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Sensible (server-only)
- `SUPABASE_SERVICE_ROLE_KEY`
  - À utiliser **uniquement côté serveur**.
  - Ne jamais la préfixer en `NEXT_PUBLIC_`.
  - Vérifié dans ce repo: utilisée côté serveur via `src/lib/supabase/admin.ts`.

## Variables marque/groupe
- `NEXT_PUBLIC_GROUP_NAME` : utilisée pour le branding (`src/lib/constants/brand.ts`).
- `NEXT_PUBLIC_GROUP_BADGE` : utilisée pour le branding (`src/lib/constants/brand.ts`).

Si vous ne souhaitez pas de branding dynamique, ces variables peuvent être traitées comme optionnelles (fallbacks déjà présents dans le code).

## 4) Sécurité Supabase
- **Anon key**: pour le client public (front), avec RLS/policies adaptées.
- **Service role key**: accès administrateur complet, exclusivement côté serveur.
- Bonnes pratiques:
  - Ne jamais exposer service role key au navigateur.
  - Limiter les opérations sensibles aux API routes serveur.
  - Vérifier les policies RLS / storage policies selon votre modèle.

## 5) Smoke test post-déploiement
- Ouvrir `/login`
- Tester un flux de connexion
- Vérifier lecture patch notes
- Vérifier une route admin (avec session admin)

## 6) Référence DB
Exécuter au préalable `supabase/SUPABASE_SQL_FULL_SETUP.sql` dans votre projet Supabase cible.
