# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MCP Context7

Utiliser **systématiquement** le MCP context7 pour toute recherche de documentation de bibliothèques, frameworks ou APIs.

- Avant d'écrire du code utilisant une librairie externe, appeler `resolve-library-id` puis `query-docs` via context7
- Ne pas se fier uniquement aux connaissances internes pour la documentation : toujours vérifier via context7

## Commandes

```bash
# Développement
npm run dev                # Serveur dev (Turbopack)
npm run build              # Build production
npm run start              # Serveur production
npm run lint               # ESLint

# Tests (Vitest)
npm test                   # Lancer tous les tests
npm test -- src/actions/invoice.test.ts  # Lancer un seul fichier de test
npm run test:watch         # Mode watch
npm run test:coverage      # Avec rapport de couverture

# Base de données
npm run db:generate        # Régénérer le client Prisma après modif du schéma
npm run db:push            # Appliquer le schéma sans migration (dev)
npm run db:migrate         # Créer et appliquer une migration
npm run db:seed            # Seeder la base (tsx prisma/seed.ts)
npm run db:studio          # Ouvrir Prisma Studio
```

**Note :** Le client Prisma est généré dans `src/generated/prisma/client` (pas le chemin par défaut). Toujours lancer `npm run db:generate` après modification du schéma.

## Architecture

### Stack

- **Next.js 16** (App Router, Server Components, Server Actions, Turbopack)
- **React 19** avec TypeScript strict
- **Tailwind CSS v4** (PostCSS)
- **Prisma 6** (PostgreSQL / Supabase)
- **NextAuth.js v5** (credentials + stratégie JWT 24h)
- **shadcn/ui** pour les composants UI (`src/components/ui/`)
- **Resend** pour les emails (`src/lib/email.ts`)
- **Zod** pour la validation (`src/validations/`)
- **AES-256-GCM** pour le chiffrement des données bancaires (`src/lib/encryption.ts`)
- **@react-pdf/renderer v4** pour la génération de PDF (`src/lib/invoice-pdf.tsx`)
- **Supabase Storage** pour le stockage des fichiers (logos, PDFs, documents)
- **Upstash Redis** pour le cache et le rate-limiting
- **Recharts** pour les graphiques du dashboard
- **Vitest** pour les tests unitaires

### Alias de chemin

`@/*` → `src/*`

### Variables d'environnement

Toutes les env vars sont **validées au démarrage** via `src/lib/env.ts` (Zod). Utiliser `env.NOM_VAR` depuis ce fichier plutôt que `process.env.NOM_VAR` directement dans le code.

```
DATABASE_URL, DIRECT_URL              # Supabase PostgreSQL
AUTH_SECRET, AUTH_URL                  # NextAuth v5
ENCRYPTION_KEY                        # 32 bytes base64 (IBAN/BIC)
RESEND_API_KEY, EMAIL_FROM            # Emails (contact@mtggroupe.org)
NEXT_PUBLIC_APP_NAME                  # Branding UI
INSEE_API_KEY, INSEE_API_SECRET       # Indices IRL
CRON_SECRET                           # Jobs planifiés
ANTHROPIC_API_KEY                     # Claude API (optionnel)
GOCARDLESS_SECRET_ID, GOCARDLESS_SECRET_KEY  # Intégration bancaire (optionnel)
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN  # Cache Redis (optionnel)
NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  # Stockage fichiers (optionnel)
POWENS_DOMAIN, POWENS_CLIENT_ID, POWENS_CLIENT_SECRET  # Connexion bancaire Powens (optionnel)
NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT     # Monitoring Sentry (optionnel)
```

## Structure et flux de requêtes

### Route Groups

- `src/app/(auth)/` — pages publiques (login, forgot-password)
- `src/app/(app)/` — pages protégées, nécessitent session active + société sélectionnée

### Middleware (`src/middleware.ts` → `src/proxy.ts`)

La logique middleware est dans `src/proxy.ts` (exportée depuis `middleware.ts`) :

1. Authentification via NextAuth wrapper
2. Redirige vers `/login` si non authentifié (sauf routes publiques : `/`, `/locaux`, `/contact`, `/mentions-legales`, `/politique-confidentialite`, `/api/public`, `/api/auth`, `/dataroom`, `/api/webhooks`)
3. **2FA** : si l'utilisateur a 2FA activé, redirige vers `/login/two-factor` tant que non vérifié
4. **Rate limiting** via Upstash Redis (si configuré) — fallback mémoire si Redis absent :
   - Login : 3 req/10s ; API : 10 req/10s ; 2FA : 5 req/60s ; Portal : 5 req/5min
