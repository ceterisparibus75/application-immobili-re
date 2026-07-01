"use server";

import { prisma } from "@/lib/prisma";
import {
  getOptionalSocietyActionContext,
  requireSocietyActionContext,
} from "@/lib/action-society";
import { getOptionalAuthenticatedActionContext } from "@/lib/action-auth";
import { getOptionalAccessibleActiveSocietyId } from "@/lib/active-society";
import { getCreditNoteAmount } from "@/actions/tenant-shared";

/**
 * Calcule le solde d'un locataire (montant dû).
 * Solde = ajustements manuels + factures TTC (hors annulées) - paiements - avoirs.
 * Un solde positif = le locataire doit de l'argent.
 */
export async function computeTenantBalance(societyId: string, tenantId: string): Promise<number> {
  await requireSocietyActionContext(societyId);

  const [invoices, adjustments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        societyId,
        tenantId,
        status: { notIn: ["ANNULEE", "BROUILLON"] },
        invoiceType: { not: "QUITTANCE" },
      },
      select: {
        totalTTC: true,
        invoiceType: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.tenantBalanceAdjustment.findMany({
      where: { societyId, tenantId },
      select: { amount: true },
    }),
  ]);

  let balance = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  for (const inv of invoices) {
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    if (inv.invoiceType === "AVOIR") {
      balance -= getCreditNoteAmount(inv.totalTTC);
    } else {
      balance += inv.totalTTC - paid;
    }
  }

  return Math.round(balance * 100) / 100;
}

/**
 * Calcule les soldes de plusieurs locataires en une seule requête optimisée.
 */
export async function computeTenantBalances(societyId: string, tenantIds: string[]): Promise<Map<string, number>> {
  if (tenantIds.length === 0) return new Map();

  const [invoices, adjustments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        societyId,
        tenantId: { in: tenantIds },
        status: { notIn: ["ANNULEE", "BROUILLON"] },
        invoiceType: { not: "QUITTANCE" },
      },
      select: {
        id: true,
        tenantId: true,
        totalTTC: true,
        invoiceType: true,
      },
    }),
    prisma.tenantBalanceAdjustment.findMany({
      where: { societyId, tenantId: { in: tenantIds } },
      select: { tenantId: true, amount: true },
    }),
  ]);

  const paymentTotals = invoices.length > 0
    ? await prisma.payment.groupBy({
        by: ["invoiceId"],
        where: { invoiceId: { in: invoices.map((inv) => inv.id) } },
        _sum: { amount: true },
      })
    : [];
  const paidByInvoice = new Map(paymentTotals.map((p) => [p.invoiceId, p._sum.amount ?? 0]));

  const balances = new Map<string, number>();
  for (const adjustment of adjustments) {
    balances.set(adjustment.tenantId, (balances.get(adjustment.tenantId) ?? 0) + adjustment.amount);
  }
  for (const inv of invoices) {
    const current = balances.get(inv.tenantId) ?? 0;
    const paid = paidByInvoice.get(inv.id) ?? 0;
    if (inv.invoiceType === "AVOIR") {
      balances.set(inv.tenantId, current - getCreditNoteAmount(inv.totalTTC));
    } else {
      balances.set(inv.tenantId, current + (inv.totalTTC - paid));
    }
  }

  // Arrondir
  for (const [id, val] of balances) {
    balances.set(id, Math.round(val * 100) / 100);
  }

  return balances;
}

