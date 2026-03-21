# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MCP Context7

Utiliser **systématiquement** le MCP context7 pour toute recherche de documentation de bibliothèques, frameworks ou APIs.

- Avant d'écrire du code utilisant une librairie externe, appeler `resolve-library-id` puis `query-docs` via context7
- Ne pas se fier uniquement aux connaissances internes pour la documentation : toujours vérifier via context7

## Commandes

```bash
# Développement
npm run dev

# Build production
npm run build

# Lint
npm run lint

# Base de données
npm run db:generate    # Régénérer le client Prisma après modif du schéma
npm run db:push        # Appliquer le schéma sans migration (dev)
npm run db:migrate     # Créer et appliquer une migration
npm run db:seed        # Seeder la base
npm run db:studio      # Ouvrir Prisma Studio
```

## Architecture

### Stack

- **Next.js 16** (App Router, Server Components, Server Actions)
- **React 19** avec TypeScript strict
- **Tailwind CSS v4**
- **Prisma 6** (PostgreSQL / Supabase)
- **NextAuth.js v5** (credentials + stratégie JWT 24h)
- **shadcn/ui** pour les composants UI (`src/components/ui/`)
- **Resend** pour les emails
- **AES-256-GCM** pour le chiffrement des données bancaires

### Variables d'environnement clés

```
DATABASE_URL, DIRECT_URL         # Supabase PostgreSQL
AUTH_SECRET, AUTH_URL            # NextAuth v5
ENCRYPTION_KEY                   # 32 bytes base64 (IBAN/BIC)
RESEND_API_KEY, EMAIL_FROM       # Emails
INSEE_API_KEY, INSEE_API_SECRET  # Indices IRL
CRON_SECRET                      # Jobs planifiés
```

### Structure des routes

Deux groupes de layouts dans `src/app/` :

- `(auth)/` — pages publiques (login)
- `(app)/` — pages protégées, nécessitent une session active et une société sélectionnée

Le middleware (`src/middleware.ts`) protège toutes les routes sauf les chemins publics définis. Il lit le cookie `active-society-id` et l'injecte dans les headers (`x-society-id`) pour les Server Components.

### Multi-tenant

Toute l'application est multi-société. Chaque entité Prisma est scopée par `societyId`. L'accès est vérifié via `requireSocietyAccess()` dans `src/lib/permissions.ts`.

- La société active est gérée côté client par `SocietyProvider` (`src/providers/society-provider.tsx`) via le hook `useSociety()`
- Le changement de société met à jour le cookie `active-society-id`
- Helpers multi-tenant dans `src/lib/prisma-tenant.ts`

### RBAC

Hiérarchie de rôles (valeur numérique) : `SUPER_ADMIN (50) > ADMIN_SOCIETE (40) > GESTIONNAIRE (30) > COMPTABLE (20) > LECTURE (10)`

Fonctions clés dans `src/lib/permissions.ts` : `requireSocietyAccess()`, `requireSuperAdmin()`, `hasMinRole()`.
Erreurs custom : `ForbiddenError`, `NotFoundError`.

### Server Actions

Toutes les mutations passent par des Server Actions dans `src/actions/`. Pattern systématique :
1. Vérification de session (`getServerSession`)
2. Vérification des droits (`requireSocietyAccess`)
3. Validation Zod (`src/validations/`)
4. Opération Prisma
5. Audit log (`createAuditLog` dans `src/lib/audit.ts`)

### Chiffrement

Les données sensibles (IBAN, BIC) sont chiffrées en AES-256-GCM via `src/lib/encryption.ts`. La clé est dans `ENCRYPTION_KEY` (env, 32 bytes base64).

### Alias de chemin

`@/*` → `src/*`

## État actuel du projet

### Implémenté

