# Audit fonctionnel de MyGestia

> **Date :** 12 avril 2026
> **Application :** MyGestia - Plateforme SaaS de gestion immobilière
> **Éditeur :** MTG HOLDING (RCS 913 038 717) - 41 Rue de Paris, 97400 Saint-Denis (Réunion)

---

## Synthèse générale

MyGestia est une plateforme SaaS complète de gestion locative immobilière. Elle s'adresse aux professionnels de l'immobilier : administrateurs de biens, foncières privées, SCI, cabinets de gestion indépendants.

L'application couvre **l'intégralité du cycle de vie** de la gestion locative : patrimoine, baux, locataires, facturation, comptabilité, banque et conformité réglementaire.

- **143 pages** dans l'application
- **30+ modules métier**
- **8 tâches automatisées** (cron jobs)

**Stack technique :** Next.js 16, React 19, TypeScript strict, Prisma 6 / PostgreSQL (Supabase), Tailwind CSS v4, NextAuth v5.

**Hébergement :** Vercel (Frankfurt, UE) avec Supabase pour la base de données et le stockage fichiers.

---

## Cartographie des fonctionnalités

### 1. Gestion du patrimoine

| Fonctionnalité | Description | Maturité |
|:--|:--|:--|
| Immeubles | Création complète, types (bureau, commerce, mixte, entrepôt), acquisitions multi-phases | Mature |
| Lots / Unités | 9 types : commercial, bureau, parking, cave, appartement, terrasse, réserve, activité, entrepôt | Mature |
| Diagnostics | DPE, amiante, plomb, électricité, alertes d'expiration, analyse IA des résultats | Mature |
| Maintenances | Suivi des travaux avec coûts et historique | Mature |
| Évaluations IA | Estimation valeur vénale et loyer marché via Claude + GPT-4o, données DVF, analyse SWOT, comparables | Avancée |
| Annonces | Publication sur 7 plateformes (SeLoger, Logic-Immo, BienIci, LeBonCoin, PAP) | Présente |

---

### 2. Gestion des baux

| Fonctionnalité | Description | Maturité |
|:--|:--|:--|
| Types de bail | **17 types** : habitation, meublé, commercial, emphytéotique, rural, professionnel, etc. | Très complète |
| Indexation | IRL, ILC, ILAT, ICC avec détection automatique des révisions et calcul automatique | Avancée |
| Loyer progressif | Paliers de loyer programmés dans le temps | Mature |
| Franchise de loyer | Périodes sans loyer configurables | Mature |
| Droits d'entrée | Pas-de-porte pour baux commerciaux | Mature |
| Avenants | Modifications de bail avec historique complet | Mature |
| Modèles de bail | Templates personnalisables par société | Mature |
| Inspections | États des lieux entrée/sortie avec documentation | Mature |
| Gestion tiers | Délégation de gestion avec structure de frais (% ou fixe) | Mature |
| Alertes bail | Échéances automatiques : 3 ans, 6 ans, 18 mois, 12 mois avant fin | Mature |

---

### 3. Gestion des locataires

| Fonctionnalité | Description | Maturité |
|:--|:--|:--|
| Types d'entité | Personne physique et personne morale (SIRET, SIREN, TVA) | Mature |
| Indicateurs de risque | Vert / Orange / Rouge avec suivi automatisé | Mature |
| Suivi assurance | Tracking expiration avec alertes hebdomadaires automatiques | Mature |
| Garanties | 4 types : dépôt de garantie, caution personnelle, garantie bancaire, GLI | Mature |
| Portail locataire | Accès autonome : factures, documents, tickets support, upload assurance | Avancée |
| Activation portail | Tokens uniques, login sans mot de passe (code 6 chiffres par email) | Mature |

---

### 4. Facturation et paiements

