# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Nom du projet :** `mygestia` — application SaaS de gestion locative multi-tenant.

## Environnement de développement

⚠️ **Ne pas lancer le dev server depuis un dossier Google Drive File Stream** (ex. `G:\Mon Drive\…`). Next.js 16 + Turbopack crée des junction points Windows dans `.next/dev/node_modules/` qui échouent sur Google Drive (`os error 1`). Cloner le repo sur disque local (ex. `C:\dev\mygestia`) et y travailler.

## MCP Context7

Utiliser **systématiquement** le MCP context7 pour toute recherche de documentation de bibliothèques, frameworks ou APIs.

- Avant d'écrire du code utilisant une librairie externe, appeler `resolve-library-id` puis `query-docs` via context7
- Ne pas se fier uniquement aux connaissances internes pour la documentation : toujours vérifier via context7

## Commandes

```bash
# Installation (--legacy-peer-deps requis, configuré dans .npmrc)
npm ci                     # Install deps (CI)
npm install                # Install deps (dev)

# Développement
npm run dev                # Serveur dev (next dev)
npm run build              # Build production (inclut prisma generate)
npm run start              # Serveur production
npm run lint               # ESLint
npx tsc --noEmit           # Type-check sans build

# Tests unitaires (Vitest)
npm test                   # Lancer tous les tests
npm test -- src/actions/invoice.test.ts  # Lancer un seul fichier de test
npm run test:watch         # Mode watch
npm run test:coverage      # Avec rapport de couverture

# Tests E2E (Playwright)
npm run test:e2e           # Lancer les tests E2E (build + start automatiques)
npm run test:e2e:ui        # Mode UI Playwright
# Tests dans e2e/, uniquement Chromium, base URL http://localhost:3000
# ⚠️ Couverture E2E minimale : seulement auth.spec.ts + navigation.spec.ts — ne pas s'y fier pour la non-régression

# Base de données
npm run db:generate        # Régénérer le client Prisma après modif du schéma
npm run db:push            # Appliquer le schéma sans migration (dev)
npm run db:migrate         # Créer et appliquer une migration
npm run db:seed            # Seeder la base (tsx prisma/seed.ts)
npm run db:studio          # Ouvrir Prisma Studio
```

**Node.js :** Version 20 (utilisée en CI).

**Prisma :** Le client est généré dans `src/generated/prisma/client` (pas le chemin par défaut). Toujours lancer `npm run db:generate` après modification du schéma.

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
# Obligatoires
DATABASE_URL, DIRECT_URL                           # Supabase PostgreSQL
AUTH_SECRET, AUTH_URL                              # NextAuth v5
ENCRYPTION_KEY                                     # 32 bytes base64 (IBAN/BIC)
RESEND_API_KEY, EMAIL_FROM                         # Emails
NEXT_PUBLIC_APP_NAME                               # Branding UI
INSEE_API_KEY, INSEE_API_SECRET                    # Indices IRL
CRON_SECRET                                        # Jobs planifiés

# IA (tous optionnels, dégradation gracieuse)
ANTHROPIC_API_KEY                                  # Claude (chatbot, analyse docs, import IA, évaluation)
OPENAI_API_KEY                                     # OpenAI (évaluation patrimoniale, fallback)
GOOGLE_AI_API_KEY                                  # Gemini (évaluation patrimoniale, fallback)
MISTRAL_API_KEY                                    # Mistral (optionnel)
BRAINTRUST_API_KEY, BRAINTRUST_PROJECT_ID          # Observabilité LLM (optionnel)

# Bancaire (tous optionnels)
GOCARDLESS_SECRET_ID, GOCARDLESS_SECRET_KEY        # Open Banking PSD2 + SEPA
POWENS_DOMAIN, POWENS_CLIENT_ID, POWENS_CLIENT_SECRET  # Powens / Budget Insight
QONTO_CLIENT_ID, QONTO_CLIENT_SECRET               # Qonto (3e provider bancaire)

# Paiements / Abonnements (optionnel)
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER_MONTHLY, STRIPE_PRICE_STARTER_YEARLY
STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY
STRIPE_PRICE_ENTERPRISE_MONTHLY, STRIPE_PRICE_ENTERPRISE_YEARLY

