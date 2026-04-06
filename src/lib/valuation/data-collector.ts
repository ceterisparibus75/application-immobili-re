import { prisma } from "@/lib/prisma";
import type { ValuationInput, RentValuationInput } from "./types";

/**
 * Collecte les données d'un immeuble pour alimenter l'IA d'évaluation.
 * Les vérifications de permissions sont faites au niveau de l'action appelante.
 */
export async function collectBuildingData(
  societyId: string,
  buildingId: string
): Promise<ValuationInput> {
  const building = await prisma.building.findFirstOrThrow({
    where: { id: buildingId, societyId },
    include: {
      lots: {
        include: {
          leases: {
            where: { status: "EN_COURS" },
            include: {
              tenant: {
                select: {
                  firstName: true,
                  lastName: true,
                  companyName: true,
                  entityType: true,
                },
              },
            },
          },
        },
      },
      charges: {
        where: {
          date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
        },
        include: {
          category: { select: { nature: true } },
        },
      },
      maintenances: {
        where: {
          scheduledAt: { gte: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) },
        },
        select: {
          title: true,
          cost: true,
          scheduledAt: true,
        },
      },
    },
  });

  // Calcul des lots occupés vs vacants
  const occupiedLots = building.lots.filter((lot) => lot.status === "OCCUPE");
  const vacantLots = building.lots.filter((lot) => lot.status === "VACANT");
  const totalArea = building.lots.reduce((sum, lot) => sum + lot.area, 0);
  const occupiedArea = occupiedLots.reduce((sum, lot) => sum + lot.area, 0);

  // Baux en cours
  const activeLeases = building.lots.flatMap((lot) =>
    lot.leases.map((lease) => ({
      tenant: getTenantName(lease.tenant),
      unitDescription: `Lot ${lot.number} — ${lot.lotType}`,
      area: lot.area,
      annualRent: lease.currentRentHT * getAnnualMultiplier(lease.paymentFrequency),
      startDate: lease.startDate.toISOString().split("T")[0],
      endDate: lease.endDate?.toISOString().split("T")[0],
      leaseType: lease.leaseType,
      indexationType: lease.indexType ?? undefined,
    }))
  );

  const totalAnnualRent = activeLeases.reduce((sum, l) => sum + l.annualRent, 0);

  // Charges annuelles par nature
  const annualCharges = building.charges
    .filter((c) => c.category.nature === "PROPRIETAIRE" || c.category.nature === "MIXTE")
    .reduce((sum, c) => sum + c.amount, 0);

  // Travaux récents
  const recentWorks = building.maintenances
    .filter((m) => m.scheduledAt != null)
    .map((m) => ({
      description: m.title,
      amount: m.cost ?? 0,
      date: m.scheduledAt!.toISOString().split("T")[0],
    }));

  // Récupérer les rapports d'experts existants s'il y a déjà des évaluations
  const existingReports = await prisma.expertReport.findMany({
    where: {
      valuation: { buildingId, societyId },
    },
    select: {
      expertName: true,
      reportDate: true,
      estimatedValue: true,
      methodology: true,
      extractedData: true,
    },
    take: 5,
    orderBy: { reportDate: "desc" },
  });

  // Récupérer les comparables existants
  const existingComparables = await prisma.comparableSale.findMany({
    where: {
      valuation: { buildingId, societyId },
    },
    select: {
      address: true,
      saleDate: true,
      salePrice: true,
      builtArea: true,
      pricePerSqm: true,
      distanceKm: true,
      propertyType: true,
    },
    take: 20,
    orderBy: { saleDate: "desc" },
  });

  return {
    building: {
      name: building.name,
      address: `${building.addressLine1}${building.addressLine2 ? `, ${building.addressLine2}` : ""}`,
      city: building.city,
      postalCode: building.postalCode,
      country: building.country,
      buildingType: building.buildingType,
      constructionYear: building.yearBuilt ?? undefined,
      totalUsableArea: building.totalArea ?? totalArea,
      numberOfUnits: building.lots.length,
      acquisitionPrice: building.acquisitionPrice ?? undefined,
      acquisitionDate: building.acquisitionDate?.toISOString().split("T")[0],
      marketValue: building.marketValue ?? undefined,
      description: building.description ?? undefined,
      latitude: building.latitude ?? undefined,
      longitude: building.longitude ?? undefined,
    },
    occupancy: {
      occupancyRate: totalArea > 0 ? (occupiedArea / totalArea) * 100 : 0,
      totalAnnualRent,
      totalAnnualCharges: annualCharges,
      leases: activeLeases,
      vacantUnits: vacantLots.map((lot) => ({
        description: `Lot ${lot.number} — ${lot.lotType}`,
        area: lot.area,
        estimatedMarketRent: lot.marketRentValue ?? undefined,
      })),
    },
    financials: {
      annualCharges: annualCharges || undefined,
      recentWorks: recentWorks.length > 0 ? recentWorks : undefined,
    },
    expertReports: existingReports.length > 0
      ? existingReports.map((r) => ({
          expertName: r.expertName,
          reportDate: r.reportDate.toISOString().split("T")[0],
          estimatedValue: r.estimatedValue ?? 0,
          methodology: r.methodology ?? "Non précisée",
          keyFindings: extractKeyFindings(r.extractedData),
        }))
      : undefined,
    comparables: existingComparables.length > 0
      ? existingComparables.map((c) => ({
          address: c.address,
          saleDate: c.saleDate.toISOString().split("T")[0],
          salePrice: c.salePrice,
          area: c.builtArea ?? 0,
          pricePerSqm: c.pricePerSqm ?? 0,
          distance: c.distanceKm ?? 0,
          propertyType: c.propertyType,
        }))
      : undefined,
  };
}

