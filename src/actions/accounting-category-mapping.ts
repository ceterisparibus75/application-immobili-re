"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/actions/society";
import { requireSocietyActionContext } from "@/lib/action-society";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  CASHFLOW_ACCOUNTING_MAPPINGS,
  type AccountingCategoryMappingRecord,
} from "@/lib/accounting-category-mapping";
import type { CashflowCategoryId } from "@/lib/cashflow-categories";
import {
  upsertAccountingCategoryMappingSchema,
  type UpsertAccountingCategoryMappingInput,
} from "@/validations/accounting-category-mapping";

export type AccountingCategoryMappingDTO = AccountingCategoryMappingRecord & {
  id: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDTO(row: {
  id: string;
  cashflowCategoryId: string | null;
  keyword: string | null;
  accountCode: string;
  accountLabel: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AccountingCategoryMappingDTO {
  return {
    id: row.id,
    cashflowCategoryId: row.cashflowCategoryId,
    keyword: row.keyword,
    accountCode: row.accountCode,
    accountLabel: row.accountLabel,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Liste des mappings catégorie → compte PCG configurés pour une société.
 * Rôle minimum : COMPTABLE.
 */
export async function listMappings(
  societyId: string
): Promise<ActionResult<AccountingCategoryMappingDTO[]>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const rows = await prisma.accountingCategoryMapping.findMany({
      where: { societyId },
      orderBy: [{ cashflowCategoryId: "asc" }, { keyword: "asc" }],
    });

    return { success: true, data: rows.map(toDTO) };
  } catch (error) {
    console.error("[listMappings]", error);
    return { success: false, error: "Erreur lors du chargement des mappings" };
  }
}

/**
 * Crée ou met à jour un mapping catégorie → compte PCG.
 *
 * - Si `input.id` est fourni → update ciblé (vérifié scopé à la société)
 * - Sinon → upsert sur la clé (cashflowCategoryId OU keyword) + societyId.
 *
 * Rôle minimum : COMPTABLE.
 */
export async function upsertMapping(
  societyId: string,
  input: UpsertAccountingCategoryMappingInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = upsertAccountingCategoryMappingSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = parsed.data;
    const normalizedCashflow = data.cashflowCategoryId?.trim() || null;
    const normalizedKeyword = data.keyword?.trim() || null;

    // Mise à jour explicite si on nous passe un id.
    if (data.id) {
      const existing = await prisma.accountingCategoryMapping.findFirst({
        where: { id: data.id, societyId },
        select: { id: true },
      });
      if (!existing) {
        return { success: false, error: "Mapping introuvable" };
      }
      const updated = await prisma.accountingCategoryMapping.update({
        where: { id: existing.id },
        data: {
          cashflowCategoryId: normalizedCashflow,
          keyword: normalizedKeyword,
          accountCode: data.accountCode,
          accountLabel: data.accountLabel || null,
          notes: data.notes || null,
        },
        select: { id: true },
      });
      await createAuditLog({
        societyId,
        userId: context.userId,
        action: "UPDATE",
        entity: "AccountingCategoryMapping",
        entityId: updated.id,
        details: {
          cashflowCategoryId: normalizedCashflow,
          keyword: normalizedKeyword,
          accountCode: data.accountCode,
        },
      });
      revalidatePath("/parametres/comptabilite/mappings");
      return { success: true, data: { id: updated.id } };
    }

    // Upsert par clé unique (societyId + cashflowCategoryId) OU
    // (societyId + keyword). Comme on ne peut avoir qu'une seule des deux
    // à la fois, on les sépare en deux branches explicites.
    if (normalizedCashflow) {
      const row = await prisma.accountingCategoryMapping.upsert({
        where: {
          societyId_cashflowCategoryId: {
            societyId,
            cashflowCategoryId: normalizedCashflow,
          },
        },
        create: {
          societyId,
          cashflowCategoryId: normalizedCashflow,
          keyword: null,
          accountCode: data.accountCode,
          accountLabel: data.accountLabel || null,
          notes: data.notes || null,
        },
        update: {
          keyword: null,
          accountCode: data.accountCode,
          accountLabel: data.accountLabel || null,
          notes: data.notes || null,
        },
        select: { id: true, createdAt: true, updatedAt: true },
      });
      await createAuditLog({
        societyId,
        userId: context.userId,
        action: row.createdAt.getTime() === row.updatedAt.getTime() ? "CREATE" : "UPDATE",
        entity: "AccountingCategoryMapping",
        entityId: row.id,
        details: {
          cashflowCategoryId: normalizedCashflow,
          accountCode: data.accountCode,
        },
      });
      revalidatePath("/parametres/comptabilite/mappings");
      return { success: true, data: { id: row.id } };
    }

    if (!normalizedKeyword) {
      // Impossible — le schéma Zod le refuserait déjà, mais garde-fou typage.
      return { success: false, error: "Clé de mapping manquante" };
    }

    const row = await prisma.accountingCategoryMapping.upsert({
      where: {
        societyId_keyword: {
          societyId,
          keyword: normalizedKeyword,
        },
      },
      create: {
        societyId,
        cashflowCategoryId: null,
        keyword: normalizedKeyword,
        accountCode: data.accountCode,
        accountLabel: data.accountLabel || null,
        notes: data.notes || null,
      },
      update: {
        cashflowCategoryId: null,
        accountCode: data.accountCode,
        accountLabel: data.accountLabel || null,
        notes: data.notes || null,
      },
      select: { id: true, createdAt: true, updatedAt: true },
    });
    await createAuditLog({
      societyId,
      userId: context.userId,
      action: row.createdAt.getTime() === row.updatedAt.getTime() ? "CREATE" : "UPDATE",
      entity: "AccountingCategoryMapping",
      entityId: row.id,
      details: {
        keyword: normalizedKeyword,
        accountCode: data.accountCode,
      },
    });
    revalidatePath("/parametres/comptabilite/mappings");
    return { success: true, data: { id: row.id } };
  } catch (error) {
    console.error("[upsertMapping]", error);
    return { success: false, error: "Erreur lors de l'enregistrement du mapping" };
  }
}

/**
 * Supprime un mapping. Rôle minimum : COMPTABLE.
 */
export async function deleteMapping(
  societyId: string,
  id: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const existing = await prisma.accountingCategoryMapping.findFirst({
      where: { id, societyId },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Mapping introuvable" };
    }

    await prisma.accountingCategoryMapping.delete({
      where: { id: existing.id },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "AccountingCategoryMapping",
      entityId: existing.id,
    });

    revalidatePath("/parametres/comptabilite/mappings");
    return { success: true };
  } catch (error) {
    console.error("[deleteMapping]", error);
    return { success: false, error: "Erreur lors de la suppression du mapping" };
  }
}

/**
 * Initialise les mappings par défaut pour une société, à partir du mapping
 * hard-codé historique `CASHFLOW_ACCOUNTING_MAPPINGS`.
 *
 * Idempotent : utilise `createMany({ skipDuplicates: true })`, ne touche
 * pas aux mappings déjà présents (y compris ceux déjà personnalisés).
 *
 * Rôle minimum : ADMIN_SOCIETE.
 */
export async function seedDefaultMappings(
  societyId: string
): Promise<ActionResult<{ created: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const entries = Object.entries(CASHFLOW_ACCOUNTING_MAPPINGS) as [
      CashflowCategoryId,
      (typeof CASHFLOW_ACCOUNTING_MAPPINGS)[CashflowCategoryId]
    ][];

    const result = await prisma.accountingCategoryMapping.createMany({
      data: entries.map(([categoryId, mapping]) => ({
        societyId,
        cashflowCategoryId: categoryId,
        keyword: null,
        accountCode: mapping.code,
        accountLabel: mapping.label,
        notes: null,
      })),
      skipDuplicates: true,
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "AccountingCategoryMapping",
      entityId: `seed:${societyId}`,
      details: { created: result.count },
    });

    revalidatePath("/parametres/comptabilite/mappings");
    return { success: true, data: { created: result.count } };
  } catch (error) {
    console.error("[seedDefaultMappings]", error);
    return {
      success: false,
      error: "Erreur lors de l'initialisation des mappings",
    };
  }
}