# Signature électronique ENTERPRISE uniquement (optionnel)
DOCUSIGN_API_KEY, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_USER_ID
DOCUSIGN_PRIVATE_KEY                               # RSA en base64
DOCUSIGN_BASE_URL, DOCUSIGN_AUTH_URL, DOCUSIGN_WEBHOOK_SECRET

# Facturation électronique B2B (tous optionnels — réforme sept. 2026)
PISTE_CLIENT_ID, PISTE_CLIENT_SECRET               # OAuth2 PISTE (B2G — Chorus Pro uniquement)
PISTE_ENV                                          # "sandbox" | "production" (défaut sandbox)
CHORUS_PRO_ENV                                     # "sandbox" | "production" (défaut sandbox)
CHORUS_PRO_TECH_ACCOUNT                            # Compte technique Chorus Pro (ex. TECH_1_xxx@cpro.fr)
CHORUS_PRO_TECH_PASSWORD                           # Mot de passe compte technique
CHORUS_PRO_TECH_USER_ID                            # ID numérique interne Chorus Pro
PA_API_BASE_URL                                    # URL de base de la Plateforme Agréée B2B
PA_API_KEY                                         # Clé API PA (Bearer token)
PA_AUTH_TOKEN_URL                                  # URL token OAuth2 PA (si la PA utilise OAuth2)
PA_AUTH_CLIENT_ID, PA_AUTH_CLIENT_SECRET           # Credentials OAuth2 PA
PA_MANDATAIRE_SIRET                                # ★ SIRET MTG Holding — active le Mode B (SC mandataire)

# Infrastructure (tous optionnels)
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN  # Cache + rate-limiting
NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  # Stockage fichiers
NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT  # Monitoring Sentry
NEXT_PUBLIC_ZENDESK_KEY                           # Widget support Zendesk
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

- **Côté client** : `SocietyProvider` (`src/providers/society-provider.tsx`) + hook `useSociety()` gère le cookie `active-society-id`. Hook `useAutoSave` (`src/hooks/use-auto-save.ts`) disponible pour la sauvegarde automatique dans les formulaires complexes.
- **Server Actions société explicite** : utiliser `requireSocietyActionContext(...)` / `getOptionalSocietyActionContext(...)` dans `src/lib/action-society.ts`
- **Server Actions société active** : utiliser `requireActiveSociety(...)` / helpers associés dans `src/lib/active-society.ts`
- **Server Actions auth simple** : utiliser `requireAuthenticatedActionContext()` dans `src/lib/action-auth.ts`
- **Routes API société active** : utiliser `requireActiveSocietyRouteContext(...)` dans `src/lib/api-society.ts`
- **Routes API auth simple** : utiliser `requireAuthenticatedRouteContext()` ou `getOptionalAuthenticatedRouteContext()` dans `src/lib/api-auth.ts`
- **Permissions bas niveau** : `requireSocietyAccess(userId, societyId, minRole?)` dans `src/lib/permissions.ts` reste la primitive de contrôle, à appeler directement uniquement pour les cas spéciaux
- **Auto-scoping Prisma** : `createTenantPrisma(societyId)` dans `src/lib/prisma-tenant.ts` existe, mais ne doit pas être considéré comme la protection principale ni branché naïvement partout
- **Propriétaires** : Un utilisateur peut avoir plusieurs entités `Proprietaire` (SCI, SARL, personne physique), chacune regroupant des sociétés. Actions CRUD dans `src/actions/proprietaire.ts`. Migration automatique des sociétés existantes via `migrateOwnerToProprietaire()`.
- **Dashboard multi-propriétaire** : `src/actions/owner.ts` est distinct de `proprietaire.ts` — il expose `OwnerSocietySummary` (agrégats financiers cross-société : lots, revenus, LTV, dette…) pour la vue consolidée du tableau de bord. Ne pas confondre les deux.