5. **En-têtes de sécurité** (`next.config.ts`) : CSP avec nonce, HSTS, Permissions-Policy. `X-Frame-Options: SAMEORIGIN` sur tout sauf `/api/storage/view` et `/api/invoices/[id]/pdf` (iframe PDF autorisé)
6. Injecte `x-society-id` et `x-nonce` dans les headers pour les Server Components
7. Routes portail (`/portal`, `/api/portal`) utilisent une auth JWT séparée (`src/lib/portal-auth.ts`)

### Multi-tenant & Multi-propriétaire

Toute l'application est multi-société. Chaque entité Prisma est scopée par `societyId`.

- **Côté client** : `SocietyProvider` (`src/providers/society-provider.tsx`) + hook `useSociety()` gère le cookie `active-society-id`
- **Côté serveur** : `requireSocietyAccess(userId, societyId, minRole?)` dans `src/lib/permissions.ts`
- **Auto-scoping Prisma** : `createTenantPrisma(societyId)` dans `src/lib/prisma-tenant.ts` injecte automatiquement `societyId` dans toutes les requêtes (find, create, update, delete)
- **Propriétaires** : Un utilisateur peut avoir plusieurs entités `Proprietaire` (SCI, SARL, personne physique), chacune regroupant des sociétés. Actions CRUD dans `src/actions/proprietaire.ts`. Migration automatique des sociétés existantes via `migrateOwnerToProprietaire()`.

### Authentification avancée

- **Verrouillage de compte** : 5 tentatives échouées → compte verrouillé 15 min (`src/lib/auth.ts`). Reset au login réussi.
- **2FA TOTP** (`src/lib/two-factor.ts`) : OTPAuth SHA1, 6 chiffres, 30s. Secret chiffré AES-256. QR code pour apps authenticator. Codes de récupération format `XXXXX-XXXXX` (chiffrés).
- **Timeout d'inactivité** (`src/providers/idle-timeout-provider.tsx`) : déconnexion auto après 10 min d'inactivité, avertissement 1 min avant. Redirige vers `/login?reason=idle`.

### Portail locataire

Routes `/portal` et `/api/portal` utilisent une authentification JWT indépendante de NextAuth (`src/lib/portal-auth.ts`) :
- Tokens JWT 24h stockés en cookie httpOnly `portal-token`
- Rate limiting séparé (5 req/5min par email)

### Abonnements & Essai gratuit

Chaque société dispose d'un abonnement (`Subscription`) géré par `src/lib/plan-limits.ts` :

- **Essai implicite** : 14 jours, créé automatiquement à la création de société (sans Stripe, `stripeCustomerId` null)
- **Cycle de vie** : TRIALING → ACTIVE (via Stripe checkout) ou TRIALING → CANCELED (expiration)
- **Plans** : STARTER (20 lots, 1 société, 2 users) / PRO (50 lots, 3 sociétés, 5 users) / ENTERPRISE (illimité). Seul ENTERPRISE a : signature électronique, import IA, accès API.
- **Enforcement** : `checkSubscriptionActive()` vérifié avant toute mutation critique (lot, building, lease, tenant, invoice, user, society)
- **Limites par plan** : `checkLotLimit()`, `checkUserLimit()`, `checkSocietyLimit()` dans `src/lib/plan-limits.ts`
- **Bannière** : `SubscriptionBanner` (`src/components/layout/subscription-banner.tsx`) affiche les alertes (trial ≤5j, expiration, impayé)
- **Cron** : `/api/cron/sync-subscriptions` (quotidien 6h30) expire les trials et resynchronise les statuts Stripe

### RBAC

Hiérarchie : `SUPER_ADMIN (50) > ADMIN_SOCIETE (40) > GESTIONNAIRE (30) > COMPTABLE (20) > LECTURE (10)`

Fonctions dans `src/lib/permissions.ts` : `requireSocietyAccess()`, `requireSuperAdmin()`, `hasMinRole()`.
Erreurs custom : `ForbiddenError`, `NotFoundError`.

**Permissions granulaires par module** : `UserSociety.modulePermissions` (JSON) permet de surcharger les droits par rôle pour chaque module (read/write/delete). `hasModulePermission()` vérifie d'abord ces surcharges avant le rôle global. Le propriétaire de la société (`society.ownerId`) a toujours accès complet.

## Patterns de code

### Server Actions (`src/actions/`)

Toutes les mutations passent par des Server Actions. Pattern systématique :

