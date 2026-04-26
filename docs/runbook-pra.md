# Runbook PRA — MyGestia

**Version :** 1.0 — 26 avril 2026  
**Responsable :** Maxime Langet  
**RTO cible :** < 4 heures  
**RPO cible :** < 24 heures (sauvegardes quotidiennes Supabase)

---

## 1. Objectifs

| Indicateur | Cible | Justification |
|------------|-------|---------------|
| RTO (Recovery Time Objective) | < 4h | Tolérance maximale de coupure de service |
| RPO (Recovery Point Objective) | < 24h | Dernière sauvegarde disponible Supabase |
| Fréquence sauvegardes | Quotidienne | Plan Supabase Pro automatique |
| Rétention sauvegardes | 7 jours (Pro) / 30 jours (Enterprise) | Selon plan Supabase actif |

---

## 2. Contacts d'urgence

| Rôle | Contact | Délai de réponse |
|------|---------|-----------------|
| Responsable technique | maxime.langet@bl-aj.fr | < 1h |
| Support Supabase | https://supabase.com/dashboard/support | SLA selon plan |
| Support Vercel | https://vercel.com/help | SLA selon plan |
| Support Stripe | https://support.stripe.com | 24h-48h |

---

## 3. Scénarios d'incident

### 3.1 Indisponibilité applicative (Vercel)

**Détection :** monitoring Sentry, alertes Vercel, signalement utilisateur.

**Procédure :**

1. Vérifier le statut Vercel : https://www.vercel-status.com
2. Accéder au tableau de bord Vercel → **Deployments**
3. Si le dernier déploiement est défaillant → **Promote** le dernier déploiement stable
4. Si le problème est dans le code : corriger + `git push` → déploiement automatique
5. Si l'indisponibilité dure > 30 min : activer la page de maintenance (configurer une redirection via Vercel)

**Rollback rapide :**
```
Vercel Dashboard → Deployments → [deployment stable] → Promote to Production
```

---

### 3.2 Corruption ou perte de données (Supabase)

**Détection :** erreurs applicatives liées à des données manquantes ou corrompues.

**Procédure :**

1. **Identifier la plage horaire** de la corruption (logs Sentry, audit_log en base)
2. Aller sur **Console Supabase → Database → Backups**
3. Sélectionner le point de restauration (avant la corruption)
4. **Restaurer vers un projet Supabase de staging** pour vérification
5. Comparer les données critiques (locataires, baux, factures) avec la production
6. Si la restauration est validée : planifier la bascule (créneaux de faible activité)
7. Mettre à jour `DATABASE_URL` et `DIRECT_URL` dans Vercel si changement de projet

> ⚠️ **Ne jamais restaurer directement en production sans validation staging.**

**Commandes de vérification post-restauration :**
```bash
# Vérifier le nombre d'enregistrements critiques
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Tenant\" WHERE \"deletedAt\" IS NULL;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Lease\" WHERE status = 'EN_COURS';"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Invoice\" WHERE status NOT IN ('DRAFT', 'CANCELED');"
```

---

### 3.3 Migration de schéma échouée

**Détection :** erreur lors de `npm run db:migrate` ou déploiement échoué.

**Procédure :**

1. **Ne pas modifier la base en production sans sauvegarde préalable**
2. Vérifier l'état des migrations :
   ```bash
   npx prisma migrate status
   ```
3. Si la migration a partiellement échoué, identifier les instructions SQL exécutées dans les logs
4. Corriger manuellement via Prisma Studio ou psql si nécessaire
5. Marquer la migration comme résolue si besoin :
   ```bash
   npx prisma migrate resolve --applied <migration_name>
   # ou
   npx prisma migrate resolve --rolled-back <migration_name>
   ```
6. Re-tester sur staging avant toute nouvelle tentative en production

---

### 3.4 Compromission de secrets (clé Supabase, AUTH_SECRET, etc.)

**Procédure immédiate :**

