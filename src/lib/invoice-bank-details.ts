/**
 * Résout les coordonnées bancaires à afficher sur une facture/PDF/email.
 *
 * Par défaut, on utilise le RIB de la société émettrice. En cas de
 * démembrement actif sur le lot du bail à la date d'émission, on
 * substitue le RIB de l'usufruitier s'il est renseigné — les loyers étant
 * juridiquement perçus par l'usufruitier (art. 578 CC).
 *
 * ⚠ Sécurité : ce helper déchiffre des IBAN/BIC. À utiliser uniquement
 * côté serveur, jamais exposé directement au client.
 *
 * ⚠ Note juridique : pour la facturation B2B / Factur-X, le vendeur reste
 * la société (BT-30 SIRET). Seul le RIB d'encaissement (BT-84) est
 * substitué. À valider avec votre conseil juridique avant utilisation en
 * production pour des factures à valeur fiscale.
 */

import { decrypt } from "@/lib/encryption";
import { resolveRentBeneficiary } from "@/lib/lot-ownership-resolver";
import { prisma } from "@/lib/prisma";

export interface InvoiceBankDetails {
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  /** Si vrai, le RIB provient de l'usufruitier (et non de la société). */
  fromUsufructuary: boolean;
  /** Label du propriétaire usufruitier (pour affichage uniquement). */
  beneficiaryLabel: string | null;
}

interface SocietyBankFields {
  ibanEncrypted: string | null;
  bicEncrypted: string | null;
  bankName: string | null;
}

/**
 * @param societyId — société émettrice (tenant)
 * @param society — coordonnées bancaires de la société (par défaut)
 * @param lotId — lot du bail concerné par la facture (null si pas de bail)
 * @param at — date d'émission (utilisée pour résoudre le régime actif)
 */
export async function resolveInvoiceBankDetails(
  societyId: string,
  society: SocietyBankFields,
  lotId: string | null,
  at: Date,
): Promise<InvoiceBankDetails> {
  // Cas par défaut : RIB de la société
  const fallback: InvoiceBankDetails = {
    iban: society.ibanEncrypted ? safeDecrypt(society.ibanEncrypted) : null,
    bic: society.bicEncrypted ? safeDecrypt(society.bicEncrypted) : null,
    bankName: society.bankName,
    fromUsufructuary: false,
    beneficiaryLabel: null,
  };

  if (!lotId) return fallback;

  const beneficiary = await resolveRentBeneficiary(societyId, lotId, at);
  if (!beneficiary || !beneficiary.isUsufruct) return fallback;

  // Démembrement actif et bénéficiaire unique : chercher son RIB
  const proprietaire = await prisma.proprietaire.findFirst({
    where: { id: beneficiary.proprietaire.id },
    select: { ibanEncrypted: true, bicEncrypted: true, bankName: true, label: true },
  });

  if (!proprietaire) return fallback;

  // Pas de RIB renseigné sur l'usufruitier → fallback société + drapeau false
  if (!proprietaire.ibanEncrypted) {
    return { ...fallback, beneficiaryLabel: proprietaire.label };
  }

  return {
    iban: safeDecrypt(proprietaire.ibanEncrypted),
    bic: proprietaire.bicEncrypted ? safeDecrypt(proprietaire.bicEncrypted) : null,
    bankName: proprietaire.bankName,
    fromUsufructuary: true,
    beneficiaryLabel: proprietaire.label,
  };
}

function safeDecrypt(cipher: string): string | null {
  try {
    return decrypt(cipher);
  } catch {
    return null;
  }
}
