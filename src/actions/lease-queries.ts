"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  getOptionalSocietyActionContext,
} from "@/lib/action-society";
import { LEASE_INCLUDE } from "@/actions/lease-shared";
import { LEASE_SCOPED_DOCUMENT_CATEGORIES } from "@/lib/document-lease-association";

export async function getLeases(societyId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.lease.findMany({
    where: { societyId, deletedAt: null },
    include: LEASE_INCLUDE,
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    // Plafond défensif : au-delà de 500 baux, utiliser getLeasesPaginated
    take: 500,
  });
}

export async function getLeasesPaginated(
  societyId: string,
  opts: { page?: number; pageSize?: number; status?: string; search?: string } = {}
) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return { data: [], total: 0, page: 1, pageSize: 50 };

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const where: Prisma.LeaseWhereInput = { societyId, deletedAt: null };
  if (opts.status) where.status = opts.status as never;
  if (opts.search) {
    where.OR = [
      { tenant: { firstName: { contains: opts.search, mode: "insensitive" } } },
      { tenant: { lastName: { contains: opts.search, mode: "insensitive" } } },
      { tenant: { companyName: { contains: opts.search, mode: "insensitive" } } },
      { lot: { number: { contains: opts.search, mode: "insensitive" } } },
    ];
  }

  const [data, total] = await prisma.$transaction([
    prisma.lease.findMany({
      where,
      include: LEASE_INCLUDE,
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      take: pageSize,
      skip,
    }),
    prisma.lease.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

/**
 * Genere un numero de bail incrementale pour une societe.
 * Format: {PREFIX}-{ANNEE}-{NUMERO} (ex: BAIL-2026-0001)
 */

export async function getLeaseById(societyId: string, leaseId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return null;

  return prisma.lease.findFirst({
    where: { id: leaseId, societyId, deletedAt: null },
    include: {
      lot: {
        include: {
          building: {
            select: { id: true, name: true, city: true, postalCode: true },
          },
        },
      },
      leaseLots: {
        include: {
          lot: {
            include: {
              building: {
                select: { id: true, name: true, city: true, postalCode: true },
              },
            },
          },
        },
        orderBy: { isPrimary: "desc" },
      },
      tenant: true,
      tenantHistories: {
        orderBy: { startDate: "asc" },
        include: {
          tenant: {
            select: {
              id: true,
              entityType: true,
              companyName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          transferDocument: {
            select: { id: true, fileName: true, storagePath: true, fileUrl: true },
          },
        },
      },
      managingContact: {
        select: { id: true, name: true, company: true, email: true, phone: true, mobile: true },
      },
      rentRevisions: { orderBy: { effectiveDate: "desc" }, take: 10 },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          invoiceType: true,
          status: true,
          totalHT: true,
          dueDate: true,
          invoiceNumber: true,
        },
      },
      chargeProvisions: {
        orderBy: { startDate: "asc" },
        select: {
          id: true,
          label: true,
          monthlyAmount: true,
          vatRate: true,
          startDate: true,
          endDate: true,
          isActive: true,
        },
      },
      amendments: {
        orderBy: { amendmentNumber: "desc" },
        select: {
          id: true,
          amendmentNumber: true,
          effectiveDate: true,
          description: true,
          amendmentType: true,
          previousRentHT: true,
          newRentHT: true,
          previousEndDate: true,
          newEndDate: true,
          createdAt: true,
          documentId: true,
          document: {
            select: { id: true, fileName: true, fileUrl: true, storagePath: true },
          },
          otherChanges: true,
        },
      },
      documents: {
        where: { category: "avenant" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          storagePath: true,
          description: true,
          createdAt: true,
        },
      },
      signatureRequests: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          signerEmail: true,
          signerName: true,
          documentName: true,
          createdAt: true,
          signedAt: true,
          declinedAt: true,
          voidedAt: true,
        },
      },
      leaseTemplate: {
        select: { id: true, name: true, leaseType: true },
      },
      rentSteps: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          label: true,
          startDate: true,
          endDate: true,
          rentHT: true,
          chargesHT: true,
          position: true,
        },
      },
      inspections: {
        orderBy: { performedAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          performedAt: true,
          performedBy: true,
        },
      },
      legalEvents: {
        orderBy: { eventDate: "desc" },
        take: 10,
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          eventDate: true,
          status: true,
        },
      },
      _count: {
        select: {
          invoices: true,
          rentRevisions: true,
          inspections: true,
          amendments: true,
          rentSteps: true,
          legalEvents: true,
          tenantHistories: true,
        },
      },
    },
  });
}

export async function getLeaseFinancialSummary(societyId: string, leaseId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return null;

  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, societyId, deletedAt: null },
    select: { tenantId: true },
  });
  if (!lease) return null;

  const [invoices, adjustments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        tenantId: lease.tenantId,
        societyId,
        invoiceType: { not: "QUITTANCE" },
        status: { notIn: ["ANNULEE", "BROUILLON"] },
      },
      select: {
        id: true,
        totalHT: true,
        totalTTC: true,
        invoiceType: true,
        status: true,
        payments: {
          select: { amount: true },
        },
      },
    }),
    prisma.tenantBalanceAdjustment.findMany({
      where: { tenantId: lease.tenantId, societyId },
      select: { amount: true },
    }),
  ]);

  const totalFactureHT = invoices
    .filter((inv) => inv.invoiceType !== "AVOIR")
    .reduce((sum, inv) => sum + inv.totalHT, 0);
  const totalFactureTTC = invoices
    .filter((inv) => inv.invoiceType !== "AVOIR")
    .reduce((sum, inv) => sum + inv.totalTTC, 0);
  const totalAvoir = invoices
    .filter((inv) => inv.invoiceType === "AVOIR")
    .reduce((sum, inv) => sum + Math.abs(inv.totalTTC), 0);
  const totalEncaisse = invoices.reduce(
    (sum, inv) => sum + inv.payments.reduce((s, p) => s + p.amount, 0),
    0
  );

  let tenantBalance = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  for (const inv of invoices) {
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    if (inv.invoiceType === "AVOIR") {
      tenantBalance -= Math.abs(inv.totalTTC);
    } else {
      tenantBalance += inv.totalTTC - paid;
    }
  }
  tenantBalance = Math.round(tenantBalance * 100) / 100;

  const totalImpaye = Math.max(0, tenantBalance);
  const nbFactures = invoices.length;
  const nbImpayees = invoices.filter((inv) => ["EN_RETARD", "RELANCEE", "LITIGIEUX"].includes(inv.status)).length;

  return { totalFactureHT, totalFactureTTC, totalAvoir, totalEncaisse, totalImpaye, tenantBalance, nbFactures, nbImpayees };
}

export async function getLeaseDocuments(societyId: string, leaseId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, societyId, deletedAt: null },
    select: { tenantId: true, lotId: true },
  });
  if (!lease) return [];

  return prisma.document.findMany({
    where: {
      societyId,
      deletedAt: null,
      OR: [
        { leaseId },
        {
          leaseId: null,
          tenantId: lease.tenantId,
          category: { in: [...LEASE_SCOPED_DOCUMENT_CATEGORIES] },
        },
        {
          leaseId: null,
          lotId: lease.lotId,
          category: { in: [...LEASE_SCOPED_DOCUMENT_CATEGORIES] },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      storagePath: true,
      description: true,
      category: true,
      createdAt: true,
      fileSize: true,
    },
  });
}

export async function getRentSteps(societyId: string, leaseId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.leaseRentStep.findMany({
    where: { leaseId, lease: { societyId, deletedAt: null } },
    orderBy: { position: "asc" },
  });
}
