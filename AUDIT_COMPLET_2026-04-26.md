# Audit complet MyGestia - 26 avril 2026

Application auditée : `mygestia` dans `c:\Users\Maxime Langet\Mon Drive\Application gestion immobiliere`  
Périmètre : code source local, configuration, Prisma, tests, CI, dépendances npm et documentation présente dans le dépôt.  
Limites : pas d'accès aux consoles Supabase/Vercel/Sentry, aux bases de production, aux contrats DPA réellement signés, aux sauvegardes effectives ni aux journaux de production. Les constats hors dépôt sont donc marqués "à vérifier".

## Cartographie du projet

### Stack et structure

- Framework : Next.js `16.2.4` App Router, React `19.2.4`, TypeScript strict après corrections.
- Auth : NextAuth `5.0.0-beta.31`, credentials, OAuth, 2FA, lockout applicatif après corrections.
- ORM : Prisma `7.6.0`, client généré dans `src/generated/prisma/client`.
- Base / fichiers : Supabase PostgreSQL + Storage, Redis Upstash en option, Sentry, Resend, Stripe, GoCardless, DocuSign.
- Arborescence principale : `src/app`, `src/actions`, `src/lib`, `src/components`, `src/validations`, `prisma`, `docs`, `e2e`, `.github/workflows`.
- Modules fonctionnels repérés : sociétés multi-tenant, patrimoine, lots, baux, locataires, facturation, paiements, banque, factures fournisseurs, comptabilité, FEC, documents, dataroom, signatures, relances, RGPD, onboarding, assistant IA, API publique.

### Commandes exécutées

- Exploration : `Get-ChildItem -Force`, `rg --files`, lectures ciblées de `CLAUDE.md`, `package.json`, `prisma/schema.prisma`, `next.config.ts`, `src/proxy.ts`.
- Sécurité : recherches `rg` sur RLS, secrets, raw SQL, webhooks, uploads, SSRF, suppression, CSP, cookies.
- Qualité : `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:coverage`.
- Dépendances : `npm audit --omit=dev --json`, `npm outdated --json`.
- Git : vérification que `.env`, `.env.local`, `.env.sentry-build-plugin` ne sont pas historisés ; `git status --short` était propre avant création de ce rapport.

### Résultats rapides de vérification

- `npm run lint` : OK.
- `npx tsc --noEmit` : OK.
- `npm test` : échec, 6 tests en timeout sur 4 254 tests exécutés.
- `npm run test:coverage` : échec, 7 tests en timeout ; la couverture courante n'est donc pas validée.
- `npm audit --omit=dev` : 13 vulnérabilités prod, dont 3 hautes.

### Note de correction - 26 avril 2026

Un premier lot de corrections a été appliqué après cet audit :

- F-001 : le proxy TUS refuse désormais toute URL hors origine Supabase configurée et tout chemin hors `/storage/v1/upload/resumable`.
- F-002 : le webhook email entrant exige désormais une signature Svix/Resend via `RESEND_WEBHOOK_SECRET` et ajoute une idempotence applicative par référence déterministe.
- F-004 : les configs Sentry server/edge n'ont plus de DSN codé en dur, désactivent `sendDefaultPii`, désactivent l'envoi de logs et réduisent le sampling.
- F-008 : les formats actifs comme SVG/HTML/XML sont forcés en téléchargement avec `nosniff`.
- F-009 : Next.js, NextAuth, Sentry, Resend et Anthropic SDK ont été mis à jour ; `defu` et `picomatch` sont forcés via `overrides`. `npm audit --omit=dev` ne remonte plus de vulnérabilité haute ou critique, mais conserve 9 modérées à arbitrer.
- F-011 : inscription et réinitialisation utilisent la même politique de mot de passe fort ; les codes de confirmation utilisent `crypto.randomInt`.
- F-012 : `computeTenantBalance` vérifie désormais l'accès société côté serveur.
- Qualité : `npm run lint`, `npx tsc --noEmit` et `npm test` passent après correction.

---

## Tableau récapitulatif des findings

