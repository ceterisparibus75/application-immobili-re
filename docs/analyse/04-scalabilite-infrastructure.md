# Scalabilité et montée en charge

> **Date :** 12 avril 2026
> Plan d'infrastructure en 5 paliers, de 0 à 5 000+ utilisateurs

---

## Architecture actuelle

| Composant | Technologie | Limite actuelle |
|:--|:--|:--|
| Hébergement | Vercel Serverless (Frankfurt, UE) | Concurrency limitée par plan, cold starts |
| Base de données | Supabase PostgreSQL (pooling PgBouncer) | Pro : 8 Go |
| Stockage fichiers | Supabase Storage | Pro : 100 Go |
| Cache / Rate limiting | Upstash Redis | Pro : 10k requêtes/jour |
| Emails | Resend | Pro : 50k emails/mois |
| Cron jobs | Vercel Cron | Limité selon le plan |
| CDN | Vercel Edge Network | Inclus |

---

## Les 5 paliers de montée en charge

---

### Palier 1 : 0 - 50 utilisateurs (Lancement)

**Profil :** Phase bêta, early adopters

**Volumes estimés :**
- ~500 lots gérés
- ~2 000 factures/mois
- ~5 Go de stockage fichiers

#### Coût infrastructure

| Service | Configuration | Coût mensuel |
|:--|:--|--:|
| Vercel | Pro (20 $/mois) | 20 EUR |
| Supabase | Pro (25 $/mois - 8 Go DB, 100 Go storage) | 25 EUR |
| Upstash Redis | Pro | 10 EUR |
| Resend | Pro (50k emails/mois) | 20 EUR |
| Sentry | Team (50k events) | 26 EUR |
| **Total** | | **~100 EUR/mois** |

#### Ce qu'il faut faire

- Mettre en place les sauvegardes automatiques quotidiennes
- Configurer les alertes de performance (temps de réponse > 3 secondes)
- Lancer des tests de charge initiaux avec k6 ou Artillery (50 utilisateurs simultanés)
- Rédiger un plan de reprise d'activité (PRA)

#### Métriques cibles

| Métrique | Cible |
|:--|:--|
| Temps de réponse moyen des pages | < 2 secondes |
| Temps de réponse des Server Actions | < 1 seconde |
| Taux d'erreur | < 0.1% |
| Disponibilité | > 99.5% |

---

### Palier 2 : 50 - 200 utilisateurs (Croissance)

**Profil :** Traction confirmée, premiers clients payants significatifs

**Volumes estimés :**
- ~3 000 lots gérés
- ~15 000 factures/mois
- ~30 Go de stockage
- ~100 sessions simultanées

#### Coût infrastructure

| Service | Configuration | Coût mensuel |
|:--|:--|--:|
| Vercel | Pro+ (plus de compute) | 50 EUR |
| Supabase | Pro + add-ons (compute M, 50 Go DB) | 75 EUR |
| Upstash Redis | Pro (100k requêtes/jour) | 30 EUR |
| Resend | Business (100k emails/mois) | 50 EUR |
| Sentry | Team (100k events) | 50 EUR |
| Vercel Image Optimization | CDN images | 20 EUR |
| **Total** | | **~275 EUR/mois** |

#### Ce qu'il faut faire

**Base de données :**
- Activer les read replicas Supabase (lectures lourdes sur le replica)
- Ajouter des index composites sur les colonnes fréquemment filtrées :
  ```sql
  CREATE INDEX idx_invoice_society_status ON "Invoice" ("societyId", "status", "dueDate");
  CREATE INDEX idx_lease_society_status ON "Lease" ("societyId", "status", "endDate");
  CREATE INDEX idx_bank_tx_reconciled ON "BankTransaction" ("societyId", "reconciled", "date");
  CREATE INDEX idx_audit_created ON "AuditLog" ("societyId", "createdAt" DESC);
  ```
- Mettre en place le connection pooling avancé (PgBouncer transaction mode)
- Planifier les VACUUM et ANALYZE automatiques
- Archiver les données de plus de 3 ans dans des tables d'archive

**Cache Redis :**
- Dashboard KPIs : TTL 5 minutes
- Liste des sociétés/lots d'un utilisateur : TTL 10 minutes
- Indices INSEE : TTL 24 heures
- Plan comptable : TTL 1 heure

**Performance frontend :**
- Activer ISR (Incremental Static Regeneration) pour les pages semi-statiques (aide, blog)
- Lazy loading des composants lourds (graphiques Recharts, éditeur PDF)
- Pagination systématique côté serveur (jamais plus de 100 éléments chargés)
- Optimisation images : WebP/AVIF, lazy loading, srcset responsive

