# MyGestia — Application SaaS de gestion locative

Application multi-tenant de gestion locative immobilière (baux, factures, locataires, comptabilité, open banking, signatures électroniques).

## Stack technique

- **Next.js 16** — App Router, Server Components, Server Actions, Turbopack
- **React 19** + TypeScript strict
- **Prisma 6** + PostgreSQL (Supabase)
- **NextAuth v5** — JWT 24h, 2FA TOTP
- **Tailwind CSS v4** + shadcn/ui
- **Resend** (emails), **Supabase Storage** (fichiers), **Upstash Redis** (cache)
- **Stripe** (abonnements), **DocuSign** (signatures), **GoCardless/Powens/Qonto** (open banking)
- **Vitest** (tests unitaires), **Playwright** (E2E)

---

## Démarrage développeur

> ⚠️ Ne jamais travailler dans un dossier Google Drive File Stream (ex. `G:\Mon Drive\…`). Next.js + Turbopack crée des junction points Windows qui échouent sur Drive. Cloner sur disque local (ex. `C:\dev\mygestia`).

```bash
# 1. Variables d'environnement
cp .env.example .env.local
# Remplir les valeurs obligatoires (voir tableau ci-dessous)

# 2. Installation
npm install          # installe les dépendances (legacy-peer-deps configuré dans .npmrc)

# 3. Base de données
npm run db:generate  # générer le client Prisma
npm run db:push      # synchroniser le schéma (dev uniquement)
npm run db:seed      # données de test

# 4. Serveur de développement
npm run dev
```

L'application tourne sur [http://localhost:3000](http://localhost:3000).

---

## Commandes

```bash
# Développement
npm run dev              # Serveur dev (Turbopack)
npm run build            # Build production
npm run start            # Serveur production
npm run lint             # ESLint
npx tsc --noEmit         # Vérification TypeScript

# Tests unitaires (Vitest)
npm test                                          # Tous les tests
npm test -- src/actions/invoice.test.ts          # Un seul fichier
npm run test:watch                               # Mode watch
npm run test:coverage                            # Avec couverture (seuils : 75%)

# Tests E2E (Playwright)
npm run test:e2e          # Build + start + tests automatiques
npm run test:e2e:a11y     # Audit accessibilité Axe
npm run test:e2e:business # Parcours métier complet (nécessite secrets E2E_*)
npm run test:e2e:mobile   # Audit mobile
npm run test:e2e:ui       # Mode UI Playwright

# Base de données
npm run db:generate      # Régénérer client Prisma après modif schéma
npm run db:push          # Appliquer schéma sans migration (dev)
npm run db:migrate       # Créer et appliquer une migration versionnée
npm run db:seed          # Données de test
npm run db:seed:staging  # Données demo/staging réalistes
npm run db:studio        # Interface Prisma Studio
```

---

## Variables d'environnement

Toutes les variables sont validées au démarrage via `src/lib/env.ts` (Zod). Une variable obligatoire manquante empêche le démarrage.

### Obligatoires

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL via pooler PgBouncer Supabase (port 6543) |
| `DIRECT_URL` | Connexion directe PostgreSQL (port 5432, pour migrations) |
| `AUTH_SECRET` | Secret NextAuth — `openssl rand -base64 32` |
| `AUTH_URL` | URL publique de l'application (ex. `https://app.mygestia.immo`) |
| `ENCRYPTION_KEY` | Chiffrement AES-256 IBAN/BIC — 32 bytes base64 (`openssl rand -base64 32`) |
| `RESEND_API_KEY` | Envoi d'emails transactionnels |
| `EMAIL_FROM` | Adresse expéditeur vérifiée dans Resend |
| `NEXT_PUBLIC_APP_NAME` | Nom affiché dans l'interface (`MyGestia`) |
| `INSEE_API_KEY` / `INSEE_API_SECRET` | Indices IRL/ILC/ILAT pour révisions de loyer |
| `CRON_SECRET` | Authentification des jobs cron Vercel |

### Paiements (Stripe)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe |
| `STRIPE_PRICE_STARTER_MONTHLY` / `_YEARLY` | IDs prix Stripe plan Starter |
| `STRIPE_PRICE_PRO_MONTHLY` / `_YEARLY` | IDs prix Stripe plan Pro |
| `STRIPE_PRICE_ENTERPRISE_MONTHLY` / `_YEARLY` | IDs prix Stripe plan Enterprise |

### Infrastructure (optionnels)

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Cache + rate limiting (fallback mémoire si absent) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase pour Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service Supabase (server-side uniquement) |
| `NEXT_PUBLIC_SENTRY_DSN` | Monitoring Sentry (production) |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Sentry organisation/projet pour source maps |
| `NEXT_PUBLIC_ZENDESK_KEY` | Widget support Zendesk |

### Intégrations optionnelles

Voir `src/lib/env.ts` pour la liste complète avec types (GoCardless, DocuSign, Qonto, Powens, Chorus Pro, Plateforme Agréée B2B, Anthropic/OpenAI/Gemini, Braintrust, DocuSign).

---

## Déploiement

Le projet est déployé sur **Vercel** (plan Pro requis pour les cron jobs).

1. Connecter le repo GitHub à un projet Vercel
2. Configurer toutes les variables d'environnement dans **Settings → Environment Variables**
3. Chaque push sur `main` déclenche un déploiement automatique