export async function getTenantsPaginated(
  societyId: string,
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    filters?: Record<string, string>;
  } = {}
) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return { data: [], total: 0 };

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: Record<string, unknown> = { societyId, deletedAt: null };
  const andClauses: Record<string, unknown>[] = [];

  if (params.search) {
    const q = params.search;
    andClauses.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (params.filters?.status === "active") where.isActive = true;
  else if (params.filters?.status === "inactive") where.isActive = false;

  if (params.filters?.entityType) where.entityType = params.filters.entityType;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  if (params.filters?.portal === "active") {
    where.portalAccess = { is: { isActive: true } };
  } else if (params.filters?.portal === "no_access") {
    where.OR = [
      { portalAccess: { is: null } },
      { portalAccess: { is: { isActive: false } } },
    ];
  } else if (params.filters?.portal === "pending") {
    where.portalAccess = { is: { isActive: true, activationCode: { not: null } } };
  } else if (params.filters?.portal === "never_connected") {
    where.portalAccess = { is: { isActive: true, lastLoginAt: null } };
  } else if (params.filters?.portal === "recent") {
    where.portalAccess = { is: { isActive: true, lastLoginAt: { gte: thirtyDaysAgo } } };
  } else if (params.filters?.portal === "inactive_30") {
    where.portalAccess = { is: { isActive: true, lastLoginAt: { lt: thirtyDaysAgo } } };
  } else if (params.filters?.portal === "inactive_90") {
    where.portalAccess = { is: { isActive: true, lastLoginAt: { lt: ninetyDaysAgo } } };
  }

  if (params.filters?.dossier === "complete") {
    andClauses.push({
      NOT: { email: { contains: "a-renseigner", mode: "insensitive" } },
    });
    andClauses.push({
      OR: [
        {
          AND: [
            { entityType: "PERSONNE_MORALE" },
            { companyName: { not: null } },
            { companyName: { not: "" } },
            { companyLegalForm: { not: null } },
            { companyLegalForm: { not: "" } },
            { siret: { not: null } },
            { siret: { not: "" } },
            { companyAddress: { not: null } },
            { companyAddress: { not: "" } },
            { legalRepName: { not: null } },
            { legalRepName: { not: "" } },
            { OR: [
              { AND: [{ phone: { not: null } }, { phone: { not: "" } }] },
              { AND: [{ mobile: { not: null } }, { mobile: { not: "" } }] },
            ] },
          ],
        },
        {
          AND: [
            { entityType: "PERSONNE_PHYSIQUE" },
            { firstName: { not: null } },
            { firstName: { not: "" } },
            { lastName: { not: null } },
            { lastName: { not: "" } },
            { personalAddress: { not: null } },
            { personalAddress: { not: "" } },
            { OR: [
              { AND: [{ phone: { not: null } }, { phone: { not: "" } }] },
              { AND: [{ mobile: { not: null } }, { mobile: { not: "" } }] },
            ] },
          ],
        },
      ],
    });
  } else if (params.filters?.dossier === "critical") {
    andClauses.push({
      OR: [
        { email: { contains: "a-renseigner", mode: "insensitive" } },
        { entityType: "PERSONNE_MORALE", companyName: null },
        { entityType: "PERSONNE_MORALE", companyName: "" },
        { entityType: "PERSONNE_MORALE", siret: null },
        { entityType: "PERSONNE_MORALE", siret: "" },
        { entityType: "PERSONNE_MORALE", companyAddress: null },
        { entityType: "PERSONNE_MORALE", companyAddress: "" },
        { entityType: "PERSONNE_PHYSIQUE", firstName: null },
        { entityType: "PERSONNE_PHYSIQUE", firstName: "" },
        { entityType: "PERSONNE_PHYSIQUE", lastName: null },
        { entityType: "PERSONNE_PHYSIQUE", lastName: "" },
        { entityType: "PERSONNE_PHYSIQUE", personalAddress: null },
        { entityType: "PERSONNE_PHYSIQUE", personalAddress: "" },
      ],
    });
  } else if (params.filters?.dossier === "missing") {
    andClauses.push({
      OR: [
        { email: { contains: "a-renseigner", mode: "insensitive" } },
        { phone: null },
        { phone: "" },
        { mobile: null },
        { mobile: "" },
        { entityType: "PERSONNE_MORALE", companyName: null },
        { entityType: "PERSONNE_MORALE", companyName: "" },
        { entityType: "PERSONNE_MORALE", companyLegalForm: null },
        { entityType: "PERSONNE_MORALE", companyLegalForm: "" },
        { entityType: "PERSONNE_MORALE", siret: null },
        { entityType: "PERSONNE_MORALE", siret: "" },
        { entityType: "PERSONNE_MORALE", companyAddress: null },
        { entityType: "PERSONNE_MORALE", companyAddress: "" },
        { entityType: "PERSONNE_MORALE", legalRepName: null },
        { entityType: "PERSONNE_MORALE", legalRepName: "" },
        { entityType: "PERSONNE_PHYSIQUE", firstName: null },
        { entityType: "PERSONNE_PHYSIQUE", firstName: "" },
        { entityType: "PERSONNE_PHYSIQUE", lastName: null },
        { entityType: "PERSONNE_PHYSIQUE", lastName: "" },
        { entityType: "PERSONNE_PHYSIQUE", personalAddress: null },
        { entityType: "PERSONNE_PHYSIQUE", personalAddress: "" },
      ],
    });
  }
  if (andClauses.length > 0) where.AND = andClauses;

  // Build orderBy
  type OrderBy = Record<string, "asc" | "desc">;
  let orderBy: OrderBy[] = [{ companyName: "asc" }, { lastName: "asc" }];
  if (params.sortBy) {
    orderBy = [{ [params.sortBy]: params.sortOrder ?? "asc" }];
  }

  const [data, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      select: {
        id: true,
        entityType: true,
        companyName: true,
        companyLegalForm: true,
        siret: true,
        companyAddress: true,
        legalRepName: true,
        firstName: true,
        lastName: true,
        personalAddress: true,
        autoEntrepreneurSiret: true,
        email: true,
        phone: true,
        mobile: true,
        insuranceExpiresAt: true,
        riskIndicator: true,
        isActive: true,
        portalAccess: {
          select: {
            isActive: true,
            invitedAt: true,
            lastLoginAt: true,
            activationCode: true,
          },
        },
        _count: { select: { leases: true } },
        leases: {
          where: { status: "EN_COURS", deletedAt: null },
          select: {
            id: true,
            currentRentHT: true,
            startDate: true,
            lot: {
              select: {
                number: true,
                building: { select: { id: true, name: true, addressLine1: true, postalCode: true, city: true } },
              },
            },
          },
          orderBy: { startDate: "desc" },
          take: 3,
        },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.tenant.count({ where }),
  ]);

  // Calculer les soldes en batch pour éviter N+1
  const tenantIds = data.map((t) => t.id);
  const balances = await computeTenantBalances(societyId, tenantIds);
  const dataWithBalance = data.map((t) => ({
    ...t,
    balance: balances.get(t.id) ?? 0,
  }));

  return { data: dataWithBalance, total };
}