```typescript
"use server";
import type { ActionResult } from "@/actions/society"; // { success: boolean; data?: T; error?: string }

export async function createEntity(societyId: string, input: Input): Promise<ActionResult<{ id: string }>> {
  try {
    // 1. Session
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    // 2. Permissions
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    // 3. Validation Zod
    const parsed = createEntitySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map(e => e.message).join(", ") };

    // 4. Opération Prisma
    const result = await prisma.entity.create({ data: { societyId, ...parsed.data } });

    // 5. Audit log
    await createAuditLog({ societyId, userId: session.user.id, action: "CREATE", entity: "Entity", entityId: result.id });

    // 6. Revalidation cache
    revalidatePath("/path");
    return { success: true, data: { id: result.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createEntity]", error);
    return { success: false, error: "Erreur lors de l'opération" };
  }
}
```

Le type `ActionResult<T>` est défini dans `src/actions/society.ts` et importé par toutes les autres actions.

### Validations Zod (`src/validations/`)

Chaque module a un fichier de validation avec le pattern :

```typescript
export const createEntitySchema = z.object({ /* ... */ });
export const updateEntitySchema = createEntitySchema.partial().extend({ id: z.string().cuid() });
export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
```

### API Routes (`src/app/api/`)

Convention REST :
```
GET    /api/[module]       → liste (paginée)
POST   /api/[module]       → création
GET    /api/[module]/[id]  → détail
PUT    /api/[module]/[id]  → mise à jour
DELETE /api/[module]/[id]  → suppression (soft delete si possible)
```

**Récupération du societyId** dans les routes API :
```typescript
const cookieStore = await cookies();
const societyId = cookieStore.get("active-society-id")?.value;
```

Réponse standard :
```typescript
// Succès
{ data: T, meta?: { total, page, pageSize } }
// Erreur
{ error: { code: string, message: string, details?: unknown } }
```

### Utilitaires (`src/lib/utils.ts`)

- `cn()` — merge classes Tailwind
- `formatCurrency(amount)` — `Intl.NumberFormat("fr-FR", { currency: "EUR" })`
- `formatDate(date)` — format `dd/MM/yyyy`
- `formatDateTime(date)` — format `dd/MM/yyyy HH:mm`

### Prisma singleton (`src/lib/prisma.ts`)

Client unique avec cache `globalThis` en dev. Logs `query`+`error`+`warn` en dev, `error` seul en prod.

### Emails (`src/lib/email.ts`)

Via Resend. Templates HTML intégrés : relance (3 niveaux), facture, quittance, bienvenue utilisateur, bienvenue locataire.

### Génération PDF (`src/lib/invoice-pdf.tsx`, `src/app/api/invoices/[id]/pdf/route.ts`)

Les factures PDF utilisent `@react-pdf/renderer`. Le composant `InvoicePdf` reçoit un objet `InvoicePdfData` complet. La route API `/api/invoices/[id]/pdf` :
1. Déchiffre l'IBAN/BIC (AES-256)
2. Récupère une URL signée Supabase pour le logo (300s)
3. Calcule le solde précédent (factures impayées du même bail)
4. Génère le PDF avec `renderToBuffer()`
5. Uploade dans Supabase Storage (`invoices/{societyId}/{year}/{number}.pdf`)
6. Crée un audit log `GENERATE_PDF`
7. Répond avec `Content-Type: application/pdf` (inline, cache 300s)

### Stockage fichiers (Supabase Storage)

Les fichiers sont stockés dans Supabase Storage. Les routes `src/app/api/storage/signed-upload/route.ts` et `src/app/api/storage/view/route.ts` gèrent respectivement l'upload signé et la consultation sécurisée des fichiers.

### Fonctionnalités IA

- **Analyse de documents** (`src/lib/document-ai.ts`) : extrait résumé, tags et catégorie via Claude Opus 4.5. 9 catégories : bail, avenant, quittance, facture, diagnostic, assurance, titre_propriete, contrat, etat_des_lieux. Nécessite `ANTHROPIC_API_KEY`.
- **Évaluation patrimoniale** (`src/lib/valuation/ai-service.ts`) : estimation de loyers et de valeur vénale. Utilise Claude (principal), OpenAI et Gemini. Inclut analyse SWOT, comparables, score de confiance, données DVF (Demandes de Valeurs Foncières). Nécessite `ANTHROPIC_API_KEY`.

### Rapports (`src/lib/report-generator.ts`, `src/lib/reports/`)

9 types de rapports PDF : `balance-agee`, `compte-rendu-gestion`, `etat-impayes`, `rentabilite-lot`, `recap-charges-locataire`, `situation-locative`, `suivi-mensuel`, `suivi-travaux`, `vacance-locative`.