| Fonctionnalité | Description | Maturité |
|:--|:--|:--|
| Factures | **9 statuts** : brouillon, validée, envoyée, payée, partiellement payée, en litige, etc. | Très complète |
| Types de facture | Appel de loyer, quittance, régularisation charges, avoir, refacturation | Mature |
| Numérotation | Compteur atomique par année (zéro doublon possible) | Solide |
| Génération batch | Génération en lot pour tous les baux actifs d'un clic | Mature |
| Paiements | Enregistrement multiple par facture, mise à jour automatique du statut | Mature |
| SEPA | Mandats de prélèvement via GoCardless, débit automatique | Avancée |
| PDF | Génération via @react-pdf/renderer, upload automatique dans Supabase Storage | Mature |
| Envoi email | Via Resend avec pièce jointe PDF intégrée | Mature |
| Avoirs | Notes de crédit avec lien à la facture d'origine | Mature |
| Contentieux | Marquage litigieux / irrécouvrables | Mature |

---

### 5. Charges et régularisation

| Fonctionnalité | Description | Maturité |
|:--|:--|:--|
| Natures | 3 types : propriétaire, récupérable, mixte | Mature |
| Répartition | 5 méthodes : tantième, surface, nombre de lots, compteur, personnalisé | Avancée |
| Provisions | Provisions mensuelles pour charges annuelles | Mature |
| Régularisation | Calcul annuel automatique (trop-perçu / complément) | Avancée |
| Catégories | Bibliothèque personnalisable par société | Mature |
| Comptes-rendus | Rapports de charges par locataire | Mature |

---

### 6. Comptabilité

| Fonctionnalité | Description | Maturité |
|:--|:--|:--|
| Écritures | Saisie manuelle et automatique (depuis rapprochement bancaire) | Mature |
| Plan comptable | Importable, 4 types de comptes | Mature |
| Grand livre | Consultation et import | Mature |
| Balance | Balance des comptes | Mature |
| **Export FEC** | Fichier des Écritures Comptables (conformité DGFiP) | **Critique - OK** |
| Clôture | Workflow de clôture d'exercice fiscal | Mature |
| Cash-flow | Analyse des flux de trésorerie avec catégorisation IA | Avancée |
| Prévisionnel | Budget prévisionnel | Mature |

---

### 7. Banque et rapprochement

| Fonctionnalité | Description | Maturité |
|:--|:--|:--|
| Comptes bancaires | IBAN/BIC chiffrés en AES-256-GCM | Solide |
| Open Banking | GoCardless (PSD2) + Qonto | Avancée |
| Powens | Intégration alternative (Budget Insight) | Présente |
| Synchronisation | Cron quotidien à 6h + synchronisation manuelle | Mature |
| Rapprochement auto | Match montant exact + date entre transactions et factures | Avancée |
| Rapprochement manuel | Sélection utilisateur, paiements partiels, split | Mature |
| Écritures GL | Génération automatique depuis le rapprochement | Mature |

---

### 8. Emprunts

| Fonctionnalité | Description | Maturité |
|:--|:--|:--|
| Types | 5 types : amortissable, in fine, bullet, obligation, compte courant | Complète |
| Mouvements | Apports, retraits, intérêts | Mature |
| Amortissement | Tableaux d'amortissement complets | Mature |
| Parse PDF | Extraction IA des documents de prêt | Avancée |

---

### 9. Communication et documents

| Fonctionnalité | Description | Maturité |
|:--|:--|:--|
| Courriers | Templates pré-construits : relances, congés, mise en demeure | Mature |
| Relances | 4 niveaux : amiable 1, amiable 2, mise en demeure, contentieux | Mature |
| Emails | 20+ templates HTML responsive via Resend | Avancée |
| Documents | Upload, stockage Supabase, analyse IA (Claude Sonnet 4) | Avancée |
| Chat document | Conversation IA avec le contenu d'un document uploadé | Avancée |
| Dataroom | Partage sécurisé avec tokens à durée limitée | Mature |
| Signature électronique | Intégration DocuSign (enveloppes, signing embarqué, webhooks) | Avancée |

---

### 10. Rapports et analytics