| ID | Section | Criticité | Titre | Effort | Impact |
|---|---|---:|---|---:|---|
| F-001 | Sécurité | 🔴 Critique | SSRF avec exfiltration de la clé Supabase service role dans le proxy TUS | M | Compromission totale du stockage et potentiellement des données |
| F-002 | Sécurité | 🔴 Critique | Webhook email entrant sans vérification de signature | M | Création frauduleuse de factures/documents, pollution comptable |
| F-003 | Sécurité / Multi-tenant | 🟠 Élevée | Aucune preuve de RLS PostgreSQL/Supabase dans le dépôt | L | Absence de défense en profondeur contre fuite inter-tenants |
| F-004 | RGPD / Observabilité | 🟠 Élevée | Sentry server/edge envoie la PII, DSN codé en dur, tracing à 100% | S | Exposition de données personnelles et financières à un tiers |
| F-005 | Architecture | 🟠 Élevée | Pas de dossier `prisma/migrations` versionné | L | Schéma non reproductible, dérive prod/staging, rollback fragile |
| F-006 | RGPD / Données | 🟠 Élevée | Suppressions physiques malgré la règle projet de soft delete | L | Perte de traçabilité, restauration impossible, risque légal |
| F-007 | Sécurité fichiers | 🟠 Élevée | Pipeline upload incohérent, validations magic bytes contournables | M | Upload de contenu dangereux ou non conforme |
| F-008 | Sécurité fichiers | 🟠 Élevée | SVG servi inline depuis stockage privé et route sans CSP | S | XSS / exécution active via document uploadé |
| F-009 | Dépendances | 🟠 Élevée | Vulnérabilités npm prod, dont Next.js vulnérable | S | DoS, prototype pollution, risques supply chain |
| F-010 | Qualité | 🟠 Élevée | Suite de tests unitaires/couverture actuellement rouge | M | Régressions non détectées, CI bloquante ou ignorée |
| F-011 | Auth | 🟠 Élevée | Politique mot de passe/réinitialisation incohérente et codes faibles | M | Brute force, comptes plus faciles à compromettre |
| F-012 | Sécurité / IDOR | 🟠 Élevée | Helper serveur exporté sans vérification d'accès | S | Fuite possible de solde locataire si appelé depuis client |
| F-013 | Performance | 🟡 Moyenne | Listes principales non paginées | M | Dégradation avec 50 sociétés / 2 000 baux |
| F-014 | RGPD | 🟠 Élevée | Durées de conservation documentées mais purge non automatisée | L | Non-conformité RGPD et accumulation de données |
| F-015 | CI/CD | 🟡 Moyenne | Le build CI ne dépend pas des E2E ; Vercel installe avec `--force` | S | Déploiement malgré régression parcours, dépendances forcées |
| F-016 | Sécurité | 🟠 Élevée | Routes publiques contournent le rate limiting proxy | M | Abus sur webhooks, cron, API publiques si pas protégé localement |
| F-017 | Métier | 🟠 Élevée | Indexation des loyers sans plafonnement ni règles juridiques avancées | M | Révisions erronées, contestations locataires |
| F-018 | Métier | 🟡 Moyenne | Cas structurants du bail commercial non modélisés en workflow | L | Gestion hors outil, rupture d'audit trail |
| F-019 | Comptabilité | 🟡 Moyenne | Comptabilité riche mais clôture/immutabilité/prorata TVA non prouvés | L | Risque fiscal et exports incomplets |
| F-020 | RGPD | 🟡 Moyenne | Consentement cookies non appliqué aux analytics globaux | M | Dépôt/mesure avant consentement potentiel |
| F-021 | Résilience | 🟠 Élevée | Pas de runbook PRA/RTO/RPO ni preuve de test restauration | M | Reprise d'activité incertaine |
| F-022 | Documentation | 🟡 Moyenne | README obsolète create-next-app | S | Onboarding développeur fragile |
| F-023 | Configuration | 🟡 Moyenne | Usage direct de `process.env` malgré module `env` | M | Validation incomplète, erreurs runtime |
| F-024 | UX / Accessibilité | 🟡 Moyenne | Tests UI en timeout et audit Lighthouse/WCAG non mesuré | M | Parcours potentiellement cassés sans signal fiable |

---

## 1. Audit métier et fonctionnel

### F-003 - Isolation multi-tenant sans RLS vérifiable

Criticité : 🟠 Élevée  
Localisation : `prisma/schema.prisma`, recherches `rg "ENABLE ROW LEVEL SECURITY|CREATE POLICY|RLS"` sans résultat pertinent.  
Description : le modèle porte bien des `societyId` et de nombreux helpers applicatifs exigent un contexte société, mais aucune politique RLS Supabase/PostgreSQL versionnée n'est présente.  
Impact : une erreur applicative, une clé exposée, une route Storage/API mal bornée ou un accès SQL direct peut contourner l'isolation logique.  
Recommandation : ajouter des migrations SQL versionnées qui activent RLS sur toutes les tables sensibles et des tests d'accès inter-tenants.