- Auth (NextAuth v5, credentials, JWT 24h)
- RBAC 5 niveaux (`src/lib/permissions.ts`)
- Multi-tenant avec société active (`src/providers/society-provider.tsx`)
- Audit log (`src/lib/audit.ts`)
- Chiffrement AES-256-GCM (`src/lib/encryption.ts`)
- Schéma Prisma complet — modèles couvrant les 9 phases métier + Emprunts + Budget
- Pages : login, dashboard (placeholder), sociétés (CRUD complet), administration/audit, paramètres

### Implémenté — Phases métier

Toutes les phases ont une interface fonctionnelle dans `src/app/(app)/` :

| Module | Route | État |
|--------|-------|------|
| Patrimoine (Immeubles, Lots, Diagnostics, Maintenances) | `/patrimoine` | ✅ |
| Gestion locative (Baux, Inspections) | `/baux` | ✅ |
| Locataires | `/locataires` | ✅ |
| Charges + Catégories | `/charges` | ✅ |
| Facturation + Paiements | `/facturation` | ✅ |
| Banque + Transactions | `/banque` | ✅ |
| Comptabilité (Plan comptable, Écritures) | `/comptabilite` | ✅ |
| Prévisionnel / Budget vs. réalisé | `/comptabilite/previsionnel` | ✅ |
| **Emprunts + Tableau d'amortissement** | `/emprunts` | ✅ |
| Indices ILC/ILAT/ICC | `/indices` | ✅ |
| Relances | `/relances` | ✅ |
| Contacts | `/contacts` | ✅ |
| RGPD | `/rgpd` | ✅ |

### Module Emprunts

- Modèles Prisma : `Loan`, `LoanAmortizationLine`, `BudgetLine`
- Actions dans `src/actions/loan.ts` : `createLoan`, `getLoans`, `getLoanById`, `markAmortizationLinePaid`, `upsertBudgetLine`, `getBudgetLines`
- Calcul automatique du tableau d'amortissement (AMORTISSABLE/IN_FINE/BULLET)
- Valeur nette = valeur d'acquisition − capital restant dû
- Lié à un immeuble (`buildingId` optionnel)

## Règles impératives

### Données

```typescript
// ✅ TOUJOURS : scoper par societyId (jamais sans)
const lots = await prisma.lot.findMany({ where: { societyId } })

// ✅ TOUJOURS : valider avec Zod avant d'écrire en BDD
// ✅ TOUJOURS : appeler l'audit log sur toute mutation
// ✅ TOUJOURS : montants en euros (Float), affichage avec .toLocaleString("fr-FR") ou Intl.NumberFormat
// ✅ TOUJOURS : soft delete pour locataires, baux, documents

// ❌ JAMAIS : IBAN/BIC en clair — utiliser encryptBankData()
// ❌ JAMAIS : requête Prisma sans societyId (sauf SUPER_ADMIN explicite)
// ❌ JAMAIS : societyId depuis le body/params — toujours depuis la session
```

### API Routes

Convention REST :
```
GET    /api/[module]       → liste paginée
POST   /api/[module]       → création
GET    /api/[module]/[id]  → détail
PUT    /api/[module]/[id]  → mise à jour complète
PATCH  /api/[module]/[id]  → mise à jour partielle
DELETE /api/[module]/[id]  → suppression (soft delete si possible)
```

Réponse standard :
```typescript
// Succès
{ data: T, meta?: { total, page, pageSize } }
// Erreur
{ error: { code: string, message: string, details?: unknown } }
```

Ordre impératif dans chaque route :
1. `getServerSession` → 401 si absent
2. `checkPermission` → 403 si insuffisant
3. Validation Zod → 400 si invalide
4. Logique métier + audit log

### TypeScript

- Strict mode sans compromis — zéro `any` implicite
- `as Type` uniquement avec commentaire justificatif
- Types explicites sur tous les paramètres de fonction
- Zod pour toutes les données externes

### UI

- Composants shadcn/ui en priorité (`src/components/ui/`)
- États de chargement sur toute action async (Skeleton / Spinner)
- Toasts pour feedback succès/erreur
- Responsive mobile-first obligatoire

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
