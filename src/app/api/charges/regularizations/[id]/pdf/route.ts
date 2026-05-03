import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { generateChargeStatementPdfBuffer } from "@/lib/charge-statement-pdf";
import { buildStorageFileName } from "@/lib/storage-path";

type ChargeStatementDetails = {
  occupancyStart?: string;
  occupancyEnd?: string;
  prorataDays?: number;
  categories?: Array<{
    categoryName: string;
    nature?: string;
    totalAmount?: number;
    recoverableAmount?: number;
    allocationMethod?: string;
    allocationRate?: number;
    tenantShare?: number;
  }>;
};

function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateOnlyIso(date: Date): string {
  const normalized = dayStart(date);
  const month = String(normalized.getMonth() + 1).padStart(2, "0");
  const day = String(normalized.getDate()).padStart(2, "0");
  return `${normalized.getFullYear()}-${month}-${day}`;
}

function clampOccupancyStart(periodStart: Date, leaseStart?: Date | null): string {
  const rawStart = leaseStart ?? periodStart;
  return dateOnlyIso(new Date(Math.max(dayStart(periodStart).getTime(), dayStart(rawStart).getTime())));
}

function clampOccupancyEnd(periodEnd: Date, leaseEnd?: Date | null): string {
  const rawEnd = leaseEnd ?? periodEnd;
  return dateOnlyIso(new Date(Math.min(dayStart(periodEnd).getTime(), dayStart(rawEnd).getTime())));
}

function tenantName(tenant: {
  entityType: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}): string {
  if (tenant.entityType === "PERSONNE_MORALE") return tenant.companyName ?? "Locataire";
  return `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "Locataire";
}

function normalizeCategories(details: ChargeStatementDetails | null) {
  return (details?.categories ?? []).map((category) => ({
    categoryName: category.categoryName,
    nature: category.nature ?? "RECUPERABLE",
    totalAmount: category.totalAmount ?? 0,
    recoverableAmount: category.recoverableAmount ?? 0,
    allocationMethod: category.allocationMethod ?? "PERSONNALISE",
    allocationRate: category.allocationRate ?? 0,
    tenantShare: category.tenantShare ?? 0,
  }));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeContext = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
    if (routeContext instanceof NextResponse) return routeContext;

    const { id } = await params;
    const regularization = await prisma.chargeRegularization.findFirst({
      where: { id, societyId: routeContext.societyId },
      include: {
        society: {
          select: {
            name: true,
            addressLine1: true,
            postalCode: true,
            city: true,
            email: true,
          },
        },
        lease: {
          include: {
            tenant: {
              select: {
                entityType: true,
                firstName: true,
                lastName: true,
                companyName: true,
              },
            },
            lot: {
              include: {
                building: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!regularization) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Décompte de charges introuvable" } }, { status: 404 });
    }

    const details = regularization.details as ChargeStatementDetails | null;
    const name = tenantName(regularization.lease.tenant);
    const pdfBuffer = await generateChargeStatementPdfBuffer({
      fiscalYear: regularization.fiscalYear,
      periodStart: regularization.periodStart.toISOString(),
      periodEnd: regularization.periodEnd.toISOString(),
      occupancyStart: details?.occupancyStart ?? clampOccupancyStart(regularization.periodStart, regularization.lease.startDate),
      occupancyEnd: details?.occupancyEnd ?? clampOccupancyEnd(regularization.periodEnd, regularization.lease.endDate),
      tenantName: name,
      lotNumber: regularization.lease.lot.number,
      buildingName: regularization.lease.lot.building.name,
      totalCharges: regularization.totalCharges,
      totalProvisions: regularization.totalProvisions,
      balance: regularization.balance,
      categories: normalizeCategories(details),
      prorataDays: details?.prorataDays ?? 365,
      society: regularization.society,
    });

    const filename = buildStorageFileName(
      ["decompte-charges", String(regularization.fiscalYear), name],
      "pdf",
      "decompte-charges"
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[charge-regularization-pdf]", error);
    return NextResponse.json(
      { error: { code: "PDF_ERROR", message: "Erreur lors de la génération du PDF" } },
      { status: 500 }
    );
  }
}