**Exceptions runtime assumées** : `src/app/api/storage/view/route.ts` et `src/app/api/storage/signed-upload/route.ts` valident un `societyId` transmis par le chemin ou le payload. Ne pas les refactorer automatiquement vers le pattern "société active" sans revue de sécurité.

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
- **Bannière** : `SubscriptionBanner` (`src/components/layout/subscription-banner.tsx`) affiche les alertes (trial ≤5j, expiration, impayé, dépassement quota)
- **Cron** : `/api/cron/sync-subscriptions` (quotidien 6h30) expire les trials et resynchronise les statuts Stripe

#### Multi-société et quota de plan

`checkSubscriptionActive()` gère le cas où un utilisateur a souscrit UN abonnement couvrant plusieurs sociétés :

1. Si la société cible a un abonnement ACTIVE → OK
2. Sinon, `checkCoveredByOwnerSubscription(societyId)` cherche parmi les autres sociétés administrées par le même utilisateur la meilleure subscription ACTIVE (ENTERPRISE > PRO > STARTER)
3. Si trouvée et quota non dépassé (`maxSocieties`) → retourne `{ active: true, status: "ACTIVE" }`
4. Si quota dépassé → retourne `{ active: false, status: "OVER_LIMIT", message: "Plan X limité à N sociétés…" }` → bannière amber "Passer au plan supérieur"

Le statut `OVER_LIMIT` (non stocké en BDD, calculé dynamiquement) est géré par `/api/subscription/status` et `SubscriptionBanner`.

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
import { requireSocietyActionContext } from "@/lib/action-society";

