"use server";

import { prisma } from "@/lib/prisma";
import { getOptionalSocietyActionContext } from "@/lib/action-society";

export async function getInvoices(societyId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.invoice.findMany({
    where: { societyId },
    include: {
      tenant: {
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
          billingEmail: true,
        },
      },
      lease: {
        include: {
          lot: {
            include: {
              building: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
      _count: { select: { payments: true } },
    },
    orderBy: [{ dueDate: "desc" }],
  });
}

export async function getInvoiceById(societyId: string, invoiceId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return null;

  return prisma.invoice.findFirst({
    where: { id: invoiceId, societyId },
    include: {
      tenant: {
        include: {
          sepaMandates: {
            where: { status: "ACTIVE" },
            select: { id: true, mandateReference: true, ibanLast4: true },
            take: 1,
          },
        },
      },
      society: {
        select: {
          name: true,
          legalForm: true,
          siret: true,
          email: true,
          vatNumber: true,
          vatRegime: true,
          logoUrl: true,
          legalMentions: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          postalCode: true,
          country: true,
          phone: true,
          shareCapital: true,
          signatoryName: true,
          ibanEncrypted: true,
          bicEncrypted: true,
          bankName: true,
        },
      },
      lease: {
        select: {
          id: true,
          lot: {
            select: {
              number: true,
              building: {
                select: {
                  name: true,
                  addressLine1: true,
                  postalCode: true,
                  city: true,
                  country: true,
                },
              },
            },
          },
        },
      },
      lines: true,
      payments: { orderBy: { paidAt: "desc" } },
      creditNoteFor: { select: { id: true, invoiceNumber: true } },
      creditNotes: { select: { id: true, invoiceNumber: true } },
    },
  });
}

/**
 * Retourne les baux actifs avec les infos nécessaires pour la facturation.
 */
export async function getActiveLeasesForInvoicing(societyId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.lease.findMany({
    where: { societyId, status: "EN_COURS" },
    select: {
      id: true,
      startDate: true,
      paymentFrequency: true,
      billingTerm: true,
      currentRentHT: true,
      baseRentHT: true,
      vatApplicable: true,
      vatRate: true,
      rentFreeMonths: true,
      progressiveRent: true,
      rentSteps: {
        orderBy: { position: "asc" as const },
        select: { startDate: true, endDate: true, rentHT: true },
      },
      tenant: {
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          mobile: true,
        },
      },
      lot: {
        select: {
          number: true,
          building: { select: { name: true, city: true } },
        },
      },
    },
    orderBy: [
      { lot: { building: { name: "asc" } } },
      { tenant: { lastName: "asc" } },
    ],
  });
}

/**
 * Récupère les données d'un bail pour pré-remplir le formulaire de facturation.
 */
export async function getLeaseForInvoice(societyId: string, leaseId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return null;

  return prisma.lease.findFirst({
    where: { id: leaseId, societyId, status: "EN_COURS" },
    select: {
      id: true,
      startDate: true,
      paymentFrequency: true,
      billingTerm: true,
      currentRentHT: true,
      vatApplicable: true,
      vatRate: true,
      rentFreeMonths: true,
      progressiveRent: true,
      rentSteps: {
        orderBy: { position: "asc" as const },
        select: { startDate: true, endDate: true, rentHT: true },
      },
      tenantId: true,
      tenant: {
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
        },
      },
      lot: {
        select: {
          number: true,
          building: { select: { name: true, city: true } },
        },
      },
    },
  });
}