export async function getTenants(societyId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.tenant.findMany({
    where: { societyId, deletedAt: null },
    include: {
      _count: { select: { leases: true, documents: true } },
      leases: {
        where: { status: "EN_COURS", deletedAt: null },
        select: {
          id: true,
          currentRentHT: true,
          startDate: true,
          lot: {
            select: {
              number: true,
              building: { select: { name: true } },
            },
          },
        },
        orderBy: { startDate: "desc" },
        take: 3,
      },
    },
    orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
  });
}

export async function getActiveTenants(societyId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.tenant.findMany({
    where: { societyId, isActive: true, deletedAt: null },
    select: {
      id: true,
      entityType: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
    },
    orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
  });
}

export async function getTenantById(societyId: string, tenantId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return null;

  return prisma.tenant.findFirst({
    where: { id: tenantId, societyId, deletedAt: null },
    include: {
      leases: {
        where: { deletedAt: null },
        include: {
          lot: {
            include: { building: { select: { id: true, name: true, city: true } } },
          },
        },
        orderBy: { startDate: "desc" },
      },
      guarantees: true,
      documentChecklist: true,
      secondaryContacts: { orderBy: { name: "asc" } },
      portalAccess: {
        select: {
          isActive: true,
          lastLoginAt: true,
          invitedAt: true,
        },
      },
      _count: { select: { leases: true, documents: true } },
    },
  });
}

