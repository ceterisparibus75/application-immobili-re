# PARTIE 1 - Audit fonctionnel de MyGestia

**Date :** 12 avril 2026
**Application :** MyGestia - Plateforme SaaS de gestion immobiliere
**Editeur :** MTG HOLDING (RCS 913 038 717) - 41 Rue de Paris, 97400 Saint-Denis (Reunion)

---

## 1. Synthese generale

MyGestia est une plateforme SaaS de gestion locative immobiliere complete, destinee aux professionnels de l'immobilier (administrateurs de biens, fonciers privees, SCI, cabinets de gestion). L'application couvre l'integralite du cycle de vie de la gestion locative : patrimoine, baux, locataires, facturation, comptabilite, banque, et conformite reglementaire.

**Stack technique :** Next.js 16 (App Router), React 19, TypeScript strict, Prisma 6 / PostgreSQL (Supabase), Tailwind CSS v4, NextAuth v5.

**Hebergement :** Vercel (Frankfurt, UE) avec Supabase pour la base de donnees et le stockage.

---

## 2. Cartographie complete des fonctionnalites

### 2.1 Gestion du patrimoine

| Fonctionnalite | Description | Maturite |
|---|---|---|
| Immeubles | CRUD complet, types (bureau, commerce, mixte, entrepot), acquisitions multi-phases | Mature |
| Lots/Unites | 9 types (commercial, bureau, parking, cave, appartement, terrasse, reserve, activite, entrepot) | Mature |
| Diagnostics | DPE, amiante, plomb, electricite, alertes d'expiration, analyse IA des resultats | Mature |
| Maintenances | Suivi travaux avec couts, historique | Mature |
| Evaluations IA | Estimation valeur venale et loyer marche via Claude + GPT-4o, donnees DVF, SWOT, comparables | Avancee |
| Annonces | Publication sur 7 plateformes (SeLoger, Logic-Immo, BienIci, LeBonCoin, PAP) | Presente |

**143 pages au total dans l'application.**

### 2.2 Gestion des baux

| Fonctionnalite | Description | Maturite |
|---|---|---|
| Types de bail | 17 types : habitation, meuble, commercial, emphyteotique, rural, etc. | Tres complete |
| Indexation | IRL, ILC, ILAT, ICC avec detection auto des revisions et calcul automatique | Avancee |
| Loyer progressif | Paliers de loyer programmes dans le temps | Mature |
| Franchise de loyer | Periodes sans loyer configurables | Mature |
| Droits d'entree | Pas-de-porte pour baux commerciaux | Mature |
| Avenants | Modifications de bail avec historique | Mature |
| Modeles de bail | Templates personnalisables | Mature |
| Inspections | Etats des lieux entree/sortie avec documentation | Mature |
| Gestion tiers | Delegation de gestion avec structure de frais (% ou fixe) | Mature |
| Alertes bail | Echeances 3 ans, 6 ans, 18 mois, 12 mois avant fin | Mature |

### 2.3 Gestion des locataires

| Fonctionnalite | Description | Maturite |
|---|---|---|
| Types d'entite | Personne physique et personne morale (SIRET, SIREN, TVA) | Mature |
| Indicateurs de risque | Vert/Orange/Rouge avec suivi automatise | Mature |
| Suivi assurance | Tracking expiration avec alertes cron hebdomadaires | Mature |
| Garanties | 4 types : depot, caution personnelle, garantie bancaire, GLI | Mature |
| Portail locataire | Acces autonome : factures, documents, tickets support, upload assurance | Avancee |
| Activation portail | Tokens uniques avec login passwordless (code 6 chiffres par email) | Mature |

### 2.4 Facturation et paiements

