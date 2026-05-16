# Guide du pilote — 30 jours, cycle complet

**Objectif** : valider mygestia en conditions réelles sur un cycle locatif complet avant ouverture commerciale publique.

## Profil pilote recherché

- **1 propriétaire** (idéalement MTG Holding/SCI) avec **3 à 10 lots** actifs
- Mix bail commercial + bail habitation pour couvrir les deux régimes
- Au moins **1 démembrement** déjà en place (test L1-L4)
- Au moins **1 compte bancaire** connecté (Qonto, Powens ou GoCardless)
- Engagement à utiliser mygestia **comme outil principal** sur 30j (pas en parallèle d'un autre)

## Critères de go (à valider sur le pilote)

- [ ] **Aucun bug bloquant** rapporté sur les fonctions critiques
- [ ] **100 % des loyers** émis et envoyés via mygestia (pas de double-saisie ailleurs)
- [ ] **Rapprochement bancaire** automatique > 80 % de taux de match
- [ ] **Génération PDF** OK pour : facture, quittance, relevé de gestion, 2044
- [ ] **0 perte de données** sur les 30 jours
- [ ] **Sentry** : pas d'erreur critique non triagée
- [ ] **Temps de réponse** < 2s sur le dashboard, < 5s sur la génération PDF

## Critères de no-go

- [ ] Bug bloquant non corrigé en < 48h sur un flux critique
- [ ] Perte de données utilisateur
- [ ] Faille sécurité découverte
- [ ] Indisponibilité prod > 1h cumulée sur 30j

## Cycle attendu sur 30 jours

### J0 → J7 — Setup

| Jour | Action | Validation |
|---|---|---|
| J0 | Création société + profil propriétaire + RIB + société.email/SIRET | Profil complet, prêt à émettre facture |
| J1-J3 | Import patrimoine : immeubles, lots, démembrements éventuels | `getLotOwnerships` retourne données cohérentes par lot |
| J3-J5 | Import baux actifs + locataires + dépôts de garantie | `getActiveLeaseWhere(today)` retourne les baux importés |
| J5-J7 | Connexion bancaire (Qonto/Powens) + import 3 derniers mois | `BankTransaction` peuplé, suggestions auto-rapprochement OK |

### J7 → J20 — Cycle locatif courant

| Jour | Action | Validation |
|---|---|---|
| J7 | Génération brouillons facture du mois | `generateInvoiceDrafts` produit 1 brouillon par bail actif |
| J8 | Validation et envoi des factures (email) | `sentAt` rempli, `EmailDeliveryProof.status = DELIVERED` côté Resend |
| J10-J15 | Encaissement des paiements (virements arrivent sur la banque) | Rapprochement auto déclenché, suggestion >80% pour les loyers réguliers |
| J12-J17 | **Cas Meuth** : tester la ventilation 1 virement → N factures sur 1 cas réel | `reconcileTransactionWithAllocations` crée N paiements + maj statut factures |
| J15-J20 | Génération quittances pour les factures soldées | PDF OK, audit log présent |
| J18-J20 | Génération relevé de gestion mensuel | PDF complet : revenus encaissés, charges, solde, démembrement si applicable |

### J20 → J30 — Cas particuliers + sortie

| Jour | Action | Validation |
|---|---|---|
| J20 | Test relance niveau 1 sur factures impayées | `sendReminderEmail` exécuté, audit `RELANCE_N1` créé |
| J22 | Test création avenant bail (loyer ou durée) | `LeaseAmendment` + `Document` liés, PDF généré |
| J24 | Test démembrement : ajouter une part US/NP sur 1 lot existant | `LotOwnership` créé, `LotFiscalSummaryCard` affiche la ventilation correcte |
| J25 | Test rapport "Rentabilité par lot" + "Situation locative" + "Suivi mensuel" | PDFs cohérents, totaux exacts vs banque |
| J27 | Génération 2044 (déclaration revenus fonciers) | `buildLotFiscalSummary` produit les bonnes lignes 211 (recettes) et déductibles |
| J28-J30 | Audit final : Sentry, comptes Stripe (si checkout testé), logs DB | 0 erreur HIGH, données cohérentes |

## KPIs à tracer (à reporter chaque semaine)

| KPI | Cible | Mesure |
|---|---|---|
| Bugs P0 ouverts | 0 | Sentry + reports user |
| Bugs P1 ouverts | < 3 | Sentry + reports user |
| Temps moyen de chargement dashboard | < 2 s | Vercel Analytics |
| Taux rapprochement bancaire auto | > 80 % | `bankReconciliation.create` / `bankTransaction.count` |
| Factures émises via mygestia | 100 % | `invoice.count(invoiceType: APPEL_LOYER, monthly)` |
| Erreurs Sentry HIGH non triagées | 0 | Sentry dashboard |
| Disponibilité prod (uptime) | > 99,5 % | Vercel + monitoring externe |

## Reporting hebdomadaire

Tous les vendredis, exporter :

1. **Liste des bugs** rencontrés (P0/P1/P2) avec statut
2. **Liste des features manquantes** identifiées
3. **Capture des temps de réponse** (dashboard, génération PDF)
4. **Taux de match bancaire** de la semaine
5. **Captures écran** des écrans de référence (factures, relevés, 2044)

## Décision go/no-go — J30

- ✅ **Go** : tous critères de go validés, < 3 P1 ouverts, 0 P0
- 🟡 **Go conditionnel** : 1-2 P1 ouverts mais workaround acceptable + plan de fix < 7j
- ❌ **No-go** : 1 critère no-go déclenché → prolonger pilote +30j après corrections