| Fonctionnalité | Description | Maturité |
|:--|:--|:--|
| Dashboard | KPIs en temps réel, graphiques Recharts (revenus, occupation, impayés, risque) | Mature |
| 9 types de rapports | Balance âgée, CRG, impayés, rentabilité, charges, situation, mensuel, travaux, vacance | Avancée |
| Rapports consolidés | Multi-sociétés | Avancée |
| Planification | Envoi automatique programmé par cron | Mature |
| Export PDF | Dashboard et rapports individuels | Mature |
| Analyse IA | Narration automatique des tendances et anomalies | Avancée |

---

### 11. Administration et sécurité

| Fonctionnalité | Description | Maturité |
|:--|:--|:--|
| RBAC | 5 niveaux : Super Admin, Admin Société, Gestionnaire, Comptable, Lecture | Solide |
| Permissions modules | Surcharges granulaires par module (lecture/écriture/suppression) | Avancée |
| 2FA TOTP | QR code, 6 chiffres, 30 secondes, codes de récupération chiffrés | Solide |
| Verrouillage compte | 5 tentatives = verrouillage 15 minutes | Solide |
| Timeout inactivité | Déconnexion automatique après 10 min, avertissement 1 min avant | Mature |
| Audit log | Toutes les mutations loguées (CRUD, login, export, email, PDF) | Mature |
| RGPD | Export données, consentements, droit à l'oubli, durées de conservation | Avancée |
| Multi-tenant | Isolation complète par societyId, auto-scoping Prisma | Solide |
| Multi-propriétaire | Plusieurs entités propriétaires (SCI, SARL, personne physique) | Avancée |
| Import données | CSV/Excel avec analyse IA | Mature |
| Fusion entités | Consolidation locataires, baux, immeubles | Avancée |

---

### 12. Abonnements et monétisation

| Fonctionnalité | Description | Maturité |
|:--|:--|:--|
| Plans | Starter (19 EUR/mois), Pro (79 EUR/mois), Enterprise (199 EUR/mois) | Défini |
| Essai gratuit | 14 jours sans carte bancaire | Mature |
| Stripe | Checkout, portail client, webhooks | Mature |
| Limites | Lots, sociétés, utilisateurs par plan | Appliquées |
| Feature gating | Signature, IA import, API = Enterprise uniquement | Mature |

---

## Points forts

1. **Couverture fonctionnelle exceptionnelle** : 143 pages, 30+ modules, couvre tout le cycle de vie
2. **IA intégrée à tous les niveaux** : analyse documentaire, évaluation patrimoniale, catégorisation cash-flow, narration de rapports
3. **Conformité réglementaire totale** : FEC, RGPD, indices INSEE, ALUR, durées de conservation
4. **Architecture multi-tenant native** : isolation des données par société, auto-scoping Prisma
5. **Automatisation poussée** : 8 cron jobs couvrant facturation, relances, banque, indices, rapports
6. **Sécurité robuste** : AES-256-GCM, 2FA TOTP, RBAC 5 niveaux, audit log, CSP, HSTS
7. **Portail locataire autonome** : authentification indépendante, tickets support, documents
8. **Open Banking triple** : GoCardless + Qonto + Powens
9. **Signature électronique** : DocuSign avec workflow complet et webhooks
10. **Centre d'aide intégré** : 11 pages d'aide contextuelle par module

---

## Points faibles et risques identifiés

1. **Landing page monolithique** : 12 834 lignes dans un seul fichier (impact performance et maintenabilité)
2. **Complexité d'onboarding** : la richesse fonctionnelle peut submerger un nouvel utilisateur
3. **Dépendance Vercel** : déploiement couplé à Vercel (crons, edge functions)
4. **Pas d'application mobile native** : uniquement responsive web
5. **Documentation utilisateur limitée** : centre d'aide intégré mais pas de base de connaissances externe
6. **Couverture de tests partielle** : limitée aux fichiers lib/, actions/, validations/ - pas de tests E2E
7. **Français uniquement** : pas de structure d'internationalisation (i18n)
8. **Accessibilité basique** : ARIA présent mais pas d'audit WCAG complet
