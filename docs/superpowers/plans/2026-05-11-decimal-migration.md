# Migration `Float` → `Decimal` pour les champs monétaires

**Date** : 2026-05-11
**Estimation** : 3–5 jours (1 dev senior)
**Niveau de risque** : élevé — touche tous les calculs de loyers, factures, charges, FEC, lettrage, immobilier.
**Préalable bloquant** : aucun blocage en lecture (`Decimal` reste numérique côté JS), mais à faire **avant** d'envoyer le module B2B / Chorus Pro en production réelle, car le FEC DGFiP exige la précision au centime.

## Pourquoi

`schema.prisma` contient **178 occurrences de `Float`** pour des montants en euros, sans aucun `Decimal`. Cela viole une bonne pratique financière de base :

- `0.1 + 0.2 = 0.30000000000000004` côté JS — visible dans des totaux de factures, calculs de cumul, lettrage.
- Les exports FEC DGFiP (`Article A.47 A-1`) imposent l'équilibre débit/crédit au centime. Une erreur d'arrondi flottant peut faire planter un export.
- Les arrondis de TVA à 2 décimales sur des bases flottantes produisent des écarts.
- Le `CLAUDE.md` formalise même la règle « montants en euros (Float) », ce qui ancre la dette. À corriger.

## Stratégie d'ensemble

**Migration incrémentale par modèle, jamais en big bang.** Chaque étape doit pouvoir être livrée seule, avec ses propres tests et sa propre migration Prisma.

Approche en 5 lots, ordonnés par densité décroissante du domaine financier :