**Monitoring :**
- Dashboard de monitoring temps réel (Vercel Analytics + custom)
- Alertes Slack/email : erreurs 5xx, latence > 3s, connexions DB > 80%
- Logs structurés (JSON) avec correlation ID par requête

---

### Palier 3 : 200 - 1 000 utilisateurs (Scale-up)

**Profil :** Croissance soutenue, besoins enterprise émergents

**Volumes estimés :**
- ~15 000 lots gérés
- ~60 000 factures/mois
- ~200 Go de stockage
- ~500 sessions simultanées

#### Coût infrastructure

| Service | Configuration | Coût mensuel |
|:--|:--|--:|
| Vercel | Enterprise ou migration VPS | 200-500 EUR |
| Supabase | Pro XL (compute L, 200 Go DB, read replicas) | 300 EUR |
| Redis | Upstash Pro ou Redis Cloud | 80 EUR |
| Resend | Enterprise (500k emails/mois) | 200 EUR |
| Sentry | Business | 100 EUR |
| Stockage | Supabase Storage 500 Go + CDN | 100 EUR |
| Backup offsite | Automatisé | 50 EUR |
| **Total** | | **~1 000 - 1 300 EUR/mois** |

#### Ce qu'il faut faire

**Architecture :**
- Évaluer la migration vers une infrastructure dédiée :
  - **Option A :** Rester Vercel Enterprise (simplicité, coût plus élevé) - **recommandé tant que le ratio coût/simplicité est acceptable**
  - **Option B :** VPS (Hetzner/OVH) + Docker + k3s
  - **Option C :** AWS/GCP avec ECS/Cloud Run
- Mettre en place un CDN dédié (Cloudflare) devant Vercel
- Séparer les cron jobs lourds dans des workers dédiés (Inngest ou Trigger.dev)

**Base de données :**
- Partitionnement des tables volumineuses par date :
  - `AuditLog` : partitionnement mensuel
  - `BankTransaction` et `Invoice` : partitionnement annuel
- Monitoring DB dédié (pganalyze ou Supabase Dashboard)
- Politique de purge : archiver les audit logs > 1 an, transactions réconciliées > 3 ans

**Cache multi-niveaux :**
- Niveau 1 : In-memory (LRU cache Node.js pour les données chaudes)
- Niveau 2 : Redis (sessions, KPIs, résultats de recherche)
- Niveau 3 : CDN edge (pages statiques, assets)
- Invalidation event-driven (revalidatePath + Redis pub/sub)

**Sécurité renforcée :**
- WAF (Web Application Firewall) via Cloudflare ou Vercel
- Protection DDoS avancée
- Audit de sécurité externe (pentest annuel)
- Préparation SOC 2 Type I
- Chiffrement at-rest pour la base de données
- Backups chiffrés avec rotation des clés

**Stockage :**
- Migration possible vers S3/R2 si les coûts Supabase Storage deviennent prohibitifs
- Politique de tiering : fichiers récents en hot storage, > 1 an en cold storage
- Compression automatique des documents à l'upload

---

### Palier 4 : 1 000 - 5 000 utilisateurs (Enterprise)

**Profil :** Leader du marché, clients grands comptes

**Volumes estimés :**
- ~75 000 lots gérés
- ~300 000 factures/mois
- ~1 To de stockage
- ~2 000 sessions simultanées

#### Coût infrastructure

| Service | Configuration | Coût mensuel |
|:--|:--|--:|
| Compute | Kubernetes (EKS/GKE) ou Vercel Enterprise | 1 500 EUR |
| Base de données | PostgreSQL dédié (RDS/Cloud SQL) + read replicas | 800 EUR |
| Redis | Redis Cluster (3 noeuds) | 200 EUR |
| Stockage | S3/R2 (1 To) + CDN | 200 EUR |
| Emails | Resend Enterprise + SES fallback | 400 EUR |
| Monitoring | Datadog ou Grafana Cloud | 300 EUR |
| Sécurité | WAF + DDoS + pentest trimestriel | 500 EUR |
| Backup | Multi-région, rétention 90 jours | 200 EUR |
| **Total** | | **~4 000 - 5 000 EUR/mois** |

#### Ce qu'il faut faire

**Architecture microservices :**
- Service PDF : génération en parallèle avec file d'attente
- Service IA : analyse documents et évaluations
- Service email : file d'attente avec retry automatique
- Service cron/jobs : Inngest ou Temporal

