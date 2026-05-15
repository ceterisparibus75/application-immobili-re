/**
 * Récupère les charges immeuble allouées à un lot sur une période donnée.
 *
 * Utilisé par la synthèse fiscale (`lot-fiscal-summary.ts`) pour intégrer
 * les charges au niveau immeuble (taxe foncière, assurance, copropriété,
 * entretien commun…) dans le calcul des charges déductibles par lot.
 *
 * S'appuie sur les helpers purs de `charge-allocation.ts`.
 */

import {
  allocateChargeToLot,
  type ChargeCategoryForAllocation,
  type LotForAllocation,
} from "@/lib/charge-allocation";
import { prisma } from "@/lib/prisma";

export interface LotChargeAllocationLine {
  chargeId: string;
  categoryId: string;
  categoryName: string;
  date: Date;
  description: string;
  fullAmount: number;
  allocatedToLot: number;
}

export interface LotChargesAllocation {
  total: number;
  charges: LotChargeAllocationLine[];
}

/**
 * Pour un lot donné et une période, retourne le total des charges immeuble
 * (à la charge du propriétaire) allouées à ce lot selon la clé de
 * répartition de chaque catégorie de charge.
 */
export async function getLotChargesAllocated(
  societyId: string,
  lotId: string,
  from: Date,
  to: Date,
): Promise<LotChargesAllocation> {
  // 1. Récupérer le buildingId du lot
  const lot = await prisma.lot.findFirst({
    where: { id: lotId, building: { societyId } },
    select: { id: true, buildingId: true, area: true, commonShares: true },
  });
  if (!lot) return { total: 0, charges: [] };

  // 2. Charger tous les lots du building (nécessaire pour les méthodes de répartition)
  const buildingLots: LotForAllocation[] = await prisma.lot.findMany({
    where: { buildingId: lot.buildingId },
    select: { id: true, area: true, commonShares: true },
  });

  // 3. Charger les charges de l'immeuble sur la période, avec catégorie + clé(s)
  const charges = await prisma.charge.findMany({
    where: {
      societyId,
      buildingId: lot.buildingId,
      date: { gte: from, lte: to },
    },
    include: {
      category: {
        include: {
          allocationKeys: { include: { entries: true } },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  // 4. Pour chaque charge : calculer la part allouée à notre lot
  const lines: LotChargeAllocationLine[] = [];
  for (const charge of charges) {
    const category: ChargeCategoryForAllocation = {
      id: charge.category.id,
      nature: charge.category.nature,
      recoverableRate: charge.category.recoverableRate,
      allocationMethod: charge.category.allocationMethod,
      allocationKeys: charge.category.allocationKeys.map((k) => ({
        entries: k.entries.map((e) => ({ lotId: e.lotId, percentage: e.percentage })),
      })),
    };

    const allocatedToLot = allocateChargeToLot(
      { amount: charge.amount },
      category,
      lotId,
      buildingLots,
    );

    if (allocatedToLot === 0) continue;

    lines.push({
      chargeId: charge.id,
      categoryId: charge.categoryId,
      categoryName: charge.category.name,
      date: charge.date,
      description: charge.description,
      fullAmount: charge.amount,
      allocatedToLot,
    });
  }

  const total = round2(lines.reduce((s, l) => s + l.allocatedToLot, 0));
  return { total, charges: lines };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