- Génération PDF avec graphiques (`pdf-charts.ts`, `pdf-core.ts`)
- Rapports consolidés multi-sociétés (`reports/consolidated.ts`)
- Module `/rapports` pour consultation ; `/rapports/planification` pour envoi planifié
- Cron `/api/cron/send-reports` pour envoi automatique

### Open Banking

Deux intégrations bancaires parallèles, toutes deux optionnelles :

| Service | Lib | Variables | Usage |
|---------|-----|-----------|-------|
| **GoCardless** | `src/lib/gocardless.ts` | `GOCARDLESS_SECRET_ID/KEY` | PSD2 Open Banking Europe |
| **Powens** (ex-Budget Insight) | `src/lib/powens.ts` | `POWENS_DOMAIN/CLIENT_ID/SECRET` | API bancaire alternative |

## Modules métier

Tous les modules sont implémentés dans `src/app/(app)/` avec leur action (`src/actions/`) et validation (`src/validations/`) correspondantes :

| Module | Route | Actions |
|--------|-------|---------|
| Patrimoine (Immeubles, Lots) | `/patrimoine` | `building.ts`, `lot.ts` |
| Diagnostics, Maintenances | `/patrimoine/immeubles/[id]/...` | `diagnostic.ts`, `maintenance.ts` |
| Baux, Inspections | `/baux` | `lease.ts`, `inspection.ts` |
| Locataires | `/locataires` | `tenant.ts` |
| Charges + Catégories | `/charges` | `charge.ts`, `chargeProvision.ts` |
| Facturation + Paiements | `/facturation` | `invoice.ts`, `payment.ts` |
| Banque + Transactions + Rapprochement | `/banque` | `bank.ts`, `bank-connection.ts`, `bank-reconciliation.ts` |
| Comptabilité + Prévisionnel | `/comptabilite` | via API routes |
| Emprunts + Amortissement | `/emprunts` | `loan.ts` (3 types : AMORTISSABLE, IN_FINE, BULLET) |
| Indices ILC/ILAT/ICC | `/indices` | via API INSEE |
| Relances | `/relances` | `reminder.ts` |
| Contacts | `/contacts` | `contact.ts` |
| RGPD | `/rgpd` | via API routes |
| Documents | — | `document.ts` |
| Signatures | — | `signature.ts` |
| SEPA | — | `sepa.ts` |
| Notifications | — | `notifications.ts` |
| Import données | — | `import.ts` |
| Fusion entités | `/administration/fusions` | `merge.ts` |
| Administration | `/administration/...` | `user.ts`, `auth.ts` |
| Dashboard + Analytiques | `/dashboard` | `dashboard.ts`, `analytics.ts` |
| Propriétaires | `/proprietaire` | `proprietaire.ts` |
| Abonnements | `/compte/abonnement` | `subscription.ts` |
| Évaluations patrimoine | `/patrimoine/evaluations` | `valuation.ts` |
| Rapports | `/rapports`, `/rapports/planification` | `report-generator.ts` |

## Cron Jobs (Vercel)

Définis dans `vercel.json`, protégés par `CRON_SECRET` :

| Job | Schedule | Description |
|-----|----------|-------------|
| `/api/cron/generate-drafts` | Quotidien 7h | Génération auto brouillons factures |
| `/api/cron/sync-bank` | Quotidien 6h | Synchronisation transactions bancaires |
| `/api/cron/sync-subscriptions` | Quotidien 6h30 | Expiration trials + sync statuts Stripe |
| `/api/cron/invoice-reminder` | Lundi 8h | Relances factures impayées |
| `/api/cron/insurance-reminder` | Lundi 9h | Rappels assurances |
| `/api/cron/sync-indices` | 1er du mois 7h | MAJ indices INSEE |
| `/api/cron/rent-revisions` | 1er du mois 8h | Révisions de loyer |
| `/api/cron/send-reports` | Configurable | Envoi rapports planifiés |

## Monitoring (Sentry)

Configuré dans `sentry.*.config.ts` et `instrumentation.ts`. Actif uniquement en production (10% traces).

## Git Hooks

**Husky + lint-staged** : à chaque commit, ESLint `--fix` est lancé sur les fichiers `.ts`/`.tsx` stagés. `.npmrc` a `legacy-peer-deps=true` pour la compatibilité des dépendances.

## Tests (Vitest)

Configuration dans `vitest.config.ts`. Setup file : `src/test/setup.ts`. Couverture sur `src/lib/**`, `src/actions/**`, `src/validations/**`.

