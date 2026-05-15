/**
 * Ventile les revenus encaissés et restant dus d'un lot entre ses bénéficiaires
 * effectifs en fonction du régime de propriété **à la date de chaque flux**.
 *
 * - Pour les paiements : on utilise `paidAt` pour résoudre l'usufruitier actif.
 * - Pour les factures non soldées : on utilise `issueDate` comme fallback de la
 *   date d'imputation, faute d'une notion d'encaissement effectif.
 *
 * Si un lot change de régime entre l'émission de la facture et l'encaissement,
 * le paiement va au bénéficiaire actif au moment du paiement (cohérent avec la
 * règle civile : l'usufruitier en place perçoit les fruits effectivement perçus).
 */

import { prisma } from "@/lib/prisma";
import { allocateAmount, snapshotOwnership, type OwnershipShare } from "@/lib/ownership";
import {
  REPORT_ACTIVE_INVOICE_STATUSES,
  REPORT_REVENUE_INVOICE_TYPES,
  getOutstandingAmount,
} from "@/lib/reports/invoice-metrics";

export interface BeneficiaryLine {
  proprietaireId: string;
  proprietaireLabel: string;
  role: "PLEIN_PROPRIETAIRE" | "USUFRUITIER" | "NU_PROPRIETAIRE";
  /** Loyers encaissés (paiements imputés à ce bénéficiaire selon date d'encaissement). */
  encaisse: number;
  /** Quittancement total (somme TTC des factures émises au profit de ce bénéficiaire). */
  quittance: number;
  /** Solde restant dû (factures non soldées). */
  outstanding: number;
}

export interface LotRevenueBreakdown {
  lotId: string;
  isDismembered: boolean;
  hasOwnershipData: boolean;
  totals: {
    encaisse: number;
    quittance: number;
    outstanding: number;
  };
  byBeneficiary: BeneficiaryLine[];
}

/**
 * Calcule la ventilation des loyers d'un lot sur une période donnée.
 * Période bornée par `from` / `to` (inclusives).
 */
export async function buildLotRevenueBreakdown(
  societyId: string,
  lotId: string,
  from: Date,
  to: Date,
): Promise<LotRevenueBreakdown> {
  const [ownershipRows, invoices] = await Promise.all([
    prisma.lotOwnership.findMany({
      where: { societyId, lotId },
      include: { proprietaire: { select: { id: true, label: true } } },
    }),
    prisma.invoice.findMany({
      where: {
        societyId,
        invoiceType: { in: [...REPORT_REVENUE_INVOICE_TYPES] },
        status: { in: [...REPORT_ACTIVE_INVOICE_STATUSES] },
        issueDate: { lte: to },
        lease: { lotId },
      },
      select: {
        id: true,
        issueDate: true,
        totalTTC: true,
        isThirdPartyManaged: true,
        expectedNetAmount: true,
        payments: { select: { amount: true, paidAt: true } },
      },
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

  // Agrégation par proprietaireId (rôle stocké en plus pour l'affichage)
  const aggregator = new Map<
    string,
    { proprietaireId: string; role: BeneficiaryLine["role"]; encaisse: number; quittance: number; outstanding: number }
  >();

  function addAllocation(
    bucket: "encaisse" | "quittance" | "outstanding",
    amount: number,
    at: Date,
  ) {
    if (amount === 0 || !Number.isFinite(amount)) return;
    const allocations = allocateAmount(amount, "REVENU", ownerships, at);
    for (const line of allocations) {
      const existing = aggregator.get(line.proprietaireId) ?? {
        proprietaireId: line.proprietaireId,
        role: line.role,
        encaisse: 0,
        quittance: 0,
        outstanding: 0,
      };
      existing[bucket] += line.amount;
      // Garder le rôle le plus récent observé pour ce proprio.
      existing.role = line.role;
      aggregator.set(line.proprietaireId, existing);
    }
  }

  for (const invoice of invoices) {
    addAllocation("quittance", invoice.totalTTC, invoice.issueDate);

    for (const payment of invoice.payments) {
      if (!payment.paidAt) continue;
      const paidAt = new Date(payment.paidAt);
      if (paidAt < from || paidAt > to) continue;
      addAllocation("encaisse", payment.amount ?? 0, paidAt);
    }

    const outstanding = getOutstandingAmount({
      totalTTC: invoice.totalTTC,
      isThirdPartyManaged: invoice.isThirdPartyManaged,
      expectedNetAmount: invoice.expectedNetAmount,
      payments: invoice.payments,
    });
    if (outstanding > 0) {
      addAllocation("outstanding", outstanding, invoice.issueDate);
    }
  }

  const snap = snapshotOwnership(ownerships, to);

  const byBeneficiary: BeneficiaryLine[] = Array.from(aggregator.values()).map((entry) => ({
    proprietaireId: entry.proprietaireId,
    proprietaireLabel: proprietaireLabels.get(entry.proprietaireId) ?? entry.proprietaireId,
    role: entry.role,
    encaisse: round2(entry.encaisse),
    quittance: round2(entry.quittance),
    outstanding: round2(entry.outstanding),
  }));

  // Tri stable : usufruitier en premier, puis nu-propriétaire, puis PP, puis alpha.
  const roleOrder: Record<BeneficiaryLine["role"], number> = {
    USUFRUITIER: 0,
    NU_PROPRIETAIRE: 1,
    PLEIN_PROPRIETAIRE: 2,
  };
  byBeneficiary.sort((a, b) => {
    const r = roleOrder[a.role] - roleOrder[b.role];
    if (r !== 0) return r;
    return a.proprietaireLabel.localeCompare(b.proprietaireLabel, "fr");
  });

  const totals = byBeneficiary.reduce(
    (acc, line) => ({
      encaisse: acc.encaisse + line.encaisse,
      quittance: acc.quittance + line.quittance,
      outstanding: acc.outstanding + line.outstanding,
    }),
    { encaisse: 0, quittance: 0, outstanding: 0 },
  );

  return {
    lotId,
    isDismembered: snap.isDismembered,
    hasOwnershipData: ownerships.length > 0,
    totals: {
      encaisse: round2(totals.encaisse),
      quittance: round2(totals.quittance),
      outstanding: round2(totals.outstanding),
    },
    byBeneficiary,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