Exemple attendu :

```sql
ALTER TABLE "Lease" ENABLE ROW LEVEL SECURITY;
CREATE POLICY lease_same_society ON "Lease"
  USING ("societyId" = current_setting('app.society_id', true));
```

Effort : L.

### F-017 - Indexation des loyers juridiquement incomplète

Criticité : 🟠 Élevée  
Localisation : `src/actions/rent-revision.ts:20-27`.  
Extrait :

```ts
const newRent = currentRentHT * (newIndexValue / baseIndexValue);
return Math.round(newRent * 100) / 100;
```

Description : le calcul applique la formule d'indexation brute. Le code ne montre pas de plafonnement, de cas clause illicite, de gestion de périodicité contractuelle complexe, de neutralisation d'indices ou d'exception sectorielle.  
Impact : un gestionnaire peut générer une révision juridiquement contestable, avec impact financier et relation locataire.  
Recommandation : introduire un moteur de règles d'indexation par type de bail, indice, clause, périodicité et date d'exigibilité ; journaliser la formule et les sources INSEE utilisées.  
Effort : M.

### F-018 - Workflows incomplets pour le cycle de vie du bail commercial

Criticité : 🟡 Moyenne  
Localisation : recherches `rg "cession|congé|déspécialisation|éviction|huissier|commandement" src prisma docs CLAUDE.md`.  
Description : le dépôt contient des modèles de courrier et de l'aide pour les congés, mais pas de workflow structuré ni d'entités métier pour cession de bail, déspécialisation, sous-location autorisée, indemnité d'éviction, commandement de payer, acte d'huissier, renouvellement contesté.  
Impact : ces événements majeurs restent traités hors outil, ce qui affaiblit la traçabilité et le reporting propriétaire.  
Recommandation : créer un module "Événements juridiques du bail" avec statuts, échéances, documents, validation et audit log.  
Effort : L.

### F-019 - Comptabilité partielle à consolider avant usage fiscal

Criticité : 🟡 Moyenne  
Localisation : `src/lib/fec-export.ts`, modèles comptables dans `prisma/schema.prisma`, absence de preuve de clôture immuable lors de l'audit.  
Description : le projet comporte plan comptable, écritures et FEC, mais l'audit local ne prouve pas la clôture d'exercice, l'immutabilité des écritures validées, la numérotation sans trou, le prorata TVA ou la séparation stricte des journaux.  
Impact : risque d'exports comptables non recevables ou de corrections postérieures non tracées.  
Recommandation : verrouiller les périodes clôturées, rendre les écritures validées append-only, tester le FEC sur cas réels et documenter le périmètre fiscal couvert.  
Effort : L.

### Points forts métier

- Large couverture fonctionnelle : patrimoine, baux, factures, paiements, relances, banque, documents, dataroom, signatures, FEC, RGPD.
- Types de baux nombreux, dont commercial 3/6/9, dérogatoire, précaire, professionnel.
- Présence de relances scénarisées et de modèles de courriers.

---

## 2. Audit architecture technique

### F-005 - Migrations Prisma non versionnées

Criticité : 🟠 Élevée  
Localisation : dossier `prisma/` contenant `schema.prisma` et des fichiers `migration-*.sql`, mais aucun `prisma/migrations`.  
Description : le schéma Prisma est très riche, mais l'historique de migration standard n'est pas versionné.  
Impact : impossible de reconstruire de manière fiable un environnement, d'auditer l'évolution du schéma ou de rollback proprement.  
Recommandation : baseliner la base actuelle avec Prisma Migrate, déplacer les scripts ad hoc dans des migrations datées, interdire `db push` en prod.  
Effort : L.

### F-023 - Configuration environnement incohérente

Criticité : 🟡 Moyenne  
Localisation : `src/lib/env.ts` existe, mais usages directs observés dans `src/actions/document.ts:118`, `src/app/api/storage/signed-upload/route.ts:75`, routes webhooks, Sentry.  
Description : `CLAUDE.md` demande d'utiliser le module `env`, mais plusieurs modules lisent encore directement `process.env`.  
Impact : validation incomplète, divergences dev/prod, secrets optionnels au mauvais endroit.  
Recommandation : remplacer les accès directs par `env`, rendre obligatoires les secrets critiques en production et ajouter un test statique `rg "process.env"` avec allowlist.  
Effort : M.