export async function createEntity(societyId: string, input: Input): Promise<ActionResult<{ id: string }>> {
  try {
    // 1. Contexte auth + société
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    // 2. Validation Zod
    const parsed = createEntitySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map(e => e.message).join(", ") };

    // 3. Opération Prisma
    const result = await prisma.entity.create({ data: { societyId, ...parsed.data } });

    // 4. Audit log
    await createAuditLog({ societyId, userId: context.userId, action: "CREATE", entity: "Entity", entityId: result.id });

    // 5. Revalidation cache
    revalidatePath("/path");
    return { success: true, data: { id: result.id } };
  } catch (error) {
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

**Pattern standard pour les routes API société-scopées** :
```typescript
const context = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
if (context instanceof NextResponse) return context;

// context.societyId
// context.userId
```

Pour les routes API simplement authentifiées, utiliser `requireAuthenticatedRouteContext()` ou `getOptionalAuthenticatedRouteContext()` depuis `src/lib/api-auth.ts`.

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

### Factur-X / CII XML (`src/lib/einvoice-generator.ts`)

Génère des factures électroniques conformes EN 16931 (norme européenne) via **node-zugferd** (profil BASIC) :

- `generateFacturX(pdfBuffer, data)` — embeds le XML CII dans un PDF/A-3b (format Factur-X)
- `generateFacturXml(data)` — génère uniquement le XML CII (pour soumission PA B2B)

Champs obligatoires EN 16931 implémentés :
- **BT-34** (`electronicAddress`) : email vendeur avec scheme `"EM"`, ou SIRET avec scheme `"0009"` en fallback
- **BT-30** (`organization.registrationIdentifier`) : SIRET vendeur, scheme `"0009"` (France)

⚠️ `society.email` est requis pour BT-34. Le formulaire société affiche un avertissement amber si email ou SIRET est absent.

La route `/api/invoices/[id]/facturx` génère le PDF/A-3b (Factur-X) pour téléchargement.
La soumission PA B2B utilise `generateFacturXml()` directement (CII XML, format attendu par Peppol).

### Facturation électronique B2B — Architecture complète

Deux canaux de facturation électronique, indépendants :

#### ① Chorus Pro (B2G — Business to Government)

Pour les entités publiques (État, collectivités, hôpitaux…). Via PISTE OAuth2 + compte technique.

- Client : `src/lib/chorus-pro-client.ts` (`ChorusProClient`)
- Action : `submitInvoiceToChorusPro(societyId, invoiceId)` dans `src/actions/einvoicing.ts`
- Génère un PDF Factur-X puis dépose via `deposerFluxFacture()` (IN_DP_E1_FACTURX)
- Numéro de flux stocké dans `invoice.einvoiceXmlUrl` sous forme `cpro:NUMERO_FLUX`
- Config : `PISTE_CLIENT_ID`, `PISTE_CLIENT_SECRET`, `CHORUS_PRO_TECH_ACCOUNT`, `CHORUS_PRO_TECH_PASSWORD`

#### ② Plateforme Agréée B2B (réforme sept. 2026)

Pour les entreprises privées. Via contrat direct avec une PA certifiée DGFiP (ex. SUPER PDP).

- Client : `src/lib/pa-client.ts` (`PAClient`) — conforme norme AFNOR XP Z12-013, PA-agnostique
- Actions : `submitInvoice()`, `getEInvoiceStatus()`, `syncReceivedInvoices()`, `registerSocietyInPPF()` dans `src/actions/einvoicing.ts`
- Format soumis : **CII XML** (pas PDF) — `format: "CII"`, profil BASIC, norme EN 16931
- flowId stocké dans `invoice.einvoiceXmlUrl` (valeur brute, pas un chemin Storage)
- Bouton "Envoyer PA B2B" sur la page `/facturation/[id]` (composant `SubmitEInvoiceButton`)
- Carte de statut PA (`PaStatusCard`) affichée après soumission avec refresh du statut

**Mode mandataire (Model B — Solution Compatible SC) :**

MyGestia est une **Solution Compatible (SC) certifiée DGFiP** — elle détient UN contrat PA couvrant toutes ses sociétés clientes.

- Activé par `PA_MANDATAIRE_SIRET` = SIRET MTG Holding enregistré auprès de la PA
- À chaque soumission, le client PA envoie :
  - `X-Mandataire-Siret` : SIRET MyGestia (identifiant du SC)
  - `X-Seller-Siret` + `X-Emitter-Siret` : SIRET de la société cliente (vendeur réel)
- `registerSocietyInPPF()` : en mode SC, marque la société comme déclarée sans vérification annuaire PPF individuelle (déclaration gérée par la PA sous le contrat MyGestia)
- UI : `PPFActivationCard` affiche un bandeau bleu "Mode Solution Compatible (SC)" et le bouton "Déclarer à la PA"

**Prérequis contractuel** : MyGestia doit signer un "Contrat Partenaire SC" avec la PA choisie. Sans ce contrat, la PA rejette les soumissions ("L'entreprise liée à la session ne correspond pas au vendeur").

**Authentification PA :**
1. OAuth2 : `PA_AUTH_TOKEN_URL` + `PA_AUTH_CLIENT_ID` + `PA_AUTH_CLIENT_SECRET` (priorité)
2. API Key : `PA_API_KEY` comme Bearer token (fallback)

**Condition d'activation du module PA B2B** : `isEInvoicingConfigured()` = `PA_API_BASE_URL` + au moins un credential (PISTE ou PA propre).

### Stockage fichiers (Supabase Storage)

Les fichiers sont stockés dans Supabase Storage. Les routes `src/app/api/storage/signed-upload/route.ts` et `src/app/api/storage/view/route.ts` gèrent respectivement l'upload signé et la consultation sécurisée des fichiers.

### Fonctionnalités IA

- **Analyse de documents** (`src/lib/document-ai.ts`) : extrait résumé, tags et catégorie via Claude Opus 4.5. 9 catégories : bail, avenant, quittance, facture, diagnostic, assurance, titre_propriete, contrat, etat_des_lieux. Nécessite `ANTHROPIC_API_KEY`.
- **Évaluation patrimoniale** (`src/lib/valuation/ai-service.ts`) : estimation de loyers et de valeur vénale. Utilise Claude (principal), OpenAI et Gemini. Inclut analyse SWOT, comparables, score de confiance, données DVF (Demandes de Valeurs Foncières). Nécessite `ANTHROPIC_API_KEY`.
- **Assistant IA** (`src/lib/ai-chatbot.ts`) : chatbot contextuel avec scope société/immeuble/bail. Répond en langage naturel sur la situation locative, les impayés, l'activité récente. Nécessite `ANTHROPIC_API_KEY`.
- **Génération de courriers IA** (`src/lib/ai-letter-generator.ts`) : rédige des lettres immobilières (relance, résiliation, mise en demeure…) via Claude. Nécessite `ANTHROPIC_API_KEY`.
- **Prédiction comportement locataires** (`src/lib/ai-prediction.ts`) : analyse l'historique des 12 derniers mois pour établir un profil de paiement et anticiper les risques d'impayés. Nécessite `ANTHROPIC_API_KEY`.
- **Relevés de gestion IA** (`src/lib/management-report-ai.ts`) : analyse et résumé des relevés de gestion importés. Nécessite `ANTHROPIC_API_KEY`.

### Rapports (`src/lib/report-generator.ts`, `src/lib/reports/`)

9 types de rapports PDF : `balance-agee`, `compte-rendu-gestion`, `etat-impayes`, `rentabilite-lot`, `recap-charges-locataire`, `situation-locative`, `suivi-mensuel`, `suivi-travaux`, `vacance-locative`.

- Génération PDF avec graphiques (`pdf-charts.ts`, `pdf-core.ts`)
- Rapports consolidés multi-sociétés (`reports/consolidated.ts`)
- Module `/rapports` pour consultation ; `/rapports/planification` pour envoi planifié
- Cron `/api/cron/send-reports` pour envoi automatique

### Open Banking

Trois intégrations bancaires parallèles, toutes optionnelles :

| Service | Lib | Variables | Usage |
|---------|-----|-----------|-------|
| **GoCardless** | `src/lib/gocardless.ts` + `gocardless-sepa.ts` | `GOCARDLESS_SECRET_ID/KEY` | PSD2 Open Banking Europe + SEPA |
| **Powens** (ex-Budget Insight) | `src/lib/powens.ts` | `POWENS_DOMAIN/CLIENT_ID/SECRET` | API bancaire alternative |
| **Qonto** | `src/lib/qonto.ts` | `QONTO_CLIENT_ID/SECRET` | API Qonto (entreprises) |

### Cashflow & Auto-tagging

- **Catégorisation** (`src/actions/cashflow.ts`) : classe les transactions bancaires par catégorie (loyers, charges, travaux…). `aiSuggestCategories()` propose des catégories via IA, `categorizeTransactions()` les enregistre.
- **Auto-tag** (`TransactionAutoTag`) : quand une transaction est catégorisée manuellement, le libellé normalisé est mémorisé pour catégoriser automatiquement les futures transactions identiques. `applyAutoTag()` déclenche l'application. Normalisé via `src/lib/normalize-label.ts`. La table `TransactionAutoTag` peut ne pas exister sur une ancienne DB — le code est résilient (try/catch silencieux).
- **Virements internes** : les virements de compte à compte sont reconnus (`method: "virement"`) dans le rapprochement bancaire.

### Comptabilité avancée

- **Export FEC** (`src/lib/fec-export.ts`) : génère le Fichier des Écritures Comptables au format DGFiP (Article A.47 A-1). Séparateur tabulation, UTF-8, CRLF.
- **Lettrage** (`src/actions/lettering.ts`) : rapprochement des écritures comptables par code de lettrage (`letterEntries()`, `unletterEntries()`).
- **Export RGPD** (`src/lib/rgpd-export.ts`) : export de toutes les données personnelles d'un locataire au format JSON/CSV.

### Signature électronique (ENTERPRISE)

DocuSign (`src/lib/docusign.ts`) — JWT Grant server-to-server. Utilisé pour la signature des baux et avenants. Nécessite les 7 variables `DOCUSIGN_*`.

## Modules métier

Tous les modules sont implémentés dans `src/app/(app)/` avec leur action (`src/actions/`) et validation (`src/validations/`) correspondantes :

| Module | Route | Actions |
|--------|-------|---------|
| Patrimoine (Immeubles, Lots) | `/patrimoine` | `building.ts`, `lot.ts` |
| Diagnostics, Maintenances | `/patrimoine/immeubles/[id]/...` | `diagnostic.ts`, `maintenance.ts` |
| Baux | `/baux` | `lease.ts`, `lease-amendment.ts`, `lease-template.ts` |
| Détail bail (onglets) | `/baux/[id]/` | sous-pages : `inspections/`, `gestion-tiers/`, `releves-gestion/`, `modifier/` |
| Modèles de bail | `/baux/modeles` | `lease-template.ts` |
| Révisions de loyer | `/baux/revisions` | `rent-revision.ts`, `revision-prorata.ts` |
| Locataires | `/locataires` | `tenant.ts` |
| Charges + Catégories | `/charges` | `charge.ts`, `chargeProvision.ts` |
| Facturation + Paiements | `/facturation` | `invoice.ts` (barrel → `invoice-shared.ts`, `invoice-queries.ts`, `invoice-generation.ts`, `invoice-lifecycle.ts`), `payment.ts` |
| Facturation électronique B2B | `/facturation/[id]` | `einvoicing.ts` (bouton "Envoyer PA B2B") |
| Banque + Rapprochement + Cashflow | `/banque` | `bank.ts`, `bank-connection.ts`, `bank-reconciliation.ts`, `cashflow.ts` |
| Comptabilité + Lettrage + FEC | `/comptabilite` | `accounting.ts`, `lettering.ts`, `fec-export.ts` (via API routes) |
| Emprunts + Amortissement | `/emprunts` | `loan.ts` (3 types : AMORTISSABLE, IN_FINE, BULLET) |
| Indices ILC/ILAT/ICC | `/indices` | `insee-index.ts`, via API INSEE |
| Relances | `/relances` | `reminder.ts` |
| Contacts | `/contacts` | `contact.ts` |
| Courriers / Modèles de lettres | `/courriers` | `letter-template.ts`, `letter-template-email.ts` |
| Candidatures (pipeline locataires) | `/candidatures` | `candidate.ts` |
| Location saisonnière | `/saisonnier` | `seasonal.ts` |
| Copropriété | `/copropriete` | `copropriete.ts` |
| Tickets (portail + interne) | `/tickets` | `ticket.ts` |
| Workflows (automatisation) | `/workflows` | `workflow.ts` |
| Relevés de gestion tiers | `/baux/[id]/releves-gestion` | `management-report.ts` |
| RGPD | `/rgpd` | `rgpd-export.ts`, via API routes |
| Documents | `/documents` | `document.ts` |
| Dataroom | `/dataroom` | `dataroom.ts` |
| Signatures | — | `signature.ts` |
| SEPA | — | `sepa.ts` |
| Notifications | — | `notifications.ts` |
| Import données | `/import` | `import.ts`, `import-parser.ts` |
| Fusion entités | `/administration/fusions` | `merge.ts` |
| Administration | `/administration/...` | `user.ts`, `auth.ts` |
| Dashboard + Analytiques | `/dashboard` | `dashboard.ts`, `analytics.ts` |
| Propriétaires | `/proprietaire` | `proprietaire.ts` |
| Abonnements | `/compte/abonnement` | `subscription.ts` |
| Évaluations patrimoine | `/patrimoine/evaluations` | `valuation.ts`, `rent-valuation.ts` |
| Rapports | `/rapports`, `/rapports/planification` | `report-generator.ts`, `report-schedule.ts` |
| Assistant IA | `/assistant` | `ai-chatbot.ts` |
| Paramètres facturation | `/parametres/facturation` | `einvoicing.ts` (PPFActivationCard, ChorusProCard) |

## Cron Jobs (Vercel)

Définis dans `vercel.json`, protégés par `CRON_SECRET` :

| Job | Schedule | Description |
|-----|----------|-------------|
| `/api/cron/ai-retry` | Toutes les heures | Relance analyse IA des documents en erreur |
| `/api/cron/generate-drafts` | Quotidien 7h | Génération auto brouillons factures |
| `/api/cron/insurance-reminder` | Lundi 9h | Rappels assurances |
| `/api/cron/invoice-reminder` | Lundi 8h | Relances factures impayées |
| `/api/cron/lease-alerts` | Quotidien 9h30 | Alertes baux et diagnostics à échéance |
| `/api/cron/rent-revisions` | 1er du mois 8h | Révisions de loyer |
| `/api/cron/run-workflows` | Quotidien 2h | Exécution des workflows planifiés |
| `/api/cron/send-reports` | Quotidien 8h | Envoi rapports planifiés |
| `/api/cron/sync-bank` | Quotidien 6h | Synchronisation transactions bancaires |
| `/api/cron/sync-einvoices` | Toutes les heures | Sync factures électroniques reçues (PA B2B) |
| `/api/cron/sync-indices` | 1er du mois 7h | MAJ indices INSEE |
| `/api/cron/sync-subscriptions` | Quotidien 6h30 | Expiration trials + sync statuts Stripe |

## Monitoring (Sentry)

Configuré dans `sentry.*.config.ts` et `instrumentation.ts`. Actif uniquement en production (10% traces).

## Git Hooks

**Husky + lint-staged** : à chaque commit, ESLint `--fix` est lancé sur les fichiers `.ts`/`.tsx` stagés. `.npmrc` a `legacy-peer-deps=true` pour la compatibilité des dépendances.

## Tests (Vitest)

Configuration dans `vitest.config.ts`. Setup file : `src/test/setup.ts`. Couverture sur `src/lib/**`, `src/actions/**`, `src/validations/**`.

### Infrastructure de test

Le setup global (`src/test/setup.ts`) mock automatiquement :
- `@/lib/auth` → `auth()` retourne `null` (non authentifié par défaut)
- `@/lib/prisma` → `prismaMock` (deep mock via `vitest-mock-extended`)
- `@/lib/prisma-tenant` → `createTenantPrisma()` retourne `prismaMock`
- `@/lib/plan-limits` → toutes les vérifications passent par défaut

**Helpers** (`src/test/helpers.ts`) :
- `mockAuthSession(role?, societyId?)` — simule un utilisateur authentifié avec rôle et membership
- `mockUnauthenticated()` — reset l'auth à `null`

**Factories** (`src/test/factories.ts`) :
- `buildUser(overrides?)`, `buildSociety(overrides?)`, `buildMembership(role?, overrides?)`
- `buildTenantPhysique(overrides?)`, `buildInvoice(overrides?)`

**Mock Prisma** (`src/test/mocks/prisma.ts`) :
- `prismaMock` — deep mock de `PrismaClient`, reset avant chaque test via `beforeEach`

### Patterns de test

**⚠️ Hoisting `vi.mock()`** : Vitest hisse les appels `vi.mock()` en tête de fichier à la compilation. Les placer **avant** les imports qui utilisent ces modules, sinon le mock n'est pas appliqué.

Mocks quasi-universels à ajouter dans chaque fichier de test d'action :

```typescript
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

// Puis les imports
import { maFonction } from "./mon-action";
```

`mockAuthSession()` mock aussi `subscription.findUnique` avec un abonnement PRO ACTIVE, ce qui permet à `checkSubscriptionActive()` de passer sans configuration supplémentaire.

Pour mocker une dépendance avec des classes ou des modules complexes (ex. ExcelJS), utiliser `vi.hoisted()` :

```typescript
const myMocks = vi.hoisted(() => ({
  writeBuffer: vi.fn().mockResolvedValue(new Uint8Array()),
}));
vi.mock("exceljs", () => ({ default: { Workbook: vi.fn(() => myMocks) } }));
```

## CI (GitHub Actions)

Pipeline `.github/workflows/ci.yml` sur push/PR vers `main` :

1. **Lint & Type Check** : `npm run lint` + `npx tsc --noEmit`
2. **Unit Tests** : `npm run test:coverage` (upload artifact `coverage-report`)
3. **E2E Tests** : `npx playwright test` (upload artifact `playwright-report`)
4. **Build** : `npm run build` (après quality + tests)

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
- Les avenants de bail sont dans `lease-amendment.ts` (séparé de `lease.ts`)
- Les paliers de loyer (`RentStep`) sont dans `lease.ts` : `createRentSteps()`, `updateRentStep()`, `deleteRentStep()`
- La gestion des tiers (sous-baux, mandats) est dans la sous-page `/baux/[id]/gestion-tiers`
- La société doit avoir un **SIRET** et un **email** pour émettre des factures électroniques (BT-30 + BT-34 EN 16931)

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