| Fonctionnalite | Description | Maturite |
|---|---|---|
| Factures | 9 statuts (brouillon, validee, envoyee, payee, partielle, litige, etc.) | Tres complete |
| Types de facture | Appel de loyer, quittance, regularisation charges, avoir, refacturation | Mature |
| Numerotation | Compteur atomique par annee (pas de doublons) | Solide |
| Generation batch | Generation en lot pour tous les baux actifs | Mature |
| Paiements | Enregistrement multiple par facture, MAJ auto du statut | Mature |
| SEPA | Mandats de prelevement via GoCardless, debit automatique | Avancee |
| PDF | Generation via @react-pdf/renderer, upload Supabase Storage | Mature |
| Envoi email | Via Resend avec piece jointe PDF | Mature |
| Avoirs | Notes de credit avec lien a la facture d'origine | Mature |
| Gestion contentieux | Marquage litigieux / irrecouvrables | Mature |

### 2.5 Charges et regularisation

| Fonctionnalite | Description | Maturite |
|---|---|---|
| Natures | 3 types : proprietaire, recuperable, mixte | Mature |
| Repartition | 5 methodes : tantieme, surface, nb lots, compteur, personnalise | Avancee |
| Provisions | Provisions mensuelles pour charges annuelles | Mature |
| Regularisation | Calcul annuel automatique (trop-percu / complement) | Avancee |
| Categories | Bibliotheque de categories personnalisables par societe | Mature |
| Comptes-rendus | Rapports de charges par locataire | Mature |

### 2.6 Comptabilite

| Fonctionnalite | Description | Maturite |
|---|---|---|
| Ecritures | Saisie manuelle et automatique (depuis rapprochement bancaire) | Mature |
| Plan comptable | Importable, 4 types de comptes | Mature |
| Grand livre | Consultation et import | Mature |
| Balance | Balance des comptes | Mature |
| Export FEC | Fichier des Ecritures Comptables (conformite DGFiP) | Critique - OK |
| Cloture | Workflow de cloture d'exercice fiscal | Mature |
| Cash-flow | Analyse des flux de tresorerie avec categorisation IA | Avancee |
| Previsionnel | Budget previsionnel | Mature |

### 2.7 Banque et rapprochement

| Fonctionnalite | Description | Maturite |
|---|---|---|
| Comptes bancaires | CRUD avec IBAN/BIC chiffres AES-256-GCM | Solide |
| Open Banking | GoCardless (PSD2) + Qonto | Avancee |
| Powens | Integration alternative (Budget Insight) | Presente |
| Synchronisation | Cron quotidien 6h + sync manuelle | Mature |
| Rapprochement auto | Match montant exact + date entre transactions et factures | Avancee |
| Rapprochement manuel | Selection utilisateur, paiements partiels, split | Mature |
| Ecritures GL | Generation automatique depuis rapprochement | Mature |

### 2.8 Emprunts

| Fonctionnalite | Description | Maturite |
|---|---|---|
| Types | 5 types : amortissable, in fine, bullet, obligation, compte courant | Complete |
| Mouvements | Apports, retraits, interets | Mature |
| Amortissement | Tableaux d'amortissement | Mature |
| Parse PDF | Extraction IA des documents de pret | Avancee |

### 2.9 Communication et documents

| Fonctionnalite | Description | Maturite |
|---|---|---|
| Courriers | Templates pre-construits : relances, conges, mise en demeure | Mature |
| Relances | 4 niveaux : amiable 1, amiable 2, mise en demeure, contentieux | Mature |
| Emails | 20+ templates HTML responsive via Resend | Avancee |
| Documents | Upload, stockage Supabase, analyse IA (Claude Sonnet 4) | Avancee |
| Chat document | Conversation IA avec le contenu d'un document | Avancee |
| Dataroom | Partage securise avec tokens a duree limitee | Mature |
| Signature electronique | Integration DocuSign (enveloppes, signing embarque, webhooks) | Avancee |

### 2.10 Rapports et analytics