### Dette technique observée

- `README.md` obsolète.
- Migrations manuelles SQL.
- Plusieurs routes storage utilisent la service role key directement.
- Certaines garanties de conformité sont documentées dans les pages d'aide mais non alignées avec le code, par exemple la suppression logique.

---

## 3. Audit sécurité

### F-001 - SSRF critique dans le proxy TUS

Criticité : 🔴 Critique  
Localisation : `src/app/api/storage/tus-patch/route.ts:11-29`.  
Extrait :

```ts
const tusUrl = req.headers.get("x-tus-url");
const patchRes = await fetch(tusUrl, {
  headers: {
    Authorization: `Bearer ${serviceKey}`,
```

Description : l'URL cible du `fetch` serveur est fournie par l'utilisateur via `x-tus-url`. La route ajoute ensuite la clé `SUPABASE_SERVICE_ROLE_KEY` dans l'en-tête `Authorization`.  
Impact : un utilisateur authentifié peut faire envoyer la clé service role vers un serveur contrôlé par lui. C'est une compromission majeure du stockage Supabase et potentiellement de toutes les données accessibles avec cette clé.  
Recommandation : supprimer cette route ou ne jamais relayer vers une URL utilisateur. Stocker côté serveur un identifiant d'upload opaque, valider strictement l'origine Supabase et le chemin `/storage/v1/upload/resumable`, lier l'upload au `userId` et `societyId`, et ne jamais envoyer la service role key à une URL non construite par le serveur.  
Effort : M.

### F-002 - Webhook email entrant sans signature

Criticité : 🔴 Critique  
Localisation : `src/app/api/webhooks/email-inbound/route.ts:43-67`, `:124-149`, `:209-211`.  
Extrait :

```ts
const rawBody = await request.text();
event = JSON.parse(rawBody) as ResendEmailReceivedEvent;
...
const config = await prisma.supplierInboxConfig.findFirst({
```

Description : la route accepte un JSON public, ne vérifie pas de signature et crée des factures fournisseurs après téléchargement d'une pièce jointe. En comparaison, Stripe, GoCardless et DocuSign ont une vérification de signature.  
Impact : un attaquant peut simuler des emails entrants vers une boîte connue, créer des documents et polluer la comptabilité fournisseur.  
Recommandation : vérifier la signature Resend/Svix avant parsing métier, stocker l'ID d'événement, rendre le traitement idempotent, refuser les événements invalides avec `401/400`, limiter taille et nombre de pièces jointes.  
Effort : M.

### F-007 - Uploads contournables

Criticité : 🟠 Élevée  
Localisation : `src/app/api/storage/signed-upload/route.ts:39-43`, `:91-111`; `src/app/api/documents/upload/route.ts` vérifie les magic bytes, mais les routes directes/TUS ne le font pas.  
Extrait :

```ts
const { filename, contentType, societyId, entityFolder } = await req.json();
...
createSignedUploadUrl(storagePath);
```

Description : une route upload classique valide le contenu, mais les uploads signés/TUS s'appuient surtout sur métadonnées, nom et content-type déclarés.  
Impact : possibilité d'introduire un fichier non conforme, dangereux ou fiscalement inexploitable dans un espace documentaire privé.  
Recommandation : centraliser la validation : allowlist MIME, taille maximale, inspection serveur post-upload, quarantaine avant enregistrement, blocage SVG/HTML/XML, antivirus si cible commerciale.  
Effort : M.

### F-008 - SVG inline et CSP désactivée sur storage/view

Criticité : 🟠 Élevée  
Localisation : `src/app/api/storage/view/route.ts:119-129`, `src/proxy.ts:144-147`.  
Extrait :

```ts
svg: "image/svg+xml",
...
const isBinaryRoute = pathname.startsWith("/api/storage/view")
```

Description : les SVG peuvent être servis inline depuis le stockage privé, et le proxy exclut `/api/storage/view` de la CSP.  
Impact : si un SVG actif est uploadé, il peut devenir vecteur XSS ou exfiltration dans le navigateur.  
Recommandation : forcer `Content-Disposition: attachment` pour SVG/HTML/XML, supprimer `image/svg+xml` de l'affichage inline, ajouter une CSP restrictive même sur les routes binaires lorsque possible.  
Effort : S.

