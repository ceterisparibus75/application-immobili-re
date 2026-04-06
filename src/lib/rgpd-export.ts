import { prisma } from "@/lib/prisma";

export interface TenantExportData {
  tenant: Record<string, unknown>;
  leases: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  consents: Record<string, unknown>[];
}

export interface TenantDataExport {
  exportDate: string;
  societyId: string;
  requesterEmail: string;
  tenants: TenantExportData[];
}

/**
 * Exporte toutes les donnees personnelles d'un locataire identifie par email
 * dans le cadre d'une demande RGPD (droit d'acces / portabilite).
 *
 * Les donnees bancaires chiffrees (IBAN/BIC) sont remplacees par "[CHIFFRE]".
 * Les identifiants internes Prisma sont conserves pour la tracabilite mais les
 * champs purement techniques (updatedAt, indexes) sont omis.
 */
export async function exportTenantData(
  societyId: string,
  email: string
): Promise<TenantDataExport> {
  const tenants = await prisma.tenant.findMany({
    where: { societyId, email },
    include: {
      leases: {
        include: {
          lot: {
            select: {
              id: true,
              number: true,
              lotType: true,
              area: true,
              floor: true,
              description: true,
            },
          },
        },
      },
      invoices: {
        include: {
          lines: true,
          payments: true,
        },
      },
      documents: true,
    },
  });

  // Recuperer les consentements par email (pas lies a un tenant/society)
  const consents = await prisma.consent.findMany({
    where: { email },
  });

  const tenantsData: TenantExportData[] = tenants.map((tenant) => ({
    tenant: sanitizeTenant(tenant),
    leases: tenant.leases.map((lease) => sanitizeLease(lease)),
    invoices: tenant.invoices.map((invoice) => sanitizeInvoice(invoice)),
    payments: tenant.invoices.flatMap((invoice) =>
      invoice.payments.map((payment) => sanitizePayment(payment))
    ),
    documents: tenant.documents.map((doc) => sanitizeDocument(doc)),
    consents: consents.map((consent) => sanitizeConsent(consent)),
  }));

  return {
    exportDate: new Date().toISOString(),
    societyId,
    requesterEmail: email,
    tenants: tenantsData,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeTenant(tenant: any): Record<string, unknown> {
  return {
    id: tenant.id,
    createdAt: toISO(tenant.createdAt),
    entityType: tenant.entityType,
    isActive: tenant.isActive,
    // Personne morale
    companyName: tenant.companyName,
    companyLegalForm: tenant.companyLegalForm,
    siret: tenant.siret,
    siren: tenant.siren,
    codeAPE: tenant.codeAPE,
    vatNumber: tenant.vatNumber,
    companyAddress: tenant.companyAddress,
    shareCapital: tenant.shareCapital,
    legalRepName: tenant.legalRepName,
    legalRepTitle: tenant.legalRepTitle,
    legalRepEmail: tenant.legalRepEmail,
    legalRepPhone: tenant.legalRepPhone,
    // Personne physique
    lastName: tenant.lastName,
    firstName: tenant.firstName,
    birthDate: toISO(tenant.birthDate),
    birthPlace: tenant.birthPlace,
    personalAddress: tenant.personalAddress,
    autoEntrepreneurSiret: tenant.autoEntrepreneurSiret,
    // Commun
    email: tenant.email,
    billingEmail: tenant.billingEmail,
    phone: tenant.phone,
    mobile: tenant.mobile,
    language: tenant.language,
    riskIndicator: tenant.riskIndicator,
    notes: tenant.notes,
    // Assurance
    insuranceExpiresAt: toISO(tenant.insuranceExpiresAt),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeLease(lease: any): Record<string, unknown> {
  return {
    id: lease.id,
    createdAt: toISO(lease.createdAt),
    leaseType: lease.leaseType,
    status: lease.status,
    startDate: toISO(lease.startDate),
    endDate: toISO(lease.endDate),
    durationMonths: lease.durationMonths,
    baseRentHT: lease.baseRentHT,
    currentRentHT: lease.currentRentHT,
    depositAmount: lease.depositAmount,
    paymentFrequency: lease.paymentFrequency,
    billingTerm: lease.billingTerm,
    vatApplicable: lease.vatApplicable,
    vatRate: lease.vatRate,
    indexType: lease.indexType,
    entryDate: toISO(lease.entryDate),
    exitDate: toISO(lease.exitDate),
    depositReceivedAt: toISO(lease.depositReceivedAt),
    depositReturnedAt: toISO(lease.depositReturnedAt),
    depositReturnAmount: lease.depositReturnAmount,
    lot: lease.lot
      ? {
          number: lease.lot.number,
          lotType: lease.lot.lotType,
          area: lease.lot.area,
          floor: lease.lot.floor,
          description: lease.lot.description,
        }
      : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeInvoice(invoice: any): Record<string, unknown> {
  return {
    id: invoice.id,
    createdAt: toISO(invoice.createdAt),
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: invoice.invoiceType,
    status: invoice.status,
    issueDate: toISO(invoice.issueDate),
    dueDate: toISO(invoice.dueDate),
    periodStart: toISO(invoice.periodStart),
    periodEnd: toISO(invoice.periodEnd),
    totalHT: invoice.totalHT,
    totalVAT: invoice.totalVAT,
    totalTTC: invoice.totalTTC,
    sentAt: toISO(invoice.sentAt),
    lines: invoice.lines?.map((line: Record<string, unknown>) => ({
      label: line.label,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      vatRate: line.vatRate,
      totalHT: line.totalHT,
      totalVAT: line.totalVAT,
      totalTTC: line.totalTTC,
    })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizePayment(payment: any): Record<string, unknown> {
  return {
    id: payment.id,
    createdAt: toISO(payment.createdAt),
    amount: payment.amount,
    paidAt: toISO(payment.paidAt),
    method: payment.method,
    reference: payment.reference,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeDocument(doc: any): Record<string, unknown> {
  return {
    id: doc.id,
    createdAt: toISO(doc.createdAt),
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    category: doc.category,
    description: doc.description,
    expiresAt: toISO(doc.expiresAt),
    // Pas d'URL directe — le fichier doit etre demande via l'API securisee
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeConsent(consent: any): Record<string, unknown> {
  return {
    id: consent.id,
    createdAt: toISO(consent.createdAt),
    email: consent.email,
    purpose: consent.purpose,
    isGranted: consent.isGranted,
    revokedAt: toISO(consent.revokedAt),
  };
}

function toISO(date: Date | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toISOString();
}
