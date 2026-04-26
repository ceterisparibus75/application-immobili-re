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

## Démarrage

> ⚠️ Ne pas travailler dans un dossier Google Drive File Stream — utiliser un disque local (ex. `C:\dev\mygestia`).

```bash
# 1. Variables d'environnement
cp .env.example .env.local
# Remplir les valeurs obligatoires (voir .env.example)

# 2. Installation
npm install

# 3. Base de données
npm run db:push      # Synchroniser le schéma
npm run db:generate  # Générer le client Prisma

# 4. Serveur de développement
npm run dev
```

L'application tourne sur [http://localhost:3000](http://localhost:3000).

## Commandes

```bash
npm run dev              # Serveur dev (Turbopack)
npm run build            # Build production
npm run lint             # ESLint
npx tsc --noEmit         # Vérification TypeScript

# Tests
npm test                 # Tous les tests unitaires (Vitest)
npm run test:coverage    # Avec rapport de couverture (seuils : 75%)
npm run test:e2e         # Tests E2E Playwright

# Base de données
npm run db:generate      # Régénérer client Prisma
npm run db:push          # Appliquer schéma (dev)
npm run db:migrate       # Créer migration versionnée
npm run db:seed          # Données de test
npm run db:studio        # Interface Prisma Studio
```

## Variables d'environnement requises

Voir [.env.example](.env.example) pour la liste complète avec descriptions.

Obligatoires au démarrage :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL via pooler PgBouncer Supabase (port 6543) |
| `DIRECT_URL` | Connexion directe PostgreSQL (port 5432, pour migrations) |
| `AUTH_SECRET` | Secret NextAuth — `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Chiffrement AES-256 IBAN/BIC — `openssl rand -base64 32` |
| `RESEND_API_KEY` | Envoi d'emails |
| `EMAIL_FROM` | Adresse expéditeur vérifiée dans Resend |

## Architecture

Voir [CLAUDE.md](CLAUDE.md) pour la documentation architecture complète destinée aux développeurs.

## Déploiement

Déploiement via Vercel. Les variables d'environnement sont à configurer dans **Settings → Environment Variables**.

Les cron jobs sont déclarés dans [vercel.json](vercel.json) et protégés par `CRON_SECRET`.

## Conformité

- **RGPD** : purge automatique des données périmées (cron hebdomadaire), traçabilité des consentements, export des données personnelles
- **Facturation électronique** : Chorus Pro (B2G) + Plateforme Agréée (B2B, réforme 2026), norme EN 16931 / Factur-X
- **Sécurité** : 2FA TOTP, chiffrement AES-256-GCM des données bancaires, audit log complet, rate limiting
