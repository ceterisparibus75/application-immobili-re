/**
 * Synthèse fiscale annuelle d'un lot pour la déclaration des revenus fonciers
 * (formulaire 2044) en présence d'un démembrement.
 *
 * En l'absence de démembrement, tous les flux sont déclarés par le plein
 * propriétaire — la synthèse retombe alors sur un unique bénéficiaire.
 *
 * Limites volontaires :
 * - Aucune classification automatique gros travaux (art. 606 CC) vs charges
 *   courantes : le schéma `Maintenance` n'expose pas la nature. On les
 *   présente donc comme "à ventiler" et on laisse un flag d'avertissement.
 * - Les charges au niveau immeuble (`Charge`) ne sont pas allouées au lot
 *   ici : cela nécessite les tantièmes / clés de répartition, hors scope L4.
 */

import { buildLotRevenueBreakdown } from "@/lib/lot-revenue-breakdown";
import { prisma } from "@/lib/prisma";

export interface FiscalBeneficiaryLine {
  proprietaireId: string;
  proprietaireLabel: string;
  role: "PLEIN_PROPRIETAIRE" | "USUFRUITIER" | "NU_PROPRIETAIRE";
  /** Recettes brutes : à reporter ligne 211 du 2044 (ou 215 pour propriétés bâties). */
  recettes: number;
  /** Charges courantes déductibles imputables à ce bénéficiaire pour ce lot. */
  chargesDeductibles: number;
}

export interface FiscalGuidanceNote {
  level: "info" | "warning";
  text: string;
}

export interface LotFiscalSummary {
  lotId: string;
  year: number;
  isDismembered: boolean;
  hasOwnershipData: boolean;
  byBeneficiary: FiscalBeneficiaryLine[];
  /** Total des coûts de maintenance enregistrés sur le lot durant l'année (toutes natures confondues). */
  maintenanceCostTotal: number;
  /** Nombre d'opérations de maintenance sur la période. */
  maintenanceCount: number;
  /** Guides et alertes affichés à l'utilisateur. */
  notes: FiscalGuidanceNote[];
}

export async function buildLotFiscalSummary(
  societyId: string,
  lotId: string,
  year: number,
): Promise<LotFiscalSummary> {
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);

  const [revenueBreakdown, maintenances, activeOwnerships] = await Promise.all([
    buildLotRevenueBreakdown(societyId, lotId, from, to),
    prisma.maintenance.findMany({
      where: {
        lotId,
        building: { societyId },
        isPaid: true,
        OR: [
          { completedAt: { gte: from, lte: to } },
          {
            AND: [{ completedAt: null }, { scheduledAt: { gte: from, lte: to } }],
          },
        ],
      },
      select: { id: true, cost: true, completedAt: true, scheduledAt: true, title: true },
    }),
    prisma.lotOwnership.findMany({
      where: {
        societyId,
        lotId,
        startDate: { lte: to },
        OR: [{ endDate: null }, { endDate: { gt: to } }],
      },
      select: { type: true },
    }),
  ]);

  const ppCount = activeOwnerships.filter((o) => o.type === "PLEINE_PROPRIETE").length;

  const maintenanceCostTotal = round2(
    maintenances.reduce((s, m) => s + (m.cost ?? 0), 0),
  );

  const byBeneficiary: FiscalBeneficiaryLine[] = revenueBreakdown.byBeneficiary.map((line) => ({
    proprietaireId: line.proprietaireId,
    proprietaireLabel: line.proprietaireLabel,
    role: line.role,
    recettes: line.encaisse,
    // Sans catégorisation des maintenances, on n'attribue rien automatiquement.
    chargesDeductibles: 0,
  }));

  const notes: FiscalGuidanceNote[] = [];

  if (!revenueBreakdown.hasOwnershipData) {
    notes.push({
      level: "warning",
      text: "Aucun régime de propriété défini sur ce lot. Renseignez la pleine propriété ou le démembrement pour produire une synthèse fiscale.",
    });
  } else if (revenueBreakdown.isDismembered) {
    notes.push({
      level: "info",
      text: "Loyers et charges courantes : à déclarer par l'usufruitier (art. 578 et 605 CC). Gros travaux (art. 606 CC : grosses réparations) : à déclarer par le nu-propriétaire.",
    });
    notes.push({
      level: "info",
      text: "Intérêts d'emprunt : par défaut déductibles chez l'usufruitier, sauf convention prévoyant une déduction par le nu-propriétaire (CE 24 fév. 2017).",
    });
  } else if (ppCount > 1) {
    notes.push({
      level: "info",
      text: "Indivision en pleine propriété : chaque indivisaire déclare sa quote-part au prorata indiqué.",
    });
  }

  if (maintenanceCostTotal > 0) {
    if (revenueBreakdown.isDismembered) {
      notes.push({
        level: "warning",
        text: `${maintenances.length} opération(s) de maintenance pour un total de ${formatEur(maintenanceCostTotal)} : à ventiler manuellement entre charges courantes (usufruitier) et grosses réparations art. 606 CC (nu-propriétaire). Le module ne classe pas automatiquement.`,
      });
    } else {
      notes.push({
        level: "info",
        text: `${maintenances.length} opération(s) de maintenance pour un total de ${formatEur(maintenanceCostTotal)} : déductibles dans les limites du 2044 (frais de réparation et d'entretien).`,
      });
    }
  }

  return {
    lotId,
    year,
    isDismembered: revenueBreakdown.isDismembered,
    hasOwnershipData: revenueBreakdown.hasOwnershipData,
    byBeneficiary,
    maintenanceCostTotal,
    maintenanceCount: maintenances.length,
    notes,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatEur(n: number): string {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
