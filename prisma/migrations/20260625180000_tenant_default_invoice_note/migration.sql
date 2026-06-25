-- Mention récurrente imprimée par défaut sur les factures du locataire.
-- À chaque création/génération d'une Invoice pour ce tenant, si Invoice.note
-- n'est pas explicitement renseignée, on hérite de cette valeur. Le champ
-- reste modifiable par facture (override).

ALTER TABLE "Tenant" ADD COLUMN "defaultInvoiceNote" TEXT;