Les cron jobs sont déclarés dans [vercel.json](vercel.json) et s'exécutent en UTC. Ils sont protégés par `CRON_SECRET` (header `Authorization: Bearer <CRON_SECRET>`).

### Pipeline CI (GitHub Actions)

Le workflow `.github/workflows/ci.yml` s'exécute sur chaque push/PR vers `main` :

1. **Lint & Type Check** — ESLint + `tsc --noEmit`
2. **Unit Tests** — Vitest avec couverture (rapport uploadé en artifact)
3. **E2E Tests** — Playwright (build complet + Chromium)
4. **Build** — dépend de Lint, Tests ET E2E — bloque le merge en cas d'échec

---

## Architecture

Voir [CLAUDE.md](CLAUDE.md) pour la documentation architecture complète destinée aux développeurs (patterns Server Actions, multi-tenant, RBAC, modules métier, etc.).

---

## Repères fonctionnels récents

- **Vie du bail** : la fiche bail regroupe désormais les actions de statut, les événements juridiques, les états des lieux et l'historique des titulaires successifs.
- **Changement de locataire en cours de bail** : une cession de fonds, cession du droit au bail, substitution ou fusion peut changer le titulaire sans recréer le bail ni consommer un nouveau numéro.
- **Facturation de masse clarifiée** : le module Facturation est organisé en onglets `À traiter`, `Brouillons`, `Factures`, `Relances` et `Quittances`. `À traiter` porte les actions de masse ; `Factures` et `Quittances` sont des registres de consultation.
- **Renvoi manuel d'une facture** : depuis le détail d'une facture déjà envoyée, le bouton `Renvoyer au locataire` renvoie l'email sans modifier la date du premier envoi, avec audit log dédié.
- **Facturation côté locataire** : la fiche locataire centralise les factures MyGestia et la situation du compte locataire.
- **Compte locataire enrichi** : reprise de solde précédent et import de relevés historiques depuis un ancien logiciel, sans génération de facture.
- **Documents côté locataire** : la fiche locataire donne accès aux documents filtrés sur ce locataire et permet d'ajouter une pièce déjà pré-rattachée.

---

## Sécurité

- **2FA TOTP** : activable par utilisateur, codes 6 chiffres / 30s, codes de récupération
- **Verrouillage compte** : 5 tentatives échouées → verrouillage 15 min
- **Chiffrement AES-256-GCM** : IBAN, BIC, codes 2FA chiffrés en base
- **Rate limiting** : login (3/10s), API (10/10s), 2FA (5/60s), portail (5/5min), webhooks — via Upstash Redis avec fallback mémoire
- **Audit log** : toute mutation sensible est tracée (`AuditLog`)
- **CSP avec nonce** : politique stricte injectée par le middleware
- **Soft delete** : locataires, baux, documents sont archivés, jamais supprimés physiquement

### En cas de suspicion de compromission

1. Révoquer immédiatement `SUPABASE_SERVICE_ROLE_KEY` dans la console Supabase → régénérer
2. Changer `AUTH_SECRET` → toutes les sessions existantes sont invalidées
3. Révoquer `STRIPE_SECRET_KEY` dans le tableau de bord Stripe
4. Auditer les logs Sentry et Supabase sur la fenêtre suspecte
5. Identifier si des données personnelles sont concernées → procédure CNIL si brèche (72h)

---

## Conformité

- **RGPD** : purge automatique des données périmées (cron `/api/cron/data-retention-cleanup` hebdomadaire le dimanche 3h), traçabilité des consentements, export des données personnelles (`/rgpd`)
- **Facturation électronique** : Chorus Pro (B2G) + Plateforme Agréée (B2B, réforme sept. 2026), norme EN 16931 / Factur-X
- **Durées de conservation** : 5 ans locataires archivés, 10 ans données bancaires, 1 an audit logs, 3 ans consentements

---

## Procédures d'urgence

### Rollback d'un déploiement Vercel

Dans le tableau de bord Vercel → **Deployments** → sélectionner le déploiement stable → **Promote to Production**.

### Restauration base de données (Supabase)

Supabase conserve des sauvegardes quotidiennes pendant 7 jours (plan Pro) / 30 jours (plan Enterprise).

1. Console Supabase → **Database → Backups**
2. Sélectionner le point de restauration
3. Restaurer vers un projet Supabase de staging pour vérification
4. Switcher `DATABASE_URL` / `DIRECT_URL` dans Vercel si nécessaire

**RTO cible** : < 4h. **RPO cible** : < 24h (sauvegarde quotidienne Supabase).

> Effectuer un test de restauration en staging au moins une fois par trimestre.

### Rollback de schéma Prisma

En cas de migration échouée en production :

```bash
# Vérifier l'état des migrations
npm run db:migrate -- --skip-generate

# Si la migration a partiellement échoué :
# 1. Corriger manuellement via Prisma Studio ou psql
# 2. Marquer la migration comme appliquée ou la résoudre
```

### Job cron bloqué

Les crons peuvent être déclenchés manuellement avec :

```bash
curl -X POST https://app.mygestia.immo/api/cron/<nom-du-job> \
  -H "Authorization: Bearer <CRON_SECRET>"
```

### Contacts d'urgence

- **Supabase** : https://supabase.com/dashboard/support
- **Vercel** : https://vercel.com/help
- **Stripe** : https://support.stripe.com