### F-011 - Politique auth incohérente

Criticité : 🟠 Élevée  
Localisation : `src/validations/auth.ts` impose une politique forte, mais `src/actions/confirm-signup.ts` et `src/app/api/auth/reset-password/route.ts` acceptent des mots de passe plus faibles ; génération de codes via `Math.random()` observée dans inscription.  
Description : les règles de mot de passe ne sont pas uniformes et les codes de confirmation ne sont pas générés avec un générateur cryptographique dans tous les chemins.  
Impact : surface brute force accrue sur création/réinitialisation de compte.  
Recommandation : utiliser un schéma unique `strongPasswordSchema`, générer les codes via `crypto.randomInt`, hacher les codes en base, ajouter compteur d'essais/lockout et rate limiting distribué.  
Effort : M.

### F-012 - Helper serveur sans contrôle d'accès

Criticité : 🟠 Élevée  
Localisation : `src/actions/tenant.ts:37-64`.  
Extrait :

```ts
export async function computeTenantBalance(societyId: string, tenantId: string) {
  const invoices = await prisma.invoice.findMany({ where: { societyId, tenantId } });
```

Description : dans un fichier `"use server"`, la fonction exportée calcule un solde depuis des IDs fournis sans appeler `requireSocietyActionContext`.  
Impact : si la fonction est importée dans un composant client ou exposée indirectement, elle devient un point IDOR.  
Recommandation : la rendre privée ou ajouter une garde serveur au début.  
Effort : S.

### F-016 - Rate limiting proxy contourné par les routes publiques

Criticité : 🟠 Élevée  
Localisation : `src/proxy.ts`, routes publiques incluant `/api/webhooks`, `/api/cron`, `/api/auth`, `/api/public`; bloc rate limit placé après le retour des routes publiques.  
Description : les routes publiques ne bénéficient pas du rate limiting générique du proxy et doivent toutes se protéger elles-mêmes.  
Impact : exposition aux abus si une route publique oublie sa signature, son secret ou sa limite, comme le webhook email entrant.  
Recommandation : appliquer un rate limit minimal avant le bypass public, puis laisser des règles spécialisées par route sensible.  
Effort : M.

### F-009 - Dépendances vulnérables

Criticité : 🟠 Élevée  
Localisation : `package.json`, `package-lock.json`, résultat `npm audit --omit=dev`.  
Description : 13 vulnérabilités prod : Next.js `<16.2.3`, `defu`, `picomatch`, `@anthropic-ai/sdk`, `next-auth` beta, `fast-xml-parser`, `uuid`, etc.  
Impact : DoS, prototype pollution, failles supply chain et correctifs de sécurité manquants.  
Recommandation : mettre à jour Next `16.2.4+`, NextAuth beta corrigée, Anthropic SDK, Resend/Svix, auditer `node-zugferd` car une vulnérabilité transitive n'a pas de correctif automatique.  
Effort : S à M.

---

## 4. Audit conformité RGPD

### F-004 - Sentry collecte PII et traces serveur à 100%

Criticité : 🟠 Élevée  
Localisation : `sentry.server.config.ts:8-18`, `sentry.edge.config.ts:9-19`.  
Extrait :

```ts
dsn: "https://...@o4511207272808448.ingest.de.sentry.io/...",
tracesSampleRate: 1,
sendDefaultPii: true,
```

Description : les configs server et edge codent le DSN en dur, activent logs, traces à 100% et envoi de PII.  
Impact : exposition potentielle de données personnelles, bancaires ou locatives dans un outil tiers, avec surcollecte.  
Recommandation : DSN via `env`, `enabled` uniquement selon environnement, sampling faible, `sendDefaultPii: false`, scrubber explicite des champs locataire, banque, document, facture.  
Effort : S.

### F-006 - Suppressions physiques contraires à la règle projet

Criticité : 🟠 Élevée  
Localisation : `CLAUDE.md` impose le soft delete ; suppressions physiques dans `src/actions/document.ts:125`, `src/actions/lease.ts:269`, `src/actions/tenant.ts:720-727`.  
Extraits :

```ts
await prisma.document.delete({ where: { id: documentId } });
await prisma.lease.delete({ where: { id: leaseId } });
prisma.tenant.delete({ where: { id: tenantId } });
```