/**
 * Récupère le relevé de compte complet d'un locataire :
 * toutes les factures (appels de loyer, DG, régularisations, avoirs) et paiements.
 */
export async function getTenantAccountStatement(
  societyId: string,
  tenantId: string
) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return null;

  const [invoices, adjustments] = await Promise.all([
    prisma.invoice.findMany({
      where: { societyId, tenantId },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        status: true,
        issueDate: true,
        dueDate: true,
        periodStart: true,
        periodEnd: true,
        totalHT: true,
        totalVAT: true,
        totalTTC: true,
        payments: {
          select: {
            id: true,
            amount: true,
            paidAt: true,
            method: true,
            reference: true,
          },
          orderBy: { paidAt: "asc" },
        },
      },
      orderBy: { issueDate: "desc" },
    }),
    prisma.tenantBalanceAdjustment.findMany({
      where: { societyId, tenantId },
      select: {
        id: true,
        label: true,
        amount: true,
        dueDate: true,
        notes: true,
        reference: true,
        periodLabel: true,
        periodStart: true,
        periodEnd: true,
        balanceAfter: true,
        source: true,
        isReconciled: true,
        reconciledAt: true,
        reconciledBankTransactionId: true,
      },
      orderBy: { dueDate: "desc" },
    }),
  ]);

  // Charger les transactions bancaires liées aux reprises rapprochées pour
  // afficher la ligne "Paiement reprise" dans le compte locataire et calculer
  // un Total paiements / solde corrects.
  const reconciledTxIds = adjustments
    .map((adj) => adj.reconciledBankTransactionId)
    .filter((id): id is string => Boolean(id));
  const bankTransactions = reconciledTxIds.length
    ? await prisma.bankTransaction.findMany({
        where: { id: { in: reconciledTxIds } },
        select: { id: true, transactionDate: true, amount: true, label: true, reference: true },
      })
    : [];
  const txById = new Map(bankTransactions.map((tx) => [tx.id, tx]));

  // Enrichit chaque adjustment avec sa transaction bancaire éventuelle.
  const enrichedAdjustments = adjustments.map((adj) => ({
    ...adj,
    bankTransaction: adj.reconciledBankTransactionId
      ? txById.get(adj.reconciledBankTransactionId) ?? null
      : null,
  }));

  // Encaissements bancaires : on remonte les BankTransaction rapprochées avec
  // les Payment attachés aux factures de ce locataire pour rendre visible le
  // vrai flux (et surtout les surplus non affectés = crédits du client).
  const tenantInvoiceIds = invoices.map((inv) => inv.id);
  const tenantReconciliations = tenantInvoiceIds.length
    ? (await prisma.bankReconciliation.findMany({
        where: { payment: { invoiceId: { in: tenantInvoiceIds } } },
        select: {
          amount: true,
          transactionId: true,
          transaction: {
            select: {
              id: true,
              transactionDate: true,
              amount: true,
              label: true,
              reference: true,
            },
          },
          payment: { select: { invoiceId: true } },
        },
      })) ?? []
    : [];

  // Pour chaque transaction touchée, on a besoin du total réconcilié (toutes
  // affectations confondues, y compris à d'autres locataires) pour connaître
  // la part non affectée.
  const touchedTxIds = [...new Set(tenantReconciliations.map((r) => r.transactionId))];
  const totalReconciledByTx = touchedTxIds.length
    ? (await prisma.bankReconciliation.groupBy({
        by: ["transactionId"],
        where: { transactionId: { in: touchedTxIds } },
        _sum: { amount: true },
      })) ?? []
    : [];
  const totalReconciledMap = new Map(
    totalReconciledByTx.map((r) => [r.transactionId, Number(r._sum.amount ?? 0)]),
  );

  // Regrouper les réconciliations du locataire par transaction pour connaître
  // combien lui a été affecté et sur quelles factures.
  type TxAgg = {
    id: string;
    transactionDate: Date;
    label: string;
    reference: string | null;
    transactionAmount: number;
    allocatedToTenant: number;
    unallocated: number;
    invoiceNumbers: string[];
  };
  const invoiceNumberById = new Map(
    invoices.map((i) => [i.id, i.invoiceNumber ?? "brouillon"]),
  );
  const txAggMap = new Map<string, TxAgg>();
  for (const r of tenantReconciliations) {
    const tx = r.transaction;
    const existing = txAggMap.get(tx.id);
    const invNum = r.payment.invoiceId
      ? invoiceNumberById.get(r.payment.invoiceId) ?? null
      : null;
    if (existing) {
      existing.allocatedToTenant += Number(r.amount);
      if (invNum && !existing.invoiceNumbers.includes(invNum)) {
        existing.invoiceNumbers.push(invNum);
      }
    } else {
      const totalReconciled = totalReconciledMap.get(tx.id) ?? Number(r.amount);
      txAggMap.set(tx.id, {
        id: tx.id,
        transactionDate: tx.transactionDate,
        label: tx.label,
        reference: tx.reference,
        transactionAmount: Number(tx.amount),
        allocatedToTenant: Number(r.amount),
        // Part de la transaction qui n'est affectée à aucun paiement (ni ce
        // locataire, ni un autre). Positive => crédit disponible pour le
        // locataire (surplus versé).
        unallocated: Math.round((Number(tx.amount) - totalReconciled) * 100) / 100,
        invoiceNumbers: invNum ? [invNum] : [],
      });
    }
  }
  const bankOverpayments = [...txAggMap.values()]
    // Ne remonter que les vrais surplus (crédits en faveur du locataire) sur
    // des transactions entrantes (amount > 0 = encaissement).
    .filter((t) => t.transactionAmount > 0 && t.unallocated > 0.005)
    .map((t) => ({
      id: t.id,
      transactionDate: t.transactionDate,
      label: t.label,
      reference: t.reference,
      transactionAmount: t.transactionAmount,
      allocatedToTenant: Math.round(t.allocatedToTenant * 100) / 100,
      unallocated: t.unallocated,
      invoiceNumbers: t.invoiceNumbers,
    }));

  // Calculer le solde courant. Un adjustment réconcilié est considéré soldé
  // (le virement bancaire l'a réglé) et ne contribue plus au solde.
  let balance = enrichedAdjustments.reduce((sum, adjustment) => {
    if (adjustment.isReconciled) return sum;
    return sum + adjustment.amount;
  }, 0);
  for (const inv of invoices) {
    if (inv.status === "ANNULEE" || inv.status === "BROUILLON") continue;
    if (inv.invoiceType === "QUITTANCE") continue;
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    if (inv.invoiceType === "AVOIR") {
      balance -= getCreditNoteAmount(inv.totalTTC);
    } else {
      balance += inv.totalTTC - paid;
    }
  }
  // Les surplus bancaires non affectés viennent en déduction du solde dû
  // (ou créent un solde en faveur du locataire s'il n'y a rien à devoir).
  for (const op of bankOverpayments) {
    balance -= op.unallocated;
  }

  return {
    invoices,
    adjustments: enrichedAdjustments,
    bankOverpayments,
    balance: Math.round(balance * 100) / 100,
  };
}

export async function getTenantsForSelect(): Promise<{ id: string; name: string }[]> {
  const context = await getOptionalAuthenticatedActionContext();
  if (!context) return [];

  const societyId = await getOptionalAccessibleActiveSocietyId(context.userId);
  if (!societyId) return [];

  const tenants = await prisma.tenant.findMany({
    where: { societyId, isActive: true, deletedAt: null },
    select: { id: true, entityType: true, companyName: true, firstName: true, lastName: true },
    orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
  });

  return tenants.map((t) => ({
    id: t.id,
    name: t.entityType === "PERSONNE_MORALE"
      ? (t.companyName ?? "—")
      : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—",
  }));
}
