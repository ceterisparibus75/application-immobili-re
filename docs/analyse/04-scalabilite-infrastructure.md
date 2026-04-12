# PARTIE 4 - Plan de scalabilite et montee en charge

## 1. Architecture actuelle

| Composant | Technologie | Limites actuelles |
|---|---|---|
| **Hosting** | Vercel (Serverless, Frankfurt) | Concurrency limitee par plan, cold starts |
| **Base de donnees** | Supabase PostgreSQL (pooling PgBouncer) | Plan gratuit : 500 Mo, Pro : 8 Go |
| **Stockage fichiers** | Supabase Storage | Plan gratuit : 1 Go, Pro : 100 Go |
| **Cache/Rate limit** | Upstash Redis | Plan gratuit : 10k req/jour |
| **Emails** | Resend | Plan gratuit : 100/jour, Pro : 50k/mois |
| **Cron jobs** | Vercel Cron | Limite selon plan Vercel |
| **CDN** | Vercel Edge Network | Inclus |

---

## 2. Paliers de montee en charge

### PALIER 1 : 0 - 50 utilisateurs (Lancement)

**Profil** : Phase beta / early adopters
**Volume estime** : ~500 lots geres, ~2000 factures/mois, ~5 Go stockage

#### Infrastructure requise

| Composant | Configuration | Cout mensuel estime |
|---|---|---|
| Vercel | Pro ($20/mois) | 20 EUR |
| Supabase | Pro ($25/mois, 8 Go DB, 100 Go storage) | 25 EUR |
| Upstash Redis | Pro (10k req/jour) | 10 EUR |
| Resend | Pro (50k emails/mois) | 20 EUR |
| Sentry | Team (50k events) | 26 EUR |
| **TOTAL** | | **~100 EUR/mois** |

#### Actions requises
- [x] Deploiement Vercel standard
- [x] Supabase Pro pour la base de donnees
- [x] Monitoring Sentry basique
- [ ] Mettre en place les sauvegardes automatiques quotidiennes
- [ ] Configurer les alertes de performance (temps de reponse > 3s)
- [ ] Tests de charge initiaux (k6 ou Artillery) : 50 utilisateurs simultanes
- [ ] Plan de reprise d'activite (PRA) documente

#### Metriques a surveiller
- Temps de reponse moyen des pages < 2s
- Temps de reponse des Server Actions < 1s
- Taux d'erreur < 0.1%
- Disponibilite > 99.5%

---

### PALIER 2 : 50 - 200 utilisateurs (Croissance)

**Profil** : Traction confirmee, premiers clients payants significatifs
**Volume estime** : ~3 000 lots, ~15 000 factures/mois, ~30 Go stockage, ~100 sessions simultanees

#### Infrastructure requise

| Composant | Configuration | Cout mensuel estime |
|---|---|---|
| Vercel | Pro + (plus de compute) | 50 EUR |
| Supabase | Pro avec add-ons (compute M, 50 Go DB) | 75 EUR |
| Upstash Redis | Pro (100k req/jour) | 30 EUR |
| Resend | Business (100k emails/mois) | 50 EUR |
| Sentry | Team (100k events) | 50 EUR |
| CDN images | Vercel Image Optimization | 20 EUR |
| **TOTAL** | | **~275 EUR/mois** |

#### Actions requises

**Base de donnees :**
- [ ] Activer les replicas en lecture (Supabase Read Replicas)
- [ ] Optimiser les requetes lentes : ajouter des index sur les colonnes frequemment filtrees
  - `Invoice.societyId + status + dueDate` (index composite)
  - `Lease.societyId + status + endDate`
  - `BankTransaction.societyId + reconciled + date`
  - `AuditLog.societyId + createdAt`
- [ ] Mettre en place le connection pooling avance (PgBouncer transaction mode)
- [ ] Planifier les VACUUM et ANALYZE automatiques
- [ ] Archivage des donnees > 3 ans dans des tables d'archive

**Performance :**
- [ ] Implementer le cache Redis pour les donnees frequemment lues :
  - Dashboard KPIs (TTL 5 min)
  - Liste des societes/lots d'un utilisateur (TTL 10 min)
  - Indices INSEE (TTL 24h)
  - Plan comptable (TTL 1h)
- [ ] Activer ISR (Incremental Static Regeneration) pour les pages semi-statiques (aide, blog)
- [ ] Lazy loading des composants lourds (graphiques Recharts, editeur PDF)
- [ ] Pagination systematique cote serveur (pas de chargement > 100 elements)
- [ ] Optimisation des images : WebP/AVIF, lazy loading, srcset responsive

**Stockage :**
- [ ] Politique de retention des fichiers : compression des PDFs > 1 an
- [ ] Nettoyage automatique des fichiers temporaires
- [ ] CDN pour les fichiers statiques (logos, templates)