**Base de données :**
- Master-replica avec failover automatique
- Multi-région pour le Disaster Recovery
- File de messages (BullMQ / RabbitMQ) pour les opérations asynchrones
- Materialized views PostgreSQL pour les KPIs complexes

**Données :**
- Data warehouse séparé pour l'analytique (ClickHouse ou BigQuery)
- ETL pipeline pour alimenter le data warehouse
- Rétention automatisée avec archivage S3 Glacier

**Équipe :**
- DevOps / SRE dédié (au minimum 1 personne)
- Rotation d'astreinte pour les incidents
- Runbooks documentés pour les incidents courants
- SLA contractuels : 99.9% de disponibilité

---

### Palier 5 : 5 000+ utilisateurs (Scale international)

**Profil :** Expansion internationale, multi-marchés

**Volumes estimés :**
- ~500 000 lots gérés
- ~2 millions de factures/mois
- ~10 To de stockage

#### Évolution architecturale

- Multi-tenant par base de données (un schéma/DB par gros client enterprise)
- CDN multi-région (Europe, DOM-TOM, Afrique francophone)
- Sharding de la base de données par région ou par client
- API gateway (Kong/Tyk) pour le rate limiting, l'authentification et le routing
- Service mesh (Istio) pour la communication inter-services
- Observabilité complète : traces distribuées (OpenTelemetry), métriques, logs

**Coût estimé : 15 000 - 30 000 EUR/mois d'infrastructure**

---

## Tableau récapitulatif

| Palier | Utilisateurs | Lots gérés | Infra/mois | Action clé |
|:--|:--|:--|--:|:--|
| **1 - Lancement** | 0 - 50 | ~500 | ~100 EUR | Vercel + Supabase Pro, monitoring basique |
| **2 - Croissance** | 50 - 200 | ~3 000 | ~275 EUR | Read replicas, cache Redis, index DB |
| **3 - Scale-up** | 200 - 1 000 | ~15 000 | ~1 200 EUR | CDN Cloudflare, workers séparés, partitionnement |
| **4 - Enterprise** | 1 000 - 5 000 | ~75 000 | ~4 500 EUR | Kubernetes, microservices, multi-région |
| **5 - International** | 5 000+ | ~500 000 | ~20 000 EUR | Sharding, API gateway, service mesh |

---

## Optimisations à faire avant le lancement

### Base de données : index critiques

```sql
CREATE INDEX idx_invoice_society_status_date ON "Invoice" ("societyId", "status", "dueDate");
CREATE INDEX idx_lease_society_status_end ON "Lease" ("societyId", "status", "endDate");
CREATE INDEX idx_bank_tx_society_reconciled ON "BankTransaction" ("societyId", "reconciled", "date");
CREATE INDEX idx_audit_society_created ON "AuditLog" ("societyId", "createdAt" DESC);
CREATE INDEX idx_tenant_society_active ON "Tenant" ("societyId", "isArchived");
CREATE INDEX idx_lot_society_status ON "Lot" ("societyId", "status");
```

### Stratégie de cache

| Type de données | Durée de cache (TTL) | Exemples |
|:--|:--|:--|
| Chaudes | 5 minutes | Dashboard KPIs, compteurs |
| Tièdes | 1 heure | Plan comptable, catégories de charges |
| Froides | 24 heures | Indices INSEE, liste des sociétés |
| Statiques | 7 jours | Templates de courriers, pages d'aide |

### Frontend

- Code splitting par route (natif Next.js App Router)
- Lazy loading des graphiques Recharts (import dynamique)
- Compression Brotli (actif sur Vercel)
- Prefetch des pages probables (liens de la sidebar)
- Images optimisées : logos < 50 Ko, aperçus documents < 200 Ko

### Métriques cibles par palier

| Métrique | Palier 1 | Palier 3 | Palier 5 |
|:--|:--|:--|:--|
| TTFB (Time to First Byte) | < 500 ms | < 300 ms | < 200 ms |
| LCP (Largest Contentful Paint) | < 2.5 s | < 2 s | < 1.5 s |
| FID (First Input Delay) | < 100 ms | < 50 ms | < 30 ms |
| CLS (Cumulative Layout Shift) | < 0.1 | < 0.05 | < 0.05 |
| Temps Server Action moyen | < 1 s | < 500 ms | < 300 ms |
| Disponibilité | 99.5% | 99.9% | 99.95% |
| Erreurs 5xx par jour | < 10 | < 5 | < 1 |