Description : des entités sensibles sont physiquement supprimées. Les pages d'aide promettent même une restauration, mais le code détruit réellement certaines données.  
Impact : perte d'audit trail, impossibilité de restauration, conflit avec conservation comptable, contestation ou exercice de droits.  
Recommandation : ajouter `deletedAt`, `deletedBy`, `archivedReason`, filtrer par défaut, séparer suppression logique, anonymisation RGPD et purge légale.  
Effort : L.

### F-014 - Conservation RGPD non automatisée

Criticité : 🟠 Élevée  
Localisation : recherche `rg "retention|conservation|purge"` : documentation présente, mais pas de job de purge métier trouvé.  
Description : les durées de conservation sont documentées dans les pages légales/aide, mais l'audit local ne trouve pas d'automatisation de purge/anonymisation.  
Impact : conservation excessive de données personnelles, risque CNIL et coût de stockage.  
Recommandation : implémenter des jobs de rétention par catégorie : prospects, candidats, locataires sortis, documents fiscaux, logs, consentements ; produire un rapport d'exécution.  
Effort : L.

### F-020 - Analytics chargés avant consentement global

Criticité : 🟡 Moyenne  
Localisation : `src/app/layout.tsx:84-85`, `src/components/landing/cookie-banner.tsx:18-24`.  
Extrait :

```tsx
<Analytics />
<SpeedInsights />
```

Description : le bandeau cookies existe sur la landing page, mais Vercel Analytics et Speed Insights sont montés dans le layout racine sans condition visible sur le consentement.  
Impact : risque de mesure avant consentement, selon qualification CNIL des traceurs utilisés et configuration Vercel.  
Recommandation : conditionner les traceurs non strictement nécessaires au consentement, documenter les cookies/traceurs et permettre le retrait.  
Effort : M.

### Éléments RGPD positifs

- Pages légales présentes : confidentialité, DPA, CGU/CGV, mentions légales, sécurité.
- Modèles Prisma dédiés : `DataProcessingRecord`, `GdprRequest`, `Consent`.
- Export RGPD implémenté et testé dans `src/lib/rgpd-export.ts`.

---

## 5. Audit ergonomie et UX

### F-024 - UX testée mais signaux instables

Criticité : 🟡 Moyenne  
Localisation : échecs tests `global-search`, `mobile-sidebar`, empty states, documents client.  
Description : des tests UI importants timeoutent. Cela ne prouve pas que l'interface est cassée en production, mais prouve que le filet de sécurité UX est instable.  
Impact : régressions de navigation, recherche globale, empty states ou sidebar mobile moins détectables.  
Recommandation : stabiliser les tests avec timers/mocks explicites, vérifier au navigateur les parcours critiques, intégrer Lighthouse/axe sur dashboard, baux, factures, documents.  
Effort : M.

Observations :

- Onboarding, checklist, welcome screen et aide sont présents.
- Les formats français et libellés français sont largement utilisés.
- Aucun audit Lighthouse/Web Vitals n'a été mesuré pendant cet audit ; il faut lancer une campagne hors Google Drive ou dans un environnement de test stable.

---

## 6. Audit performance

### F-013 - Listes non paginées

Criticité : 🟡 Moyenne  
Localisation : `src/actions/invoice-queries.ts:6-38`, `src/actions/lease.ts:303-342`, `src/actions/tenant.ts:478-504`, `src/actions/building.ts:204-244`.  
Extrait :

```ts
return prisma.lease.findMany({
  where: { societyId },
  include: { ... },
  orderBy: [{ status: "asc" }, { startDate: "desc" }],
});
```

Description : plusieurs listes métier chargent tous les enregistrements d'une société avec relations.  
Impact : à 2 000 baux, 10 utilisateurs simultanés et historique de factures, latence, mémoire serveur et taille de payload vont augmenter fortement.  
Recommandation : pagination `take/skip` ou cursor, filtres côté serveur, `select` minimal, compte séparé, index composites sur colonnes filtrées.  
Effort : M.

Autres points :

- Les PDF et imports lourds devraient être mis en queue pour les gros volumes.
- Les index Prisma existent sur de nombreuses colonnes, mais les requêtes réelles doivent être validées avec `EXPLAIN ANALYZE` en staging.
- Pas de mesure Lighthouse réalisée dans ce passage.

