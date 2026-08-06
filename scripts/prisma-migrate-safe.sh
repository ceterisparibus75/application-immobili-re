#!/bin/bash
# Migration Prisma robuste pour builds Vercel :
# 1) Reset des migrations en état "failed" si présentes (héritage db push)
# 2) Application normale via migrate deploy
#
# Les migrations sont écrites en idempotent (ADD COLUMN IF NOT EXISTS, etc.)
# donc re-appliquer une migration dont les colonnes existent déjà passe
# sans erreur. Ce script débloque juste les états inconsistants.
set -e

# Liste des migrations connues comme potentiellement en failed state
# (héritage db push antérieur ou builds précédents ayant échoué).
# Ajouter ici toute nouvelle migration qui pourrait tomber dans ce cas.
FAILED_CANDIDATES=(
  "20260625180000_tenant_default_invoice_note"
  "20260628230000_lease_fixed_indexation"
  "20260629000000_lease_billing_anchor"
  "20260724170000_society_sender_domain"
  "20260805170000_user_daily_digest"
  "20260805200000_stripe_connect"
)

for m in "${FAILED_CANDIDATES[@]}"; do
  # `resolve --rolled-back` échoue silencieusement si la migration n'est pas
  # en failed state — c'est le comportement attendu (idempotent).
  npx prisma migrate resolve --rolled-back "$m" 2>/dev/null || true
done

# Applique toutes les migrations pendantes. Grâce à IF NOT EXISTS, une
# migration dont les colonnes existent déjà se termine sans erreur.
npx prisma migrate deploy
