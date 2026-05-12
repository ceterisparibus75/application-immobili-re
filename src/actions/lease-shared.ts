import { prisma } from "@/lib/prisma";

// Helpers et constantes partagés — pas de "use server".

export function formatTenantName(tenant: {
  entityType: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return tenant.entityType === "PERSONNE_MORALE"
    ? (tenant.companyName ?? "Locataire")
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "Locataire";
}

export const LEASE_INCLUDE = {
  lot: {
    include: {
      building: { select: { id: true, name: true, addressLine1: true, postalCode: true, city: true } },
    },
  },
  leaseLots: {
    include: {
      lot: {
        include: {
          building: { select: { id: true, name: true, addressLine1: true, postalCode: true, city: true } },
        },
      },
    },
    orderBy: { isPrimary: "desc" as const },
  },
  tenant: {
    select: {
      id: true,
      entityType: true,
      companyName: true,
      firstName: true,
      lastName: true,
    },
  },
  rentRevisions: {
    where: { isValidated: true },
    orderBy: { effectiveDate: "desc" as const },
    take: 1,
    select: { effectiveDate: true },
  },
} as const;

export async function generateLeaseNumber(societyId: string): Promise<string> {
  const currentYear = new Date().getFullYear();

  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { leasePrefix: true, nextLeaseNumber: true, leaseNumberYear: true },
  });

  const prefix = society?.leasePrefix || "BAIL";
  let nextNumber = (society?.nextLeaseNumber ?? 0) + 1;

  // Reset compteur si nouvelle annee
  if (society?.leaseNumberYear !== currentYear) {
    nextNumber = 1;
  }

  await prisma.society.update({
    where: { id: societyId },
    data: {
      nextLeaseNumber: nextNumber,
      leaseNumberYear: currentYear,
    },
  });

  const paddedNumber = String(nextNumber).padStart(4, "0");
  return `${prefix}-${currentYear}-${paddedNumber}`;
}