1. **Révoquer la clé compromise** dans la console du service concerné
2. Générer un nouveau secret
3. Mettre à jour dans **Vercel → Settings → Environment Variables**
4. Déclencher un nouveau déploiement (le déploiement récupère les nouvelles variables)
5. Si `AUTH_SECRET` est compromis : toutes les sessions actives seront invalidées → prévenir les utilisateurs
6. Si `SUPABASE_SERVICE_ROLE_KEY` est compromis : auditer les accès Storage et les journaux Supabase

**Clés à révoquer selon le scénario :**

| Secret compromis | Action |
|------------------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Régénérer dans Supabase → Settings → API |
| `AUTH_SECRET` | Régénérer (`openssl rand -base64 32`) → invalide toutes les sessions |
| `STRIPE_SECRET_KEY` | Révoquer dans Stripe Dashboard → Developers → API keys |
| `ENCRYPTION_KEY` | ⚠️ Critique — les IBAN/BIC existants ne seront plus déchiffrables. Contacter le support avant action. |

---

### 3.5 Job cron bloqué ou en erreur

**Détection :** logs Vercel, absence de notifications attendues (révisions, relances).

**Déclenchement manuel d'un job :**
```bash
curl -X GET https://app.mygestia.immo/api/cron/<nom-du-job> \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Jobs et leurs effets :**

| Job | Route | Impact si manqué |
|-----|-------|-----------------|
| Révisions de loyer | `/api/cron/rent-revisions` | Révisions non générées (1er du mois) |
| Relances factures | `/api/cron/invoice-reminder` | Relances non envoyées (lundi) |
| Génération brouillons | `/api/cron/generate-drafts` | Brouillons non créés (quotidien 7h) |
| Sync bancaire | `/api/cron/sync-bank` | Transactions bancaires non mises à jour |
| Sync abonnements | `/api/cron/sync-subscriptions` | Statuts Stripe non synchronisés |
| Purge RGPD | `/api/cron/data-retention-cleanup` | Données expirées non supprimées (dimanche 3h) |

---

### 3.6 Brèche de données personnelles (RGPD)

**Obligation légale : notifier la CNIL dans les 72 heures si risque élevé.**

**Procédure :**

1. **Identifier** les données concernées (nature, volume, catégories : locataires, données bancaires, documents)
2. **Contenir** : révoquer les accès suspects, désactiver temporairement les routes concernées si nécessaire
3. **Évaluer le risque** : données chiffrées (IBAN/BIC) ? données anonymisées ? accès authentifié ?
4. **Notifier** :
   - Utilisateurs concernés si risque élevé pour leurs droits
   - CNIL via https://notifications.cnil.fr si brèche à risque élevé (délai 72h)
5. **Documenter** dans le registre des traitements (DPA)
6. **Corriger** la faille et renforcer les contrôles

---

## 4. Tests de restauration

**Fréquence recommandée : trimestrielle**

### Protocole de test

1. Créer un projet Supabase temporaire (staging)
2. Restaurer depuis une sauvegarde Supabase (point d'il y a 7 jours)
3. Pointer une instance de test de l'application vers ce projet
4. Vérifier les points de contrôle :
   - [ ] Connexion utilisateur possible
   - [ ] Affichage des locataires et baux
   - [ ] Génération d'une facture PDF
   - [ ] Envoi d'un email de test (Resend sandbox)
   - [ ] Calcul des soldes locataires
5. Mesurer le temps écoulé depuis le début (RTO effectif)
6. Nettoyer et supprimer le projet Supabase temporaire

**Résultat attendu :** RTO effectif < 4h, RPO confirmé < 24h.

---

## 5. Checklist de démarrage après incident

- [ ] Vérifier que l'application répond sur l'URL de production
- [ ] Vérifier les logs Sentry pour nouvelles erreurs
- [ ] Confirmer que les crons sont actifs (Vercel → Cron Jobs)
- [ ] Vérifier que les webhooks Stripe, DocuSign, GoCardless reçoivent des événements
- [ ] Tester la connexion d'un utilisateur réel
- [ ] Vérifier qu'une facture peut être générée et envoyée
- [ ] Confirmer l'absence d'alertes dans le tableau de bord abonnements
- [ ] Documenter l'incident (durée, cause, actions correctives, amélioration)