---

## 7. Audit qualité du code et tests

### F-010 - Tests rouges

Criticité : 🟠 Élevée  
Localisation : sortie `npm test` et `npm run test:coverage`.  
Description : lint et TypeScript passent, mais la suite de tests échoue sur plusieurs timeouts.  
Impact : la CI ne donne pas un signal vert fiable ; la couverture actuelle ne peut pas être validée.  
Recommandation : corriger les tests instables avant tout gros refactoring, puis imposer `npm test` et `test:coverage` en pré-merge.  
Effort : M.

Échecs observés :

- `src/components/global-search.test.tsx`
- `src/lib/invoice-pdf.render.test.tsx`
- `src/components/layout/mobile-sidebar.test.tsx`
- Plusieurs empty states et clients UI selon la commande.

### F-015 - CI/CD perfectible

Criticité : 🟡 Moyenne  
Localisation : `.github/workflows/ci.yml:48-90`, `vercel.json:3`.  
Extrait :

```yaml
build:
  needs: [quality, test]
```

```json
"installCommand": "npm install --legacy-peer-deps --force"
```

Description : le build ne dépend pas du job E2E, et Vercel installe avec `--force`.  
Impact : une régression E2E peut ne pas bloquer le build ; `--force` peut masquer un conflit de dépendances.  
Recommandation : faire dépendre le build/deploy des E2E critiques, remplacer `npm install --force` par `npm ci` après résolution des peers.  
Effort : S.

---

## 8. Audit documentation

### F-022 - README obsolète

Criticité : 🟡 Moyenne  
Localisation : `README.md`.  
Description : le README est le texte par défaut create-next-app, alors que `CLAUDE.md` est riche et spécifique.  
Impact : onboarding développeur et exploitation fragiles ; les bonnes pratiques restent cachées dans un fichier agent.  
Recommandation : créer un README d'exploitation : setup, env vars, DB, migrations, tests, déploiement, sécurité, procédures d'urgence.  
Effort : S.

Éléments positifs :

- `CLAUDE.md` est détaillé.
- Une API OpenAPI existe : `src/lib/openapi.ts`, route `src/app/api/v1/openapi/route.ts`, page `src/app/(app)/api-docs/page.tsx`.
- Pages légales et aide utilisateur nombreuses.

---

## 9. Audit résilience et continuité

### F-021 - PRA/RTO/RPO et restauration non prouvés

Criticité : 🟠 Élevée  
Localisation : `src/app/dpa/page.tsx:162` mentionne des sauvegardes quotidiennes Supabase ; aucune procédure de restauration ou runbook opérationnel trouvé dans `docs`, `README.md`, `.github`.  
Description : la documentation publique affirme des sauvegardes, mais le dépôt ne contient pas de procédure testée de restauration, RTO/RPO, rollback, incident, ou exercice récent.  
Impact : en cas de perte de données, corruption migration ou incident Supabase, l'équipe ne dispose pas d'un protocole prouvé.  
Recommandation : rédiger et tester un runbook : fréquence, rétention, restauration staging mensuelle, rôles, contacts, RTO/RPO, exercice chronométré, rollback applicatif.  
Effort : M.

Autres observations :

- Plusieurs crons Vercel sont déclarés dans `vercel.json`.
- Les intégrations tierces existent, mais leur dégradation gracieuse et leur circuit breaker doivent être testés en staging.

---

## 10. Audit financier et opérationnel

Constat : le dépôt ne contient pas de modèle de coût infrastructure ni de simulation de charge. Stripe est présent, mais l'audit local n'a pas validé un modèle de facturation SaaS complet et sécurisé.

Risques :

- Sans pagination, RLS, jobs de fond et queue PDF/imports, le coût Vercel/Supabase peut croître rapidement avec l'historique.
- Les traces Sentry à 100% peuvent aussi générer du coût et de la donnée personnelle inutile.
- Le stockage documentaire sans purge augmente le coût et le risque RGPD.

Recommandations :

- Établir trois scénarios : 10 / 50 / 200 sociétés, 500 / 2 000 / 20 000 baux, volume PDF mensuel, imports, emails, requêtes dashboard.
- Mesurer requêtes DB lentes, taille Storage, coûts logs/traces, limites Vercel Functions.
- Définir des seuils de plan et alertes coût.

Effort : M.

---

## Top 10 risques à corriger en priorité

