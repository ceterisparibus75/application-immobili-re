"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { createAuditLog } from "@/lib/audit";
import { resolveOpenFiscalYearIdForDate } from "@/lib/accounting-period";
import {
  buildLinearDepreciationSchedule,
} from "@/lib/fixed-assets";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  createFixedAssetSchema,
  postFixedAssetDepreciationSchema,
  type CreateFixedAssetInput,
  type PostFixedAssetDepreciationInput,
} from "@/validations/fixed-asset";

const REVALIDATE_PATH = "/comptabilite/immobilisations";

function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function validateFixedAssetAccounts(
  societyId: string,
  assetAccountId: string,
  depreciationAccountId: string,
  expenseAccountId: string
): Promise<string | null> {
  const accounts = await prisma.accountingAccount.findMany({
    where: {
      societyId,
      id: { in: [assetAccountId, depreciationAccountId, expenseAccountId] },
      isActive: true,
    },
    select: { id: true, code: true, type: true },
  });

  const byId = new Map(accounts.map((account) => [account.id, account]));
  const assetAccount = byId.get(assetAccountId);
  const depreciationAccount = byId.get(depreciationAccountId);
  const expenseAccount = byId.get(expenseAccountId);

  if (!assetAccount || assetAccount.type !== "2" || assetAccount.code.startsWith("28")) {
    return "Le compte d'immobilisation doit être un compte actif de classe 2 hors amortissements";
  }
  if (!depreciationAccount || depreciationAccount.type !== "2" || !depreciationAccount.code.startsWith("28")) {
    return "Le compte d'amortissement doit être un compte 28";
  }
  if (!expenseAccount || expenseAccount.type !== "6" || !expenseAccount.code.startsWith("681")) {
    return "Le compte de dotation doit être un compte 681";
  }
  return null;
}

export async function createFixedAsset(
  societyId: string,
  input: CreateFixedAssetInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = createFixedAssetSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }
    const data = parsed.data;

    const [building, supplierInvoice, accountError] = await Promise.all([
      prisma.building.findFirst({
        where: { id: data.buildingId, societyId },
        select: { id: true },
      }),
      data.supplierInvoiceId
        ? prisma.supplierInvoice.findFirst({
            where: { id: data.supplierInvoiceId, societyId },
            select: {
              id: true,
              buildingId: true,
              journalEntryId: true,
              accountingAccount: { select: { type: true } },
            },
          })
        : Promise.resolve(null),
      validateFixedAssetAccounts(
        societyId,
        data.assetAccountId,
        data.depreciationAccountId,
        data.expenseAccountId
      ),
    ]);

    if (!building) return { success: false, error: "Immeuble introuvable" };
    if (accountError) return { success: false, error: accountError };
    if (supplierInvoice) {
      if (supplierInvoice.buildingId && supplierInvoice.buildingId !== data.buildingId) {
        return { success: false, error: "La facture fournisseur est rattachée à un autre immeuble" };
      }
      if (supplierInvoice.accountingAccount?.type !== "2") {
        return { success: false, error: "La facture fournisseur doit être comptabilisée en classe 2" };
      }
    }

    const schedule = buildLinearDepreciationSchedule({
      depreciableBase: data.depreciableBase,
      residualValue: data.residualValue,
      serviceStartDate: data.serviceStartDate,
      durationMonths: data.durationMonths,
    });
    if (schedule.length === 0) {
      return { success: false, error: "Impossible de générer un plan d'amortissement avec ces paramètres" };
    }

    const asset = await prisma.fixedAsset.create({
      data: {
        societyId,
        name: data.name,
        description: data.description || null,
        category: data.category,
        buildingId: data.buildingId,
        supplierInvoiceId: data.supplierInvoiceId ?? null,
        acquisitionJournalEntryId: data.acquisitionJournalEntryId ?? supplierInvoice?.journalEntryId ?? null,
        assetAccountId: data.assetAccountId,
        depreciationAccountId: data.depreciationAccountId,
        expenseAccountId: data.expenseAccountId,
        acquisitionDate: data.acquisitionDate,
        serviceStartDate: data.serviceStartDate,
        depreciableBase: roundCents(data.depreciableBase),
        residualValue: roundCents(data.residualValue),
        durationMonths: data.durationMonths,
        depreciationLines: {
          create: schedule.map((line) => ({
            fiscalYear: line.fiscalYear,
            periodStart: line.periodStart,
            periodEnd: line.periodEnd,
            amount: line.amount,
            accumulatedAmount: line.accumulatedAmount,
            netBookValue: line.netBookValue,
          })),
        },
      },
      select: { id: true },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "FixedAsset",
      entityId: asset.id,
      details: {
        name: data.name,
        category: data.category,
        durationMonths: data.durationMonths,
        depreciableBase: data.depreciableBase,
      },
    });

    revalidatePath(REVALIDATE_PATH);
    revalidatePath("/comptabilite");
    return { success: true, data: { id: asset.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createFixedAsset]", error);
    return { success: false, error: "Erreur lors de la création de l'immobilisation" };
  }
}