/**
 * Collecte les données d'un bail pour alimenter l'IA d'évaluation des loyers.
 */
export async function collectLeaseData(
  societyId: string,
  leaseId: string
): Promise<RentValuationInput> {
  const lease = await prisma.lease.findFirstOrThrow({
    where: { id: leaseId, societyId },
    include: {
      lot: {
        include: {
          building: {
            select: {
              name: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              postalCode: true,
              buildingType: true,
              yearBuilt: true,
              totalArea: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      },
      tenant: {
        select: {
          entityType: true,
          firstName: true,
          lastName: true,
          companyName: true,
        },
      },
    },
  });

  const b = lease.lot.building;

  return {
    lease: {
      leaseType: lease.leaseType,
      startDate: lease.startDate.toISOString().split("T")[0],
      endDate: lease.endDate?.toISOString().split("T")[0],
      durationMonths: lease.durationMonths,
      currentRentHT: lease.currentRentHT,
      baseRentHT: lease.baseRentHT,
      paymentFrequency: lease.paymentFrequency,
      vatApplicable: lease.vatApplicable,
      vatRate: lease.vatRate,
      indexType: lease.indexType ?? undefined,
      baseIndexValue: lease.baseIndexValue ?? undefined,
      rentFreeMonths: lease.rentFreeMonths ?? undefined,
      entryFee: lease.entryFee ?? undefined,
    },
    unit: {
      lotType: lease.lot.lotType,
      area: lease.lot.area,
      floor: lease.lot.floor ?? undefined,
      description: lease.lot.description ?? undefined,
      marketRentValue: lease.lot.marketRentValue ?? undefined,
    },
    building: {
      name: b.name,
      address: `${b.addressLine1}${b.addressLine2 ? `, ${b.addressLine2}` : ""}`,
      city: b.city,
      postalCode: b.postalCode,
      buildingType: b.buildingType,
      constructionYear: b.yearBuilt ?? undefined,
      totalUsableArea: b.totalArea ?? undefined,
    },
    tenant: {
      entityType: lease.tenant.entityType,
      name: getTenantName(lease.tenant),
    },
  };
}

// ============================================================
// Helpers
// ============================================================

function getTenantName(tenant: {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  entityType: string;
}): string {
  if (tenant.entityType === "PERSONNE_MORALE" && tenant.companyName) {
    return tenant.companyName;
  }
  return [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") || "N/A";
}

function getAnnualMultiplier(frequency: string): number {
  switch (frequency) {
    case "MENSUEL":
      return 12;
    case "TRIMESTRIEL":
      return 4;
    case "SEMESTRIEL":
      return 2;
    case "ANNUEL":
      return 1;
    default:
      return 12;
  }
}

function extractKeyFindings(extractedData: unknown): string {
  if (
    typeof extractedData === "object" &&
    extractedData !== null &&
    "keyFindings" in extractedData &&
    typeof (extractedData as Record<string, unknown>).keyFindings === "string"
  ) {
    return (extractedData as Record<string, unknown>).keyFindings as string;
  }
  return "Voir rapport complet";
}
