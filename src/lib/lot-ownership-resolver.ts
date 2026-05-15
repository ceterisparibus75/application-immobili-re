/**
 * Passerelle entre les données stockées (Prisma) et les helpers purs de
 * `src/lib/ownership.ts`. Ce fichier est le point d'entrée à utiliser
 * depuis les modules métier (facturation, comptabilité, relevés…) pour
 * répondre aux questions du type :
 *  - "ce lot est-il démembré à la date X ?"
 *  - "qui touche le loyer ? qui paye les gros travaux ?"
 *  - "vers quel propriétaire diriger le flux ?"
 *
 * Les fonctions ici sont impures (lisent la BDD) mais déléguent toute la
 * logique de ventilation aux helpers purs, qui restent testables sans mock.
 */

import { imputationForCategory } from "@/lib/cashflow-imputation";
import { prisma } from "@/lib/prisma";
import {
  allocateAmount,
  snapshotOwnership,
  type AllocateOptions,
  type AllocationLine,
  type CashflowImputation,
  type OwnershipShare,
  type OwnershipSnapshot,
} from "@/lib/ownership";

export interface ProprietaireSummary {
  id: string;
  label: string;
}

export interface BeneficiaryAllocation extends AllocationLine {
  proprietaire: ProprietaireSummary;
}

export interface ResolvedOwnership {
  snapshot: OwnershipSnapshot;
  proprietaires: Map<string, ProprietaireSummary>;
}

async function loadOwnershipsForLot(societyId: string, lotId: string): Promise<{
  ownerships: OwnershipShare[];
  proprietaires: Map<string, ProprietaireSummary>;
}> {
  const rows = await prisma.lotOwnership.findMany({
    where: { societyId, lotId },
    include: {
      proprietaire: { select: { id: true, label: true } },
    },
  });

  const proprietaires = new Map<string, ProprietaireSummary>();
  for (const row of rows) {
    proprietaires.set(row.proprietaire.id, {
      id: row.proprietaire.id,
      label: row.proprietaire.label,
    });
  }

  const ownerships: OwnershipShare[] = rows.map((row) => ({
    proprietaireId: row.proprietaireId,
    type: row.type,
    share: row.share,
    startDate: row.startDate,
    endDate: row.endDate,
    isViager: row.isViager,
    usufruitierBirthDate: row.usufruitierBirthDate,
  }));

  return { ownerships, proprietaires };
}

/**
 * Retourne l'état du régime de propriété d'un lot à une date donnée,
 * accompagné du dictionnaire des propriétaires concernés.
 */
export async function resolveActiveOwnership(
  societyId: string,
  lotId: string,
  at: Date = new Date(),
): Promise<ResolvedOwnership> {
  const { ownerships, proprietaires } = await loadOwnershipsForLot(societyId, lotId);
  return {
    snapshot: snapshotOwnership(ownerships, at),
    proprietaires,
  };
}

/**
 * Indique si le lot est en démembrement à la date donnée.
 * Renvoie `false` si aucune quote-part n'est enregistrée (lot non encore
 * rattaché à un Proprietaire — comportement legacy avant L1).
 */
export async function isLotDismembered(
  societyId: string,
  lotId: string,
  at: Date = new Date(),
): Promise<boolean> {
  const { snapshot } = await resolveActiveOwnership(societyId, lotId, at);
  return snapshot.isDismembered;
}

/**
 * Ventile un montant entre les bénéficiaires effectifs d'un lot pour une
 * catégorie de flux donnée. Chaque ligne porte le `Proprietaire` complet
 * (label) pour faciliter l'affichage côté UI / relevés.
 */
export async function resolveBeneficiariesForLot(
  societyId: string,
  lotId: string,
  amount: number,
  imputation: CashflowImputation,
  at: Date = new Date(),
  options: AllocateOptions = {},
): Promise<BeneficiaryAllocation[]> {
  const { ownerships, proprietaires } = await loadOwnershipsForLot(societyId, lotId);
  const allocations = allocateAmount(amount, imputation, ownerships, at, options);

  return allocations.map((line) => {
    const proprietaire = proprietaires.get(line.proprietaireId) ?? {
      id: line.proprietaireId,
      label: line.proprietaireId,
    };
    return { ...line, proprietaire };
  });
}

/**
 * Convertit une catégorie cash-flow (`loyers`, `travaux`, `taxes`…) en
 * imputation démembrement puis ventile le montant entre bénéficiaires.
 * Retourne `null` si la catégorie est neutre (virement interne, CCA…).
 */
export async function resolveBeneficiaryForCashflowCategory(
  societyId: string,
  lotId: string,
  cashflowCategoryId: string,
  amount: number,
  at: Date = new Date(),
  options: AllocateOptions = {},
): Promise<BeneficiaryAllocation[] | null> {
  const imputation = imputationForCategory(cashflowCategoryId);
  if (imputation === null) return null;
  return resolveBeneficiariesForLot(societyId, lotId, amount, imputation, at, options);
}

/**
 * Résout le bénéficiaire d'un paiement encaissé/effectué : remonte
 * Payment → Invoice → Lease → Lot, puis applique la résolution loyer
 * (revenu, donc usufruitier en cas de démembrement).
 */
export async function resolveBeneficiaryForPayment(
  societyId: string,
  paymentId: string,
): Promise<{ proprietaire: ProprietaireSummary; isUsufruct: boolean } | null> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, invoice: { societyId } },
    select: {
      paidAt: true,
      invoice: { select: { lease: { select: { lotId: true } } } },
    },
  });
  const lotId = payment?.invoice?.lease?.lotId;
  if (!lotId || !payment) return null;
  return resolveRentBeneficiary(societyId, lotId, payment.paidAt);
}

/**
 * Variante optimisée pour la facturation : retourne le bénéficiaire unique
 * d'un loyer si le lot est en pleine propriété simple ou en démembrement
 * sans indivision côté usufruit. `null` dans les autres cas (indivision ou
 * lot sans propriétaire enregistré) — l'appelant gère alors la répartition.
 */
export async function resolveRentBeneficiary(
  societyId: string,
  lotId: string,
  at: Date = new Date(),
): Promise<{ proprietaire: ProprietaireSummary; isUsufruct: boolean } | null> {
  const allocations = await resolveBeneficiariesForLot(societyId, lotId, 1, "REVENU", at);
  if (allocations.length !== 1) return null;
  const [only] = allocations;
  return {
    proprietaire: only.proprietaire,
    isUsufruct: only.role === "USUFRUITIER",
  };
}
