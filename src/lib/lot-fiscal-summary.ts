/**
 * Synthèse fiscale annuelle d'un lot pour la déclaration des revenus fonciers
 * (formulaire 2044) en présence d'un démembrement.
 *
 * En l'absence de démembrement, tous les flux sont déclarés par le plein
 * propriétaire — la synthèse retombe alors sur un unique bénéficiaire.
 *
 * Classification des maintenances via `Maintenance.nature` :
 *  - ENTRETIEN_COURANT (art. 605 CC) → charge courante de l'usufruitier
 *  - GROSSE_REPARATION (art. 606 CC) → charge du nu-propriétaire
 *  - AMELIORATION → capital, non déductible des revenus fonciers
 *
 * Limites :
 * - Les charges au niveau immeuble (`Charge`) ne sont pas allouées au lot
 *   ici : cela nécessite les tantièmes / clés de répartition, hors scope.
 */

import { buildLotRevenueBreakdown } from "@/lib/lot-revenue-breakdown";
import {
  allocateAmount,
  snapshotOwnership,
  type CashflowImputation,
  type OwnershipShare,
} from "@/lib/ownership";
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
  /** Détail par nature (gros travaux, entretien, amélioration). */
  maintenanceByNature: {
    entretienCourant: number;
    grosseReparation: number;
    amelioration: number;
  };
  /** Guides et alertes affichés à l'utilisateur. */
  notes: FiscalGuidanceNote[];
}

const NATURE_TO_IMPUTATION: Record<string, CashflowImputation> = {
  ENTRETIEN_COURANT: "CHARGE_COURANTE",
  GROSSE_REPARATION: "GROS_TRAVAUX",
  AMELIORATION: "ACQUISITION",
};