**Monitoring :**
- [ ] Dashboard de monitoring en temps reel (Vercel Analytics + custom)
- [ ] Alertes Slack/email sur : erreurs 5xx, latence > 3s, DB connections > 80%
- [ ] Logs structures (JSON) avec correlation ID par requete

---

### PALIER 3 : 200 - 1 000 utilisateurs (Scale-up)

**Profil** : Croissance soutenue, besoins enterprise emergents
**Volume estime** : ~15 000 lots, ~60 000 factures/mois, ~200 Go stockage, ~500 sessions simultanees

#### Infrastructure requise

| Composant | Configuration | Cout mensuel estime |
|---|---|---|
| Vercel | Enterprise ou migration VPS | 200-500 EUR |
| Supabase | Pro XL (compute L, 200 Go DB, read replicas) | 300 EUR |
| Redis | Upstash Pro ou Redis Cloud | 80 EUR |
| Resend | Enterprise (500k emails/mois) | 200 EUR |
| Sentry | Business | 100 EUR |
| Stockage | Supabase Storage 500 Go + CDN | 100 EUR |
| Backup | Backup offsite automatise | 50 EUR |
| **TOTAL** | | **~1 000 - 1 300 EUR/mois** |

#### Actions requises

**Architecture :**
- [ ] Evaluer la migration vers une infrastructure dediee :
  - Option A : Rester Vercel Enterprise (simplicite, cout plus eleve)
  - Option B : Migration VPS (Hetzner/OVH) + Docker + Kubernetes lite (k3s)
  - Option C : AWS/GCP avec ECS/Cloud Run (flexibilite, complexite)
  - **Recommandation** : Rester Vercel tant que le ratio cout/simplicite est acceptable
- [ ] Mettre en place un CDN dedie (Cloudflare) devant Vercel
- [ ] Separer les cron jobs lourds dans des workers dedies (Inngest ou Trigger.dev)

**Base de donnees :**
- [ ] Read replicas actifs pour les requetes de lecture lourdes (rapports, analytics)
- [ ] Partitionnement des tables volumineuses par date :
  - `AuditLog` : partitionnement mensuel
  - `BankTransaction` : partitionnement annuel
  - `Invoice` : partitionnement annuel
- [ ] Connection pooling avance avec Supavisor ou PgBouncer dediv
- [ ] Monitoring DB dediv (pganalyze ou Supabase Dashboard)
- [ ] Politique de purge : archiver les audit logs > 1 an, transactions reconciliees > 3 ans

**Cache multi-niveaux :**
- [ ] Niveau 1 : In-memory (LRU cache Node.js pour les donnees chaudes)
- [ ] Niveau 2 : Redis (sessions, KPIs, resultats de recherche)
- [ ] Niveau 3 : CDN edge (pages statiques, assets)
- [ ] Cache invalidation event-driven (revalidatePath + Redis pub/sub)

**Securite renforcee :**
- [ ] WAF (Web Application Firewall) - Cloudflare ou Vercel
- [ ] DDoS protection avancee
- [ ] Audit de securite externe (pentest)
- [ ] SOC 2 Type I preparation
- [ ] Encryption at rest pour la base de donnees
- [ ] Backup chiffre avec rotation des cles

**Stockage :**
- [ ] Migration possible vers S3/R2 si les couts Supabase Storage deviennent prohibitifs
- [ ] Politique de tiering : fichiers recents en hot storage, > 1 an en cold storage
- [ ] Compression automatique des documents a l'upload (tinify pour images, ghostscript pour PDF)

---

### PALIER 4 : 1 000 - 5 000 utilisateurs (Entreprise)

**Profil** : Leader du marche, clients grands comptes
**Volume estime** : ~75 000 lots, ~300 000 factures/mois, ~1 To stockage, ~2 000 sessions simultanees

#### Infrastructure requise

| Composant | Configuration | Cout mensuel estime |
|---|---|---|
| Compute | Kubernetes (EKS/GKE) ou Vercel Enterprise | 1 500 EUR |
| Base de donnees | PostgreSQL dedie (RDS/Cloud SQL) + read replicas | 800 EUR |
| Redis | Redis Cluster (3 noeuds) | 200 EUR |
| Stockage | S3/R2 (1 To) + CDN | 200 EUR |
| Emails | Resend Enterprise + SES fallback | 400 EUR |
| Monitoring | Datadog ou Grafana Cloud | 300 EUR |
| Securite | WAF + DDoS + pentest trimestriel | 500 EUR |
| Backup | Multi-region, retention 90 jours | 200 EUR |
| **TOTAL** | | **~4 000 - 5 000 EUR/mois** |

#### Actions requises

**Architecture :**
- [ ] Migration vers infrastructure dediee (Kubernetes) si ce n'est pas deja fait
- [ ] Architecture microservices pour les modules lourds :
  - Service PDF (generation en parallele, queue)
  - Service IA (analyse documents, evaluations)
  - Service email (queue avec retry)
  - Service cron/jobs (Inngest/Temporal)