| Fonctionnalite | Description | Maturite |
|---|---|---|
| Dashboard | KPIs, graphiques Recharts (revenus, occupation, impayes, risque) | Mature |
| 9 types de rapports | Balance agee, CRG, impayes, rentabilite, charges, situation, mensuel, travaux, vacance | Avancee |
| Rapports consolides | Multi-societes | Avancee |
| Planification | Envoi automatique programme par cron | Mature |
| Export PDF | Dashboard et rapports individuels | Mature |
| Analyse IA | Narration automatique des tendances et anomalies | Avancee |

### 2.11 Administration et securite

| Fonctionnalite | Description | Maturite |
|---|---|---|
| RBAC | 5 niveaux : Super Admin, Admin Societe, Gestionnaire, Comptable, Lecture | Solide |
| Permissions modules | Surcharges granulaires par module (read/write/delete) | Avancee |
| 2FA TOTP | QR code, 6 chiffres, 30s, codes de recuperation chiffres | Solide |
| Verrouillage compte | 5 tentatives = verrou 15 min | Solide |
| Timeout inactivite | Deconnexion auto 10 min, avertissement 1 min avant | Mature |
| Audit log | Toutes les mutations loguees (CRUD, login, export, email, PDF) | Mature |
| RGPD | Export donnees, consentements, droit a l'oubli, durees de conservation | Avancee |
| Multi-tenant | Isolation complete par societyId, auto-scoping Prisma | Solide |
| Multi-proprietaire | Plusieurs entites proprietaires (SCI, SARL, physique) | Avancee |
| Import donnees | CSV/Excel avec analyse IA | Mature |
| Fusion entites | Consolidation locataires, baux, immeubles | Avancee |

### 2.12 Abonnements et monetisation

| Fonctionnalite | Description | Maturite |
|---|---|---|
| Plans | Starter (19EUR/mois), Pro (79EUR/mois), Enterprise (199EUR/mois) | Defini |
| Essai gratuit | 14 jours sans carte bancaire | Mature |
| Stripe | Checkout, portail client, webhooks | Mature |
| Limites | Lots, societes, utilisateurs par plan | Enforced |
| Feature gating | Signature, IA import, API = Enterprise only | Mature |

---

## 3. Points forts identifies

1. **Couverture fonctionnelle exceptionnelle** : 143 pages, 30+ modules metier, couvre tout le cycle de vie de la gestion locative
2. **IA integree** : Analyse documentaire, evaluation patrimoniale, categorisation cash-flow, narration de rapports
3. **Conformite reglementaire** : FEC, RGPD, indices INSEE, ALUR, durees de conservation
4. **Multi-tenant natif** : Architecture solide avec isolation des donnees par societe
5. **Automatisation poussee** : 8 crons jobs couvrant facturation, relances, banque, indices, rapports
6. **Securite robuste** : AES-256-GCM, 2FA TOTP, RBAC 5 niveaux, audit log, CSP, HSTS
7. **Portail locataire** : Acces autonome avec auth independante, tickets support
8. **Open Banking** : 3 integrations (GoCardless, Qonto, Powens)
9. **Signature electronique** : DocuSign avec workflow complet
10. **Centre d'aide integre** : 11 pages d'aide contextuelle

## 4. Points faibles et risques

1. **Landing page monolithique** : 12 834 lignes dans un seul fichier page.tsx
2. **Complexite d'onboarding** : La richesse fonctionnelle peut submerger un nouvel utilisateur
3. **Dependance Vercel** : Deploiement couple a Vercel (crons, edge functions)
4. **Absence d'application mobile native** : Uniquement responsive web
5. **Documentation utilisateur** : Centre d'aide integre mais pas de base de connaissances externe
6. **Tests** : Couverture limitee aux fichiers lib/, actions/, validations/ - pas de tests E2E
7. **Internationalisation** : Francais uniquement, pas de structure i18n
8. **Accessibilite** : ARIA basique, pas d'audit WCAG complet
