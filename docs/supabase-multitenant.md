# Supabase multi-tenant setup (required)

Ce projet attend désormais une structure multi-groupes côté Supabase.

## 1) SQL à exécuter

Exécute le script suivant dans **Supabase SQL Editor**:

- `supabase/migrations/20260302_multitenant_bootstrap.sql`

## 2) Ce que le script ajoute

- Crée `public.tenant_groups`.
- Ajoute `group_id` sur les tables métier utilisées par l'app.
- Backfill des données existantes vers un groupe par défaut (`login = main`).
- Ajoute FK + index + contraintes `NOT NULL` sur `group_id`.

## 3) Après exécution

- Connecte-toi en superadmin depuis `/login`:
  - login: `admin`
  - mdp: `santa1234`
- Va sur **Admin groupes** pour créer les groupes clients (login/mdp distincts).
- Le groupe "main" est un fallback technique; change son mot de passe rapidement.

## 4) Important pour la suite

Pour chaque future fonctionnalité, si une nouvelle table est créée côté app et doit être multi-groupe,
**il faudra aussi ajouter `group_id uuid not null references tenant_groups(id)` + index**.