## Tailwind CSS v4

Pas de fichier `tailwind.config` : la configuration est dans `src/app/globals.css` via `@theme` (couleurs OKLch, polices Inter/JetBrains Mono, animations custom). Server Actions body limit : 20 MB (`next.config.ts`).

## Règles impératives

### Données

```typescript
// ✅ TOUJOURS : scoper par societyId (jamais sans)
const lots = await prisma.lot.findMany({ where: { societyId } })

// ✅ TOUJOURS : valider avec Zod avant d'écrire en BDD
// ✅ TOUJOURS : appeler createAuditLog() sur toute mutation
// ✅ TOUJOURS : montants en euros (Float), affichage avec formatCurrency()
// ✅ TOUJOURS : soft delete pour locataires, baux, documents
// ✅ TOUJOURS : accéder aux env vars via env.NOM_VAR (src/lib/env.ts), pas process.env

// ❌ JAMAIS : IBAN/BIC en clair — utiliser encryptBankData()
// ❌ JAMAIS : requête Prisma sans societyId (sauf SUPER_ADMIN explicite)
// ❌ JAMAIS : societyId depuis le body/params — toujours depuis la session ou le cookie
```

### TypeScript

- Strict mode — zéro `any` implicite
- `as Type` uniquement avec commentaire justificatif
- Types explicites sur tous les paramètres de fonction

### UI

- Composants shadcn/ui en priorité (`src/components/ui/`)
- Chaque module a un `loading.tsx` pour les états de chargement (Skeleton)
- `error.tsx` et `not-found.tsx` à la racine de `/(app)/` gèrent les erreurs globales
- Breadcrumb auto-généré par `src/components/layout/breadcrumb.tsx` (parse le pathname)
- Toasts pour feedback succès/erreur
- Responsive mobile-first obligatoire

### Navigation (top-nav uniquement)

L'application utilise **exclusivement la barre de navigation horizontale** (`top-nav.tsx`) — il n'y a pas de sidebar latérale gauche.

**Architecture de navigation :**
```
AppLayout (src/app/(app)/layout.tsx)
├── TopNav           → navigation horizontale principale (desktop)
├── Header           → barre supérieure (logo, recherche, profil, burger menu mobile)
│   └── MobileSidebar → tiroir latéral (mobile/tablette uniquement, déclenché par le burger menu)
├── SubscriptionBanner
├── Breadcrumb
└── Main content (pleine largeur, pas de marge gauche pour sidebar)
```

**Composants actifs :**
- `src/components/layout/top-nav.tsx` — Barre horizontale avec liens directs + dropdowns (Gestion locative, Modules). Contient `ProprietaireSwitcher` et `SocietySwitcher`.
- `src/components/layout/mobile-sidebar.tsx` — Tiroir glissant pour mobile avec la navigation complète. Déclenché par le Header.
- `src/components/layout/header.tsx` — Logo, recherche globale, notifications, profil utilisateur, bouton burger mobile.

**Composant obsolète :**
- `src/components/layout/sidebar.tsx` — ⚠️ **NE PAS UTILISER**. Fichier conservé mais non importé dans aucun layout. Ne pas l'importer ni le rendre.

**Règles :**
- ❌ **JAMAIS** importer ou rendre `Sidebar` dans un layout
- ✅ Pour ajouter un nouveau lien de navigation, modifier `top-nav.tsx` (desktop) ET `mobile-sidebar.tsx` (mobile)
- ✅ Le contenu principal occupe 100% de la largeur (pas de `lg:ml-[260px]` ni offset sidebar)
- ✅ Les dropdowns dans `top-nav.tsx` regroupent les sous-sections (Gestion locative, Modules)

### Règles métier

- Un lot ne peut avoir qu'un seul bail actif à la fois
- Un bail résilié ne peut pas être réactivé (créer un nouveau bail)
- Les dates de bail utilisent le fuseau horaire `Europe/Paris`
- Les indices IRL sont mis à jour trimestriellement (source INSEE)

## Durées de conservation RGPD

```typescript
const RETENTION = {
  LOCATAIRE_ACTIF: null,          // Conservation illimitée
  LOCATAIRE_ARCHIVE: 5 * YEAR,    // 5 ans après fin de bail
  DOCUMENT_IDENTITE: 3 * YEAR,    // 3 ans après fin de relation
  DONNEE_BANCAIRE: 10 * YEAR,     // Obligation légale comptable
  AUDIT_LOG: 1 * YEAR,
  CONSENTEMENT: 3 * YEAR,         // 3 ans après révocation
}
```
