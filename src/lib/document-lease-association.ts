import { prisma } from "@/lib/prisma";

type DocumentAssociationInput = {
  societyId: string;
  category: string | null | undefined;
  mimeType: string | null | undefined;
  buildingId?: string | null;
  lotId?: string | null;
  leaseId?: string | null;
  tenantId?: string | null;
};

type ResolvedDocumentAssociation = {
  buildingId: string | null;
  lotId: string | null;
  leaseId: string | null;
  tenantId: string | null;
  shouldSyncLeasePdf: boolean;
};

const LEASE_PRIMARY_DOCUMENT_CATEGORY = "bail";

export async function resolveDocumentLeaseAssociation(
  input: DocumentAssociationInput
): Promise<ResolvedDocumentAssociation> {
  const category = input.category ?? "autre";
  const isPrimaryLeasePdf = category === LEASE_PRIMARY_DOCUMENT_CATEGORY && input.mimeType === "application/pdf";

  if (input.leaseId) {
    const lease = await prisma.lease.findFirst({
      where: { id: input.leaseId, societyId: input.societyId, deletedAt: null },
      select: { id: true, lotId: true, tenantId: true, leaseFileUrl: true },
    });

    if (!lease) {
      return {
        buildingId: input.buildingId ?? null,
        lotId: input.lotId ?? null,
        leaseId: input.leaseId,
        tenantId: input.tenantId ?? null,
        shouldSyncLeasePdf: false,
      };
    }

    return {
      buildingId: input.buildingId ?? null,
      lotId: input.lotId ?? lease.lotId,
      leaseId: lease.id,
      tenantId: input.tenantId ?? lease.tenantId,
      shouldSyncLeasePdf: isPrimaryLeasePdf && !lease.leaseFileUrl,
    };
  }

  if (input.tenantId && category === LEASE_PRIMARY_DOCUMENT_CATEGORY) {
    const activeLeases = await prisma.lease.findMany({
      where: {
        societyId: input.societyId,
        tenantId: input.tenantId,
        status: "EN_COURS",
        deletedAt: null,
      },
      orderBy: { startDate: "desc" },
      take: 2,
      select: { id: true, lotId: true, tenantId: true, leaseFileUrl: true },
    });

    if (activeLeases.length === 1) {
      const lease = activeLeases[0];
      return {
        buildingId: input.buildingId ?? null,
        lotId: input.lotId ?? lease.lotId,
        leaseId: lease.id,
        tenantId: input.tenantId,
        shouldSyncLeasePdf: isPrimaryLeasePdf && !lease.leaseFileUrl,
      };
    }
  }

  return {
    buildingId: input.buildingId ?? null,
    lotId: input.lotId ?? null,
    leaseId: null,
    tenantId: input.tenantId ?? null,
    shouldSyncLeasePdf: false,
  };
}
