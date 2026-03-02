# Supabase multi-tenant setup (required)

Ce projet attend désormais une structure multi-groupes côté Supabase.

## 1) SQL à exécuter

Exécute le script suivant dans **Supabase SQL Editor**:

- `supabase/migrations/20260302_multitenant_bootstrap.sql`

## 2) Ce que le script ajoute

- Crée `public.tenant_groups`.
- Ajoute `group_id` sur les tables métier utilisées par l'app.
- Backfill des données existantes vers un groupe par défaut (`login = main`), nommé **Groupe Test**.
- Ajoute FK + index + contraintes `NOT NULL` sur `group_id`.
- Ignore automatiquement les tables optionnelles absentes (ex: `weapon_stock_movements`) pour éviter les erreurs SQL 42P01.
- Désactive RLS sur `tenant_groups` pour permettre la gestion des groupes depuis l'interface admin du site (clé anon côté client).
- Crée `patch_notes` (notes de mise à jour administrables).
- Crée `support_tickets` (bugs/messages avec statut).

## 3) Si la migration a déjà été lancée avant cette correction

Lance aussi ce SQL une fois dans Supabase SQL Editor :

```sql
alter table if exists public.tenant_groups disable row level security;
```

Sinon l'admin peut voir l'erreur :
`new row violates row-level security policy for table "tenant_groups"`.

## 4) Après exécution

- Connecte-toi en superadmin depuis `/login`:
  - login: `admin`
  - mdp: `santa1234`
- Va sur **Admin groupes** pour créer les groupes clients (login/mdp distincts).
- Le groupe `main` sert de **groupe de test** pour faire essayer le site; change son mot de passe rapidement.

## 5) Important pour la suite

Pour chaque future fonctionnalité, si une nouvelle table est créée côté app et doit être multi-groupe,
**il faudra aussi ajouter `group_id uuid not null references tenant_groups(id)` + index**.

## 6) Stockage en ligne (pas local)

- Les données métier (groupes, objets, armes, drogues, équipements, transactions, dépenses) sont stockées en ligne dans Supabase.
- Le navigateur stocke seulement la session de connexion (cookie/localStorage) pour garder l'utilisateur connecté.