- [ ] Base de donnees : master-replica avec failover automatique
- [ ] Multi-region : deploiement secondaire pour la DR (Disaster Recovery)
- [ ] Queue de messages (BullMQ / RabbitMQ) pour les operations asynchrones

**Performance :**
- [ ] API GraphQL ou tRPC pour optimiser les requetes frontend
- [ ] Server-Sent Events ou WebSockets pour les mises a jour en temps reel
- [ ] Pre-rendering des rapports pendant les heures creuses
- [ ] Materialized views PostgreSQL pour les KPIs complexes

**Donnees :**
- [ ] Data warehouse separe pour l'analytique (ClickHouse ou BigQuery)
- [ ] ETL pipeline pour alimenter le data warehouse
- [ ] Retention policy automatisee avec archivage S3 Glacier

**Equipe :**
- [ ] DevOps / SRE dedie (au moins 1 personne)
- [ ] On-call rotation pour les incidents
- [ ] Runbooks documentes pour les incidents courants
- [ ] SLA contractuels (99.9% uptime)

---

### PALIER 5 : 5 000+ utilisateurs (Scale enterprise)

**Profil** : Expansion internationale, multi-marche
**Volume estime** : ~500 000 lots, ~2M factures/mois, ~10 To stockage

#### Evolution architecturale

- [ ] Multi-tenant par base de donnees (un schema/DB par gros client) pour les comptes enterprise
- [ ] CDN multi-region (Europe, DOM-TOM, Afrique francophone)
- [ ] Sharding de la base de donnees par region ou par client
- [ ] API gateway (Kong/Tyk) pour le rate limiting, auth, et routing
- [ ] Service mesh (Istio) pour la communication inter-services
- [ ] Observabilite complete : traces distribuees (OpenTelemetry), metriques, logs

**Cout estime** : 15 000 - 30 000 EUR/mois d'infrastructure

---

## 3. Tableau recapitulatif des paliers

| Palier | Utilisateurs | Lots geres | Infra mensuelle | Action cle |
|---|---|---|---|---|
| 1 - Lancement | 0-50 | ~500 | ~100 EUR | Vercel + Supabase Pro |
| 2 - Croissance | 50-200 | ~3 000 | ~275 EUR | Read replicas, cache Redis, index DB |
| 3 - Scale-up | 200-1 000 | ~15 000 | ~1 200 EUR | CDN, workers separes, partitionnement |
| 4 - Enterprise | 1 000-5 000 | ~75 000 | ~4 500 EUR | Kubernetes, microservices, multi-region |
| 5 - Scale | 5 000+ | ~500 000 | ~20 000 EUR | Sharding, API gateway, service mesh |

---

## 4. Optimisations de performance immediates (a faire avant le lancement)

### 4.1 Base de donnees
```sql
-- Index critiques a ajouter
CREATE INDEX idx_invoice_society_status_date ON "Invoice" ("societyId", "status", "dueDate");
CREATE INDEX idx_lease_society_status_end ON "Lease" ("societyId", "status", "endDate");
CREATE INDEX idx_bank_tx_society_reconciled ON "BankTransaction" ("societyId", "reconciled", "date");
CREATE INDEX idx_audit_society_created ON "AuditLog" ("societyId", "createdAt" DESC);
CREATE INDEX idx_tenant_society_active ON "Tenant" ("societyId", "isArchived");
CREATE INDEX idx_lot_society_status ON "Lot" ("societyId", "status");
```

### 4.2 Cache strategie
```
Donnees chaudes (TTL 5 min)  : Dashboard KPIs, compteurs
Donnees tiedes (TTL 1h)      : Plan comptable, categories charges
Donnees froides (TTL 24h)    : Indices INSEE, liste des societes
Donnees statiques (TTL 7j)   : Templates courriers, aide
```

### 4.3 Frontend
- Code splitting par route (deja natif Next.js App Router)
- Lazy loading Recharts (import dynamique)
- Compression Brotli (actif sur Vercel)
- Prefetch des pages probables (liens sidebar)
- Image optimization : logos < 50 Ko, documents preview < 200 Ko

### 4.4 Metriques cibles

| Metrique | Cible Palier 1 | Cible Palier 3 | Cible Palier 5 |
|---|---|---|---|
| TTFB (Time to First Byte) | < 500ms | < 300ms | < 200ms |
| LCP (Largest Contentful Paint) | < 2.5s | < 2s | < 1.5s |
| FID (First Input Delay) | < 100ms | < 50ms | < 30ms |
| CLS (Cumulative Layout Shift) | < 0.1 | < 0.05 | < 0.05 |
| Temps Server Action moyen | < 1s | < 500ms | < 300ms |
| Disponibilite | 99.5% | 99.9% | 99.95% |
| Erreurs 5xx / jour | < 10 | < 5 | < 1 |
