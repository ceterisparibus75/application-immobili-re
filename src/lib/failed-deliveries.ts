import { prisma } from "@/lib/prisma";

/**
 * Une preuve d'envoi dont l'état final signale une non-livraison.
 * On considère qu'une facture est "en échec d'envoi" quand SA DERNIÈRE preuve
 * (la plus récente) est dans un de ces états — un renvoi ultérieur qui aurait
 * réussi (status = DELIVERED) masque la panne précédente.
 */
const FAILURE_STATUSES = ["BOUNCED", "COMPLAINED", "FAILED"] as const;
type FailureStatus = (typeof FAILURE_STATUSES)[number];

export type FailedInvoiceDelivery = {
  invoiceId: string;
  invoiceNumber: string | null;
  totalTTC: number;
  issueDate: Date;
  status: FailureStatus;
  recipientEmail: string;
  recipientName: string | null;
  failedAt: Date;
  errorMessage: string | null;
  tenantId: string | null;
  tenantName: string;
  buildingName: string | null;
};

function displayTenantName(tenant: {
  entityType?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}): string {
  if (tenant.displayName?.trim()) return tenant.displayName.trim();
  if (tenant.entityType === "PERSONNE_MORALE") {
    return tenant.companyName?.trim() || "—";
  }
  return `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "—";
}

/**
 * Liste les factures dont la dernière preuve d'envoi est en échec.
 * Rangées par date d'échec décroissante.
 */
export async function getInvoicesWithFailedDelivery(
  societyId: string
): Promise<FailedInvoiceDelivery[]> {
  // 1. Dernière preuve par facture (Prisma `distinct` sur invoiceId,
  //    trié par createdAt DESC → on garde la plus récente).
  const latestProofs = await prisma.emailDeliveryProof.findMany({
    where: {
      societyId,
      invoiceId: { not: null },
    },
    orderBy: [{ invoiceId: "asc" }, { createdAt: "desc" }],
    distinct: ["invoiceId"],
    select: {
      invoiceId: true,
      status: true,
      recipientEmail: true,
      recipientName: true,
      errorMessage: true,
      sentAt: true,
      bouncedAt: true,
      complainedAt: true,
    },
  });

  // 2. Filtrer sur les échecs
  const failed = latestProofs.filter((p) =>
    (FAILURE_STATUSES as readonly string[]).includes(p.status)
  );
  if (failed.length === 0) return [];

  // 3. Récupérer les factures associées (une seule requête)
  const invoiceIds = failed.map((p) => p.invoiceId!).filter(Boolean);
  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds }, societyId },
    select: {
      id: true,
      invoiceNumber: true,
      totalTTC: true,
      issueDate: true,
      tenantId: true,
      tenant: {
        select: {
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
      lease: {
        select: {
          lot: {
            select: {
              building: { select: { name: true, addressLine1: true } },
            },
          },
        },
      },
    },
  });
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));

  // 4. Composer
  const rows: FailedInvoiceDelivery[] = [];
  for (const proof of failed) {
    const invoice = invoiceById.get(proof.invoiceId!);
    if (!invoice) continue;
    rows.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalTTC: invoice.totalTTC,
      issueDate: invoice.issueDate,
      status: proof.status as FailureStatus,
      recipientEmail: proof.recipientEmail,
      recipientName: proof.recipientName,
      failedAt: proof.bouncedAt ?? proof.complainedAt ?? proof.sentAt,
      errorMessage: proof.errorMessage,
      tenantId: invoice.tenantId,
      tenantName: invoice.tenant ? displayTenantName(invoice.tenant) : "—",
      buildingName:
        invoice.lease?.lot?.building?.name ??
        invoice.lease?.lot?.building?.addressLine1 ??
        null,
    });
  }
  return rows.sort((a, b) => b.failedAt.getTime() - a.failedAt.getTime());
}