| Lot | Modèles | Risque | Effort | Tests à muscler |
|-----|---------|--------|--------|-----------------|
| 1 | `Invoice`, `InvoiceLine`, `Payment` | très élevé | 1 j | invoice-generation, invoice-lifecycle, payment |
| 2 | `JournalEntry`, `JournalLine`, `AccountingAccount`, `FixedAsset` | élevé | 0.5 j | accounting, lettering, fec-export |
| 3 | `Lease`, `RentStep`, `RentRevision`, `Charge`, `ChargeProvision`, `ChargeRegularization` | élevé | 1 j | lease, rent-revision, charge, charge-statement |
| 4 | `Loan`, `LoanAmortizationLine`, `BankTransaction`, `TenantBalanceAdjustment`, `SupplierInvoice` | moyen | 0.5 j | loan, bank-reconciliation, supplier-invoice |
| 5 | `Valuation`, `RentValuation`, `Lot.marketRentValue`, indicateurs (analytics, cashflow) | faible | 1 j | valuation, analytics, cashflow, reports/* |

À chaque lot : commit + push + observer la CI + déployer en preview Vercel + smoke-tester sur staging.

## Prérequis techniques

1. **Étendre la précision Prisma** : `Decimal @db.Decimal(14, 2)` est le défaut visé pour un montant en euros (max ≈ 9.99×10¹¹). Pour les indices et taux (TVA, intérêt) : `Decimal @db.Decimal(8, 6)`.
2. **Côté JS** : Prisma 7.6 retourne `Decimal` comme une instance de `decimal.js`. Bibliothèque importable :
   ```ts
   import { Prisma } from "@prisma/client"; // Decimal exposé via Prisma.Decimal
   ```
3. **Helpers** : créer `src/lib/money.ts` avec :
   - `toMoney(v: number | string | Decimal): Decimal`
   - `addMoney`, `subMoney`, `mulMoney`, `divMoney`, `sumMoney(values[])`
   - `formatCurrencyDecimal(d: Decimal)` qui remplace `formatCurrency(number)`
   - `roundHalfEvenToCents(d: Decimal): Decimal` (banker's rounding, recommandé pour les exports DGFiP)
4. **Migration Prisma** : `prisma migrate dev` génère le `ALTER COLUMN type DECIMAL(14,2) USING amount::numeric(14,2)`. PostgreSQL accepte la conversion sans perte si les valeurs Float existantes tiennent dans la précision (vérifier sur staging avec une `SELECT max(amount), min(amount) FROM ...`).

## Plan pas-à-pas du lot 1 (modèle de référence)

1. **Mesurer l'impact** sur `Invoice`, `InvoiceLine`, `Payment` :
   ```bash
   grep -rn "amount\b\|total\|montant" src/actions/invoice-*.ts src/lib/invoice-pdf.tsx | wc -l
   ```
2. **Mettre à jour le schéma Prisma** :
   ```prisma
   model Invoice {
     // …
     amountHT          Decimal @db.Decimal(14, 2)
     amountVAT         Decimal @db.Decimal(14, 2)
     amountTTC         Decimal @db.Decimal(14, 2)
     amountPaid        Decimal @db.Decimal(14, 2) @default(0)
   }
   model InvoiceLine {
     quantity          Decimal @db.Decimal(10, 3)
     unitPrice         Decimal @db.Decimal(14, 4)  // précision plus fine pour les tarifs
     vatRate           Decimal @db.Decimal(5, 2)
     totalHT           Decimal @db.Decimal(14, 2)
     totalVAT          Decimal @db.Decimal(14, 2)
     totalTTC          Decimal @db.Decimal(14, 2)
   }
   model Payment {
     amount            Decimal @db.Decimal(14, 2)
   }
   ```
3. **Générer la migration** :
   ```bash
   npm run db:migrate -- --name decimal-invoice-payment
   ```
4. **Adapter les `actions/invoice-*.ts`** :
   - Les `Float * Float` deviennent `Decimal.mul(Decimal)`. Aucun opérateur arithmétique natif JS.
   - `formatCurrency(amount)` doit accepter `Decimal | number`.
   - `getNextInvoiceNumber` n'est pas concerné.
   - `computeLines` dans `invoice-shared.ts` : remplacer la multiplication brute par `addMoney` et `mulMoney`.
5. **Adapter les sérialisations** : Server Components renvoient `Decimal`, Client Components ne le déserialisent pas nativement. Convertir en string ou number côté frontière :
   ```ts
   amountTTC: invoice.amountTTC.toNumber(), // OK si la valeur tient en double safe range
   // ou amountTTC: invoice.amountTTC.toFixed(2),
   ```
   Préférer `.toFixed(2)` pour l'affichage et `.toNumber()` uniquement pour les graphiques.
6. **Mettre à jour `invoice-pdf.tsx`** : `@react-pdf/renderer` ne sait pas dessiner un Decimal — passer `.toNumber()` ou `.toFixed(2)`.
7. **Tests** : tous les tests Vitest qui font `expect(invoice.amountTTC).toBe(1234.56)` doivent migrer vers :
   ```ts
   expect(invoice.amountTTC.equals(new Prisma.Decimal("1234.56"))).toBe(true);
   // ou
   expect(invoice.amountTTC.toString()).toBe("1234.56");
   ```
8. **Smoke test** en staging : créer 1 bail + 1 facture + 1 paiement + vérifier le PDF + l'export FEC + la balance équilibrée.

## Pièges connus

- **JSON.stringify** : `Decimal` est sérialisé en string par défaut (`"1234.56"`). Les API qui consomment du JSON retourné par Server Actions vont recevoir des strings — adapter les types côté client.
- **Recharts** : attend des numbers. Mapper avec `.toNumber()` au moment de construire les datasets.
- **Comparaisons** : `decimal1 === decimal2` ne fonctionne pas (deux instances différentes). Utiliser `.equals()`. Idem pour `>`, `<` : `.gt()`, `.lt()`.
- **`Math.round`, `Math.floor`** ne fonctionnent pas sur Decimal. Utiliser `.round()`, `.floor()` de `decimal.js`.
- **Sum sur findMany** : `array.reduce((acc, x) => acc + x.amount, 0)` devient `array.reduce((acc, x) => acc.add(x.amount), new Prisma.Decimal(0))`.
- **Zod** : les schémas qui valident `z.number()` doivent passer à `z.union([z.number(), z.string()]).transform(v => new Prisma.Decimal(v))` côté API. Pour les formulaires côté client, garder `z.number()` et convertir au moment du Server Action call.

## Rollback

Chaque lot est livré derrière une migration Prisma réversible. En cas de panique :
1. `git revert <commit>` du code applicatif
2. Créer une migration `down` Prisma qui rebascule en `DOUBLE PRECISION` (Float). PostgreSQL accepte `DECIMAL(14,2) → DOUBLE PRECISION` sans perte.

## Checklist de fin de lot

- [ ] Migration Prisma appliquée en staging
- [ ] `npm test` 100 % passant
- [ ] `npx tsc --noEmit` 0 erreur
- [ ] Export FEC validé sur 1 société avec ≥10 écritures
- [ ] Génération PDF facture validée (totaux identiques au centime près)
- [ ] Audit log non-régressé

## Hors périmètre de cette migration

- Conversion des `BankTransaction.amount` qui viennent de l'OpenBanking (GoCardless, Powens, Qonto) — les API retournent du `number`, on convertit à la frontière mais on stocke en `Decimal`.
- L'affichage côté client reste en `number` quand c'est purement décoratif (graphes, cartes de KPI).
- L'API OpenAPI (si exposée) doit déclarer ces champs en `string` (format: "decimal") au lieu de `number`.

## Indicateur de progression

`grep -c "Float" prisma/schema.prisma` doit décroître de 178 → ~30 (uniquement les vraies grandeurs flottantes : ratios, coefficients statistiques, surfaces).
