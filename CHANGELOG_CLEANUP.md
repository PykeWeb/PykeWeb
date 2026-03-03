# Cleanup + Refacto (Items / Finance / UI)

## Audit initial (problèmes trouvés)
- Doublon de logique métier autour du catalogue (`catalogApi` vs `itemsApi`) et modal finance héritée non utilisée (`FinanceTradeModal`).
- Textes UI largement hardcodés, répétitifs et incohérents entre écrans.
- Parsing/calculs numériques éparpillés (risques `NaN` si champs vides).
- Quelques `any` et casts fragiles dans la chaîne Items/Finance.
- Manque de documentation de cleanup et de checklist manuelle.

## Refactor effectué
1. **Types centralisés**
   - Conservation/usage du modèle central `src/lib/types/itemsFinance.ts` (items + transactions finance).

2. **Copy centralisée**
   - Ajout de `src/lib/copy.ts` pour uniformiser labels/actions/messages (Items + Finance).

3. **Helpers robustes de calcul**
   - Ajout de `src/lib/numberUtils.ts` (`toNonNegative`, `toPositiveInt`, `calcTotal`) pour sécuriser quantités/prix/totaux.

4. **Refacto API Items/Finance**
   - `src/lib/itemsApi.ts` typé et durci (slug unique, stock sécurisé, total calculé via helper).
   - `src/lib/financeApi.ts` simplifié et homogénéisé pour le feed finance.

5. **UI Items propre et homogène**
   - `ItemForm` sectionné (Infos/Économie/Stock/Avancé), validations claires, réutilisation de `ImageDropzone`.
   - `ItemsClient` branché sur le catalogue unifié, filtres cohérents, rendu stable.

6. **UI Finance cohérente**
   - `FinanceItemTradeModal` aligné design system + champs complets (interlocuteur, notes, mode de paiement).
   - `FinanceClient` harmonisé sur la copy partagée.

7. **Suppression de doublons/fichiers inutiles**
   - Supprimé `src/components/ui/FinanceTradeModal.tsx` (non utilisé).
   - Supprimé `src/lib/catalogApi.ts` (doublon non utilisé).

8. **Migration cleanup safe**
   - Ajout de `SUPABASE_SQL_MIGRATION_CLEANUP.sql` (safe `IF NOT EXISTS`, indexes, trigger `updated_at`).

## Nouveaux emplacements / fichiers
- `src/lib/copy.ts`
- `src/lib/numberUtils.ts`
- `SUPABASE_SQL_MIGRATION_CLEANUP.sql`

## Fichiers supprimés
- `src/components/ui/FinanceTradeModal.tsx`
- `src/lib/catalogApi.ts`

## Checklist tests manuels effectués
- [x] Navigation vers `/items` et `/finance`.
- [x] Build TypeScript/Next OK.
- [x] UI modale Finance ouverte et rendue.
- [x] Catalogue Items: filtres + tableau + modal création rendus.
- [x] Aucun crash sur champs numériques vides/partiels dans les écrans refactorés.

## Notes
- Le cleanup a priorisé les zones critiques Items/Finance + cohérence design/validation.
- D’autres zones historiques du repo contiennent encore des `any` hors scope immédiat (à traiter dans un lot dédié global).
