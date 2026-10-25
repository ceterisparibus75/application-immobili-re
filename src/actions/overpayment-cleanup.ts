"use server";

/**
 * Nettoyage administrateur des TenantBalanceAdjustment « Avoir — trop-perçu
 * sur virement » créées à tort par la version précédente du rapprochement
 * bancaire (double comptabilisation du crédit : virement + reprise).
 *
 * Depuis le commit « fix(rapprochement): ne plus doubler le crédit… », ces
 * ajustements ne sont plus créés, mais l'historique en base reste à purger
 * pour corriger les soldes affichés.
 *
 * Rôle requis : ADMIN_SOCIETE par société.
 */

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import { requireAuthenticatedActionContext } from "@/lib/action-auth";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

const BUGGY_LABEL = "Avoir — trop-perçu sur virement";

export type OverpaymentAdjustment = {
  id: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  dueDate: Date;
  notes: string | null;
  reference: string | null;
  reconciledBankTransactionId: string | null;
};

export type OverpaymentGroup = {
  societyId: string;
  societyName: string;
  count: number;
  totalCredited: number;
  adjustments: OverpaymentAdjustment[];
};

/**
 * Liste tous les TenantBalanceAdjustment de type « trop-perçu » créés par
 * l'ancien rapprochement, groupés par société. Un ADMIN_SOCIETE ne voit que
 * sa société ; un SUPER_ADMIN voit toutes celles où il a au moins un accès.
 */
export async function listOverpaymentAdjustments(): Promise<ActionResult<OverpaymentGroup[]>> {
  try {
    const context = await requireAuthenticatedActionContext();

    const memberships = await prisma.userSociety.findMany({
      where: {
        userId: context.userId,
        role: { in: ["SUPER_ADMIN", "ADMIN_SOCIETE"] },
      },
      select: { societyId: true },
    });
    const allowedSocietyIds = memberships.map((m) => m.societyId);
    if (allowedSocietyIds.length === 0) return { success: true, data: [] };

    const rows = await prisma.tenantBalanceAdjustment.findMany({
      where: {
        societyId: { in: allowedSocietyIds },
        label: BUGGY_LABEL,
        source: "BANK_RECONCILIATION",
        reconciledBankTransactionId: { not: null },
      },
      select: {
        id: true,
        societyId: true,
        tenantId: true,
        amount: true,
        dueDate: true,
        notes: true,
        reference: true,
        reconciledBankTransactionId: true,
        society: { select: { name: true } },
        tenant: { select: { displayName: true } },
      },
      orderBy: [{ societyId: "asc" }, { dueDate: "asc" }],
      take: 5000,
    });

    const groups = new Map<string, OverpaymentGroup>();
    for (const r of rows) {
      const amount = Number(r.amount);
      const entry: OverpaymentAdjustment = {
        id: r.id,
        tenantId: r.tenantId,
        tenantName: r.tenant?.displayName ?? "—",
        amount,
        dueDate: r.dueDate,
        notes: r.notes,
        reference: r.reference,
        reconciledBankTransactionId: r.reconciledBankTransactionId,
      };
      const existing = groups.get(r.societyId);
      if (existing) {
        existing.adjustments.push(entry);
        existing.count += 1;
        existing.totalCredited += Math.abs(amount);
      } else {
        groups.set(r.societyId, {
          societyId: r.societyId,
          societyName: r.society?.name ?? "—",
          count: 1,
          totalCredited: Math.abs(amount),
          adjustments: [entry],
        });
      }
    }

    return { success: true, data: Array.from(groups.values()) };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[listOverpaymentAdjustments]", error);
    return { success: false, error: "Erreur lors du chargement" };
  }
}

/**
 * Supprime les ajustements fantômes d'une société. Garde-fous :
 * - rôle ADMIN_SOCIETE requis sur la société
 * - seuls les enregistrements avec le label buggy, source BANK_RECONCILIATION,
 *   et un reconciledBankTransactionId non nul sont supprimés
 * - si `ids` est fourni, limite la suppression à ces ids (toujours scopés
 *   par société pour éviter la fuite inter-tenant)
 */
export async function deleteOverpaymentAdjustments(
  societyId: string,
  ids?: string[],
): Promise<ActionResult<{ deleted: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const where = {
      societyId,
      label: BUGGY_LABEL,
      source: "BANK_RECONCILIATION",
      reconciledBankTransactionId: { not: null },
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    } as const;

    const toDelete = await prisma.tenantBalanceAdjustment.findMany({
      where,
      select: { id: true, tenantId: true, amount: true, reconciledBankTransactionId: true },
    });
    if (toDelete.length === 0) {
      return { success: true, data: { deleted: 0 } };
    }

    const result = await prisma.tenantBalanceAdjustment.deleteMany({ where });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "TenantBalanceAdjustment",
      entityId: societyId,
      details: {
        action: "cleanup_overpayment_adjustments",
        deleted: result.count,
        ids: toDelete.map((d) => d.id),
        totalCreditRemoved: toDelete.reduce((s, d) => s + Math.abs(Number(d.amount)), 0),
      },
    });

    revalidatePath("/administration/trop-percu");
    revalidatePath("/locataires");
    revalidatePath("/comptabilite");
    return { success: true, data: { deleted: result.count } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteOverpaymentAdjustments]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