1. 🔴 Supprimer ou sécuriser immédiatement `src/app/api/storage/tus-patch/route.ts` pour empêcher l'exfiltration de `SUPABASE_SERVICE_ROLE_KEY`.
2. 🔴 Ajouter la vérification de signature et l'idempotence du webhook `email-inbound`.
3. 🟠 Désactiver `sendDefaultPii`, sortir le DSN Sentry du code et réduire le tracing serveur.
4. 🟠 Mettre à jour les dépendances vulnérables, surtout Next.js, NextAuth et SDKs.
5. 🟠 Ajouter RLS/policies Supabase versionnées et testées.
6. 🟠 Remplacer les suppressions physiques par du soft delete sur locataires, baux, documents.
7. 🟠 Fermer les contournements d'upload, bloquer SVG inline et inspecter les fichiers post-upload.
8. 🟠 Corriger les tests rouges et rendre la couverture exploitable.
9. 🟠 Automatiser la rétention/purge RGPD.
10. 🟠 Documenter et tester restauration/PRA/RTO/RPO.

---

## Feuille de route priorisée

### Court terme - moins d'un mois

- Corriger F-001 et F-002 avant toute mise en production.
- Couper PII Sentry et DSN codé en dur.
- Mettre à jour Next.js et dépendances vulnérables.
- Bloquer SVG/HTML/XML inline dans Storage.
- Ajouter garde d'accès sur `computeTenantBalance`.
- Stabiliser `npm test` et `npm run test:coverage`.
- Remplacer `npm install --force` en déploiement si possible.

### Moyen terme - 1 à 3 mois

- Baseline Prisma Migrate et migration RLS.
- Implémenter soft delete complet.
- Centraliser uploads, validation MIME/magic bytes, quarantaine.
- Paginer baux, locataires, factures, immeubles.
- Implémenter rétention RGPD automatisée.
- Conditionner analytics au consentement.
- Formaliser runbooks incident, rollback, restauration.

### Long terme - 3 à 6 mois

- Moteur métier d'indexation des loyers avec règles juridiques.
- Module événements juridiques du bail commercial.
- Comptabilité append-only, clôtures, tests FEC sur cas réels.
- Simulation de charge et modèle de coûts.
- Tableaux de bord observabilité métier : taux recouvrement, vacance, erreurs jobs, documents en échec.

---

## Synthèse exécutive

### Notes par dimension

| Dimension | Note /10 | Tendance | Commentaire |
|---|---:|---|---|
| Métier immobilier | 7 | Bonne base, incomplète juridiquement | Couverture large, mais workflows commerciaux avancés manquants |
| Architecture | 6 | Solide mais dette structurante | App Router moderne, mais migrations et env à durcir |
| Sécurité | 3 | Risque immédiat | Deux failles critiques exploitables côté storage/webhook |
| RGPD | 5 | Documenté, exécution partielle | Pages et modèles présents, purge/PII/soft delete à corriger |
| UX | 6 | Prometteuse, non prouvée | Onboarding et aide présents, tests UI instables |
| Performance | 5 | Suffisant petit volume | Pagination et jobs nécessaires avant croissance |
| Qualité/tests | 6 | Lint/TS OK, tests rouges | Bon volume de tests, signal actuel non vert |
| Documentation | 5 | Interne riche, README faible | `CLAUDE.md` utile, README/runbooks absents |
| Résilience | 4 | À formaliser | Sauvegardes déclarées, restauration non prouvée |
| Opérations/coûts | 5 | À instrumenter | Besoin de mesures et de scénarios |

### Verdict

Le projet est fonctionnellement ambitieux et déjà bien structuré sur plusieurs axes : multi-tenant applicatif, modules métier nombreux, OpenAPI, pages légales, tests en quantité, intégrations externes. Mais il n'est pas encore au niveau attendu pour une exploitation SaaS immobilière commerciale avec données financières et personnelles.

Les risques les plus graves ne sont pas théoriques : le proxy TUS peut exfiltrer la clé Supabase service role, et le webhook email entrant accepte des événements non signés. Tant que ces deux points ne sont pas corrigés, l'exposition sécurité est trop forte pour une production ouverte.

La priorité doit être sécurité et conformité d'exécution, pas ajout fonctionnel : fermer les routes critiques, durcir Supabase/RLS, stabiliser tests, sortir les données personnelles des traces, puis seulement consolider les workflows métier avancés.
