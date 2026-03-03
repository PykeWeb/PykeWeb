# Supabase setup

## Exécution rapide
1. Ouvre **Supabase SQL Editor**.
2. Copie/colle puis exécute `supabase/SUPABASE_SQL_FULL_SETUP.sql`.
3. Vérifie que les buckets Storage existent:
   - `object-images`
   - `weapon-images`
   - `equipment-images`
   - `drug-images`
   - `expense-proofs`
   - `global-item-images`

Le script est **idempotent**: il peut être relancé sans casser l’existant.

## Ordre recommandé
Si tu pars de zéro: exécute uniquement `SUPABASE_SQL_FULL_SETUP.sql`.

Les anciens scripts de migration restent utiles historiquement, mais ce fichier est la référence de duplication.