export async function postFixedAssetDepreciation(
  societyId: string,
  input: PostFixedAssetDepreciationInput
): Promise<ActionResult<{ journalEntryIds: string[] }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = postFixedAssetDepreciationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const asset = await prisma.fixedAsset.findFirst({
      where: { id: parsed.data.fixedAssetId, societyId },
      include: {
        depreciationAccount: { select: { id: true, code: true, label: true } },
        expenseAccount: { select: { id: true, code: true, label: true } },
        depreciationLines: {
          where: { fiscalYear: parsed.data.fiscalYear, status: "PLANNED" },
          orderBy: { periodEnd: "asc" },
        },
      },
    });
    if (!asset) return { success: false, error: "Immobilisation introuvable" };
    if (asset.depreciationLines.length === 0) {
      return { success: false, error: "Aucune dotation à comptabiliser pour cet exercice" };
    }

    const journalEntryIds = await prisma.$transaction(async (tx) => {
      const createdIds: string[] = [];
      for (const line of asset.depreciationLines) {
        const fiscalYearId = await resolveOpenFiscalYearIdForDate(tx, societyId, line.periodEnd);
        const entry = await tx.journalEntry.create({
          data: {
            societyId,
            fiscalYearId,
            journalType: "OD",
            entryDate: line.periodEnd,
            piece: `AMORT-${asset.name}-${line.fiscalYear}`,
            label: `Dotation amortissement - ${asset.name}`,
            reference: asset.id,
            status: "BROUILLON",
            lines: {
              create: [
                {
                  accountId: asset.expenseAccountId,
                  debit: line.amount,
                  credit: 0,
                  label: `Dotation ${line.fiscalYear} - ${asset.name}`,
                },
                {
                  accountId: asset.depreciationAccountId,
                  debit: 0,
                  credit: line.amount,
                  label: `Amortissement cumulé ${line.fiscalYear} - ${asset.name}`,
                },
              ],
            },
          },
          select: { id: true },
        });

        await tx.fixedAssetDepreciationLine.update({
          where: { id: line.id },
          data: { status: "POSTED", journalEntryId: entry.id },
        });
        createdIds.push(entry.id);
      }

      const remaining = await tx.fixedAssetDepreciationLine.count({
        where: { fixedAssetId: asset.id, status: "PLANNED" },
      });
      if (remaining === 0) {
        await tx.fixedAsset.update({
          where: { id: asset.id },
          data: { status: "FULLY_DEPRECIATED" },
        });
      }
      return createdIds;
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: journalEntryIds[0] ?? parsed.data.fixedAssetId,
      details: {
        event: "POST_FIXED_ASSET_DEPRECIATION",
        fixedAssetId: asset.id,
        fiscalYear: parsed.data.fiscalYear,
        journalEntryIds,
      },
    });

    revalidatePath(REVALIDATE_PATH);
    revalidatePath("/comptabilite");
    return { success: true, data: { journalEntryIds } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[postFixedAssetDepreciation]", error);
    return { success: false, error: "Erreur lors de la génération des dotations" };
  }
}
