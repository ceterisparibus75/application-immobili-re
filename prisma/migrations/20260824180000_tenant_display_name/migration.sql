-- Nom d'affichage optionnel du locataire pour override la concaténation
-- firstName+lastName ou companyName dans les factures, listes, emails.
-- Utile pour les co-titulaires ("M. Langet et Mme Bui Duc") ou tout
-- intitulé personnalisé.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