export async function buildLotFiscalSummary(
  societyId: string,
  lotId: string,
  year: number,
): Promise<LotFiscalSummary> {
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);

  const [revenueBreakdown, maintenances, ownershipRows] = await Promise.all([
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
      select: {
        id: true,
        cost: true,
        completedAt: true,
        scheduledAt: true,
        title: true,
        nature: true,
      },
    }),
    prisma.lotOwnership.findMany({
      where: { societyId, lotId },
      include: { proprietaire: { select: { id: true, label: true } } },
    }),
  ]);

  const ownerships: OwnershipShare[] = ownershipRows.map((row) => ({
    proprietaireId: row.proprietaireId,
    type: row.type,
    share: row.share,
    startDate: row.startDate,
    endDate: row.endDate,
    isViager: row.isViager,
    usufruitierBirthDate: row.usufruitierBirthDate,
  }));
  const proprietaireLabels = new Map<string, string>();
  for (const row of ownershipRows) {
    proprietaireLabels.set(row.proprietaireId, row.proprietaire.label);
  }

  const snapshotAtYearEnd = snapshotOwnership(ownerships, to);
  const ppCount = snapshotAtYearEnd.full.length;

  // Agrégation maintenances par nature
  const maintenanceByNature = {
    entretienCourant: 0,
    grosseReparation: 0,
    amelioration: 0,
  };
  // Allocation des charges déductibles par bénéficiaire
  // (Map<proprietaireId, { role, charges }>)
  const chargesByBeneficiary = new Map<
    string,
    { role: FiscalBeneficiaryLine["role"]; charges: number }
  >();

  for (const m of maintenances) {
    const cost = m.cost ?? 0;
    if (cost === 0) continue;

    switch (m.nature) {
      case "ENTRETIEN_COURANT":
        maintenanceByNature.entretienCourant += cost;
        break;
      case "GROSSE_REPARATION":
        maintenanceByNature.grosseReparation += cost;
        break;
      case "AMELIORATION":
        maintenanceByNature.amelioration += cost;
        break;
    }

    // AMELIORATION = capital, non déductible des revenus fonciers
    if (m.nature === "AMELIORATION") continue;

    const imputation = NATURE_TO_IMPUTATION[m.nature];
    if (!imputation) continue;

    const flowDate = m.completedAt ?? m.scheduledAt ?? to;
    const allocations = allocateAmount(cost, imputation, ownerships, flowDate);

    for (const line of allocations) {
      const existing = chargesByBeneficiary.get(line.proprietaireId) ?? {
        role: line.role,
        charges: 0,
      };
      existing.charges += line.amount;
      existing.role = line.role;
      chargesByBeneficiary.set(line.proprietaireId, existing);
    }
  }

  // Construire byBeneficiary en fusionnant recettes (revenue breakdown) et
  // charges (maintenance allocation). On part de tous les propriétaires
  // mentionnés dans l'un ou l'autre.
  const allProprietaireIds = new Set<string>([
    ...revenueBreakdown.byBeneficiary.map((b) => b.proprietaireId),
    ...chargesByBeneficiary.keys(),
  ]);

  const byBeneficiary: FiscalBeneficiaryLine[] = Array.from(allProprietaireIds).map((proprietaireId) => {
    const revenueLine = revenueBreakdown.byBeneficiary.find((b) => b.proprietaireId === proprietaireId);
    const chargeLine = chargesByBeneficiary.get(proprietaireId);
    const role: FiscalBeneficiaryLine["role"] = revenueLine?.role ?? chargeLine?.role ?? "PLEIN_PROPRIETAIRE";
    return {
      proprietaireId,
      proprietaireLabel: proprietaireLabels.get(proprietaireId) ?? proprietaireId,
      role,
      recettes: revenueLine?.encaisse ?? 0,
      chargesDeductibles: round2(chargeLine?.charges ?? 0),
    };
  });

  // Tri stable : usufruitier > nu-propriétaire > plein propriétaire > alpha.
  const roleOrder: Record<FiscalBeneficiaryLine["role"], number> = {
    USUFRUITIER: 0,
    NU_PROPRIETAIRE: 1,
    PLEIN_PROPRIETAIRE: 2,
  };
  byBeneficiary.sort((a, b) => {
    const r = roleOrder[a.role] - roleOrder[b.role];
    if (r !== 0) return r;
    return a.proprietaireLabel.localeCompare(b.proprietaireLabel, "fr");
  });

  const maintenanceCostTotal = round2(
    maintenanceByNature.entretienCourant +
      maintenanceByNature.grosseReparation +
      maintenanceByNature.amelioration,
  );

  const notes: FiscalGuidanceNote[] = [];

  if (!revenueBreakdown.hasOwnershipData) {
    notes.push({
      level: "warning",
      text: "Aucun régime de propriété défini sur ce lot. Renseignez la pleine propriété ou le démembrement pour produire une synthèse fiscale.",
    });
  } else if (revenueBreakdown.isDismembered) {
    notes.push({
      level: "info",
      text: "Loyers et charges courantes : à déclarer par l'usufruitier (art. 578 et 605 CC). Grosses réparations art. 606 CC : à déclarer par le nu-propriétaire.",
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

  if (maintenanceByNature.amelioration > 0) {
    notes.push({
      level: "info",
      text: `Travaux d'amélioration pour ${formatEur(maintenanceByNature.amelioration)} : non déductibles des revenus fonciers (capital). À immobiliser, augmente la base du nu-propriétaire en cas de démembrement.`,
    });
  }

  return {
    lotId,
    year,
    isDismembered: revenueBreakdown.isDismembered,
    hasOwnershipData: revenueBreakdown.hasOwnershipData,
    byBeneficiary,
    maintenanceCostTotal,
    maintenanceCount: maintenances.length,
    maintenanceByNature: {
      entretienCourant: round2(maintenanceByNature.entretienCourant),
      grosseReparation: round2(maintenanceByNature.grosseReparation),
      amelioration: round2(maintenanceByNature.amelioration),
    },
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
