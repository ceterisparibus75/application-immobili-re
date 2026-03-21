"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import type {
  BuildingType,
  LotType,
  LeaseType,
  PaymentFrequency,
  IndexType,
  TenantEntityType,
} from "@prisma/client";

export type ImportBuildingInput = {
  existingId?: string;
  name: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  buildingType: BuildingType;
};

export type ImportLotInput = {
  number: string;
  lotType: LotType;
  area: number;
  floor?: string | null;
  position?: string | null;
};

export type ImportTenantInput = {
  existingId?: string;
  entityType: TenantEntityType;
  // Personne morale
  companyName?: string | null;
  companyLegalForm?: string | null;
  siret?: string | null;
  legalRepName?: string | null;
  legalRepTitle?: string | null;
  legalRepEmail?: string | null;
  legalRepPhone?: string | null;
  // Personne physique
  firstName?: string | null;
  lastName?: string | null;
  // Commun
  email: string;
  phone?: string | null;
  mobile?: string | null;
};

export type ImportLeaseInput = {
  leaseType: LeaseType;
  startDate: string;
  durationMonths: number;
  baseRentHT: number;
  depositAmount: number;
  paymentFrequency: PaymentFrequency;
  vatApplicable: boolean;
  vatRate: number;
  indexType?: IndexType | null;
  rentFreeMonths: number;
  entryFee: number;
  tenantWorksClauses?: string | null;
};

export type ImportInput = {
  building: ImportBuildingInput;
  lot: ImportLotInput;
  tenant: ImportTenantInput;
  lease: ImportLeaseInput;
};

export type ImportResult = {
  leaseId: string;
  buildingId: string;
  lotId: string;
  tenantId: string;
};

export async function importFromPdf(
  societyId: string,
  input: ImportInput
): Promise<ActionResult<ImportResult>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const result = await prisma.$transaction(async (tx) => {
      // 1. Immeuble
      let buildingId = input.building.existingId;
      if (!buildingId) {
        const building = await tx.building.create({
          data: {
            societyId,
            name: input.building.name,
            addressLine1: input.building.addressLine1,
            city: input.building.city,
            postalCode: input.building.postalCode,
            buildingType: input.building.buildingType,
          },
        });
        buildingId = building.id;
      } else {
        const existing = await tx.building.findFirst({ where: { id: buildingId, societyId } });
        if (!existing) throw new Error("Immeuble introuvable dans cette société");
      }

      // 2. Lot (toujours créé)
      const existingLot = await tx.lot.findFirst({
        where: { buildingId, number: input.lot.number },
      });
      if (existingLot) {
        throw new Error(`Le lot "${input.lot.number}" existe déjà dans cet immeuble`);
      }

      const lot = await tx.lot.create({
        data: {
          buildingId,
          number: input.lot.number,
          lotType: input.lot.lotType,
          area: input.lot.area,
          floor: input.lot.floor ?? null,
          position: input.lot.position ?? null,
          status: "VACANT",
        },
      });

      // 3. Locataire
      let tenantId = input.tenant.existingId;
      if (!tenantId) {
        const baseData = {
          societyId,
          entityType: input.tenant.entityType,
          email: input.tenant.email,
          phone: input.tenant.phone ?? null,
          mobile: input.tenant.mobile ?? null,
        };

        const specificData =
          input.tenant.entityType === "PERSONNE_MORALE"
            ? {
                companyName: input.tenant.companyName ?? "À compléter",
                companyLegalForm: input.tenant.companyLegalForm ?? null,
                siret: input.tenant.siret ?? null,
                legalRepName: input.tenant.legalRepName ?? null,
                legalRepTitle: input.tenant.legalRepTitle ?? null,
                legalRepEmail: input.tenant.legalRepEmail ?? null,
                legalRepPhone: input.tenant.legalRepPhone ?? null,
              }
            : {
                firstName: input.tenant.firstName ?? "À compléter",
                lastName: input.tenant.lastName ?? "À compléter",
              };

        const tenant = await tx.tenant.create({ data: { ...baseData, ...specificData } });
        tenantId = tenant.id;
      } else {
        const existing = await tx.tenant.findFirst({ where: { id: tenantId, societyId } });
        if (!existing) throw new Error("Locataire introuvable dans cette société");
      }

      // Check no active lease on this lot
      const activeLease = await tx.lease.findFirst({
        where: { lotId: lot.id, status: "EN_COURS" },
      });
      if (activeLease) throw new Error("Ce lot a déjà un bail actif");

      // 4. Bail
      const startDate = new Date(input.lease.startDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + input.lease.durationMonths);

      const lease = await tx.lease.create({
        data: {
          societyId,
          lotId: lot.id,
          tenantId,
          leaseType: input.lease.leaseType,
          status: "EN_COURS",
          startDate,
          endDate,
          durationMonths: input.lease.durationMonths,
          baseRentHT: input.lease.baseRentHT,
          currentRentHT: input.lease.baseRentHT,
          depositAmount: input.lease.depositAmount,
          paymentFrequency: input.lease.paymentFrequency,
          vatApplicable: input.lease.vatApplicable,
          vatRate: input.lease.vatRate,
          indexType: input.lease.indexType ?? null,
          rentFreeMonths: input.lease.rentFreeMonths,
          entryFee: input.lease.entryFee,
          tenantWorksClauses: input.lease.tenantWorksClauses ?? null,
        },
      });

      // 5. Mise à jour statut du lot
      await tx.lot.update({
        where: { id: lot.id },
        data: { status: "OCCUPE", currentRent: input.lease.baseRentHT },
      });

      return { leaseId: lease.id, buildingId: buildingId!, lotId: lot.id, tenantId: tenantId! };
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Import",
      entityId: result.leaseId,
      details: {
        source: "pdf_import",
        buildingId: result.buildingId,
        lotId: result.lotId,
        tenantId: result.tenantId,
        leaseId: result.leaseId,
      },
    });

    revalidatePath("/patrimoine/immeubles");
    revalidatePath("/patrimoine/lots");
    revalidatePath("/locataires");
    revalidatePath("/baux");

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    if (error instanceof Error) return { success: false, error: error.message };
    console.error("[importFromPdf]", error);
    return { success: false, error: "Erreur lors de l'import" };
  }
}
