import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { cookies } from "next/headers";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { PropertyValuationReport, RentValuationReport } from "@/lib/valuation/report-pdf";
import type { ValuationReportData, RentReportData } from "@/lib/valuation/report-pdf";
import { createAuditLog } from "@/lib/audit";
import type { AiValuationResult, AiRentValuationResult } from "@/lib/valuation/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) {
      return NextResponse.json({ error: "Société non sélectionnée" }, { status: 400 });
    }

    await requireSocietyAccess(session.user.id, societyId);

    const { id } = await params;
    const { searchParams } = new URL(_request.url);
    const type = searchParams.get("type") ?? "property";

    if (type === "rent") {
      return generateRentReport(id, societyId, session.user.id);
    }

    return generatePropertyReport(id, societyId, session.user.id);
  } catch (error) {
    console.error("[ValuationPDF]", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}

async function generatePropertyReport(
  valuationId: string,
  societyId: string,
  userId: string
): Promise<Response> {
  const valuation = await prisma.propertyValuation.findFirst({
    where: { id: valuationId, societyId },
    include: {
      building: true,
      society: { select: { name: true, legalForm: true, siret: true, addressLine1: true, city: true, postalCode: true } },
      aiAnalyses: { orderBy: { executedAt: "desc" } },
      expertReports: { orderBy: { reportDate: "desc" } },
      comparableSales: { orderBy: { saleDate: "desc" }, take: 20 },
    },
  });

  if (!valuation) {
    return NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });
  }

  // Récupérer les baux actifs
  const leases = await prisma.lease.findMany({
    where: {
      societyId,
      lot: { buildingId: valuation.buildingId },
      status: "EN_COURS",
    },
    include: {
      lot: { select: { number: true, lotType: true, area: true } },
      tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
    },
  });

  const totalArea = await prisma.lot.aggregate({
    where: { buildingId: valuation.buildingId },
    _sum: { area: true },
  });
  const occupiedArea = leases.reduce((sum, l) => sum + l.lot.area, 0);
  const totalAreaVal = totalArea._sum.area ?? 0;
  const occupancyRate = totalAreaVal > 0 ? (occupiedArea / totalAreaVal) * 100 : 0;

  const reportData: ValuationReportData = {
    society: {
      name: valuation.society.name,
      legalForm: valuation.society.legalForm,
      siret: valuation.society.siret,
      address: `${valuation.society.addressLine1}, ${valuation.society.postalCode} ${valuation.society.city}`,
    },
    building: {
      name: valuation.building.name,
      address: valuation.building.addressLine1,
      city: valuation.building.city,
      postalCode: valuation.building.postalCode,
      buildingType: valuation.building.buildingType,
      totalArea: valuation.building.totalArea,
      constructionYear: valuation.building.yearBuilt,
      acquisitionPrice: valuation.building.acquisitionPrice,
      acquisitionDate: valuation.building.acquisitionDate?.toISOString(),
    },
    valuation: {
      date: valuation.valuationDate.toISOString(),
      estimatedValueLow: valuation.estimatedValueLow,
      estimatedValueMid: valuation.estimatedValueMid,
      estimatedValueHigh: valuation.estimatedValueHigh,
      estimatedRentalValue: valuation.estimatedRentalValue,
      pricePerSqm: valuation.pricePerSqm,
      capitalizationRate: valuation.capitalizationRate,
    },
    leases: leases.map((l) => ({
      tenant: l.tenant.entityType === "PERSONNE_MORALE"
        ? l.tenant.companyName ?? "N/A"
        : `${l.tenant.firstName ?? ""} ${l.tenant.lastName ?? ""}`.trim() || "N/A",
      unitDescription: `Lot ${l.lot.number} — ${l.lot.lotType}`,
      area: l.lot.area,
      annualRent: l.currentRentHT * (l.paymentFrequency === "MENSUEL" ? 12 : l.paymentFrequency === "TRIMESTRIEL" ? 4 : l.paymentFrequency === "SEMESTRIEL" ? 2 : 1),
      leaseType: l.leaseType,
    })),
    occupancyRate: Math.round(occupancyRate * 10) / 10,
    totalAnnualRent: leases.reduce(
      (sum, l) => sum + l.currentRentHT * (l.paymentFrequency === "MENSUEL" ? 12 : l.paymentFrequency === "TRIMESTRIEL" ? 4 : l.paymentFrequency === "SEMESTRIEL" ? 2 : 1),
      0
    ),
    aiAnalyses: valuation.aiAnalyses.map((a) => {
      const structured = a.structuredResult as AiValuationResult | null;
      return {
        provider: a.provider,
        estimatedValue: a.estimatedValue,
        rentalValue: a.rentalValue,
        pricePerSqm: a.pricePerSqm,
        capRate: a.capRate,
        confidence: a.confidence,
        methodology: a.methodology,
        strengths: (a.strengths as string[]) ?? [],
        weaknesses: (a.weaknesses as string[]) ?? [],
        opportunities: (a.opportunities as string[]) ?? [],
        threats: (a.threats as string[]) ?? [],
        narrative: structured?.detailedNarrative ?? null,
        exploitationValue: structured?.summary?.exploitationValue ?? null,
        realisationValue: structured?.summary?.realisationValue ?? null,
        renovationCosts: structured?.summary?.renovationCosts ?? null,
        abatementPercent: structured?.summary?.abatementPercent ?? null,
        comparisonValue: structured?.methodology?.comparisonMethod?.resultValue ?? null,
        incomeValue: structured?.methodology?.incomeMethod?.resultValue ?? null,
        weightingRationale: structured?.methodology?.weightingRationale ?? null,
        marketContext: structured?.marketContext ?? null,
        recommendations: structured?.recommendations ?? [],
        caveats: structured?.caveats ?? [],
      };
    }),
    expertReports: valuation.expertReports.map((r) => ({
      expertName: r.expertName,
      reportDate: r.reportDate.toISOString(),
      estimatedValue: r.estimatedValue,
      methodology: r.methodology,
    })),
    comparables: valuation.comparableSales.map((c) => ({
      address: c.address,
      city: c.city,
      saleDate: c.saleDate.toISOString(),
      salePrice: c.salePrice,
      builtArea: c.builtArea,
      pricePerSqm: c.pricePerSqm,
      distanceKm: c.distanceKm,
    })),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(PropertyValuationReport, { data: reportData }) as any);

  await createAuditLog({
    societyId,
    userId,
    action: "GENERATE_PDF",
    entity: "PropertyValuation",
    entityId: valuationId,
  });

  const fileName = `Avis-Valeur-${valuation.building.name.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=300",
    },
  });
}

async function generateRentReport(
  rentValuationId: string,
  societyId: string,
  userId: string
): Promise<Response> {
  const valuation = await prisma.rentValuation.findFirst({
    where: { id: rentValuationId, societyId },
    include: {
      society: { select: { name: true, legalForm: true } },
      lease: {
        include: {
          lot: {
            include: {
              building: { select: { name: true, addressLine1: true, city: true, postalCode: true } },
            },
          },
          tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
        },
      },
      aiAnalyses: { orderBy: { executedAt: "desc" } },
      comparableRents: { orderBy: { rentDate: "desc" }, take: 15 },
    },
  });

  if (!valuation) {
    return NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });
  }

  const tenantName = valuation.lease.tenant.entityType === "PERSONNE_MORALE"
    ? valuation.lease.tenant.companyName ?? "N/A"
    : `${valuation.lease.tenant.firstName ?? ""} ${valuation.lease.tenant.lastName ?? ""}`.trim() || "N/A";

  // Convertir le loyer périodique en annuel pour cohérence avec les estimations IA
  const freqMultiplier: Record<string, number> = { MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1 };
  const multiplier = freqMultiplier[valuation.lease.paymentFrequency] ?? 12;
  const currentAnnualRentHT = valuation.lease.currentRentHT * multiplier;

  const reportData: RentReportData = {
    society: {
      name: valuation.society.name,
      legalForm: valuation.society.legalForm,
    },
    lease: {
      leaseType: valuation.lease.leaseType,
      startDate: valuation.lease.startDate.toISOString(),
      endDate: valuation.lease.endDate?.toISOString(),
      currentRentHT: currentAnnualRentHT,
      tenant: tenantName,
    },
    unit: {
      lotType: valuation.lease.lot.lotType,
      area: valuation.lease.lot.area,
      building: valuation.lease.lot.building.name,
      address: `${valuation.lease.lot.building.addressLine1}, ${valuation.lease.lot.building.postalCode} ${valuation.lease.lot.building.city}`,
    },
    valuation: {
      date: valuation.valuationDate.toISOString(),
      estimatedMarketRent: valuation.estimatedMarketRent,
      estimatedRentLow: valuation.estimatedRentLow,
      estimatedRentHigh: valuation.estimatedRentHigh,
      rentPerSqm: valuation.rentPerSqm,
      deviationPercent: valuation.deviationPercent,
    },
    aiAnalyses: valuation.aiAnalyses.map((a) => {
      const structured = a.structuredResult as AiRentValuationResult | null;
      return {
        provider: a.provider,
        estimatedRent: a.estimatedRent,
        rentPerSqm: a.rentPerSqm,
        confidence: a.confidence,
        methodology: a.methodology,
        strengths: (a.strengths as string[]) ?? [],
        weaknesses: (a.weaknesses as string[]) ?? [],
        opportunities: (a.opportunities as string[]) ?? [],
        threats: (a.threats as string[]) ?? [],
        narrative: structured?.detailedNarrative ?? null,
      };
    }),
    comparableRents: valuation.comparableRents.map((c) => ({
      address: c.address,
      city: c.city,
      annualRent: c.annualRent,
      area: c.area,
      rentPerSqm: c.rentPerSqm,
      distanceKm: c.distanceKm,
    })),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(RentValuationReport, { data: reportData }) as any);

  await createAuditLog({
    societyId,
    userId,
    action: "GENERATE_PDF",
    entity: "RentValuation",
    entityId: rentValuationId,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Evaluation-Loyer-${rentValuationId}.pdf"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=300",
    },
  });
}
