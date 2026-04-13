"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createStatementSchema,
  updateStatementSchema,
  recordStatementPaymentSchema,
  type CreateStatementInput,
  type UpdateStatementInput,
  type RecordStatementPaymentInput,
} from "@/validations/third-party-statement";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

// ─── Types utilitaires ───────────────────────────────────────────────

interface StatementFilters {
  buildingId?: string;
  leaseId?: string;
  type?: "APPEL_FONDS" | "DECOMPTE_CHARGES" | "DECOMPTE_GESTION";
  status?: string;
}

interface VerificationLineResult {
  lineType: string;
  label: string;
  amount: number;
  expectedAmount: number | null;
  ecart: number | null;
  verificationStatus: "OK" | "ECART" | "INFO" | "ANOMALIE";
}

interface VerificationResult {
  overallStatus: "CONFORME" | "ECART" | "ANOMALIE";
  lines: VerificationLineResult[];
  periodMonths: number;
  computedAt: string;
}

// ─── Création ────────────────────────────────────────────────────────

export async function createStatement(
  societyId: string,
  input: CreateStatementInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createStatementSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = parsed.data;

    // Vérifier l'immeuble si type syndic
    if (data.buildingId) {
      const building = await prisma.building.findFirst({
        where: { id: data.buildingId, societyId },
      });
      if (!building) return { success: false, error: "Immeuble introuvable" };
    }

    // Vérifier le bail si type gestion locative
    if (data.leaseId) {
      const lease = await prisma.lease.findFirst({
        where: { id: data.leaseId, societyId },
      });
      if (!lease) return { success: false, error: "Bail introuvable" };
    }

    // Vérifier le contact si renseigné
    if (data.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: data.contactId },
      });
      if (!contact) return { success: false, error: "Contact introuvable" };
    }

    // Transaction : créer le relevé + lignes + éventuellement des charges
    const result = await prisma.$transaction(async (tx) => {
      const statement = await tx.thirdPartyStatement.create({
        data: {
          societyId,
          buildingId: data.buildingId ?? null,
          leaseId: data.leaseId ?? null,
          type: data.type,
          thirdPartyName: data.thirdPartyName,
          contactId: data.contactId ?? null,
          reference: data.reference ?? null,
          periodStart: new Date(data.periodStart),
          periodEnd: new Date(data.periodEnd),
          periodLabel: data.periodLabel ?? null,
          receivedDate: new Date(data.receivedDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          totalAmount: data.totalAmount,
          netAmount: data.netAmount ?? null,
          notes: data.notes ?? null,
          lines: {
            create: data.lines.map((line) => ({
              lineType: line.lineType,
              label: line.label,
              amount: line.amount,
              categoryId: line.categoryId ?? null,
              nature: line.nature ?? null,
              recoverableRate: line.recoverableRate ?? null,
            })),
          },
        },
      });

      // Pour les types syndic, créer automatiquement des Charge pour chaque ligne CHARGE
      if (
        (data.type === "APPEL_FONDS" || data.type === "DECOMPTE_CHARGES") &&
        data.buildingId
      ) {
        const chargeLines = data.lines.filter(
          (line) => line.lineType === "CHARGE" && line.categoryId
        );

        for (const line of chargeLines) {
          await tx.charge.create({
            data: {
              societyId,
              buildingId: data.buildingId,
              categoryId: line.categoryId!,
              description: line.label,
              amount: line.amount,
              date: new Date(data.receivedDate),
              periodStart: new Date(data.periodStart),
              periodEnd: new Date(data.periodEnd),
              supplierName: data.thirdPartyName,
              statementId: statement.id,
            },
          });
        }
      }

      return statement;
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "ThirdPartyStatement",
      entityId: result.id,
      details: {
        type: data.type,
        thirdPartyName: data.thirdPartyName,
        totalAmount: data.totalAmount,
        linesCount: data.lines.length,
      },
    });

    revalidatePath("/releves-tiers");
    revalidatePath("/charges");
    if (data.buildingId) {
      revalidatePath(`/patrimoine/immeubles/${data.buildingId}`);
    }

    return { success: true, data: { id: result.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createStatement]", error);
    return { success: false, error: "Erreur lors de la création du relevé" };
  }
}

// ─── Liste ───────────────────────────────────────────────────────────

export async function getStatements(
  societyId: string,
  filters?: StatementFilters
): Promise<ActionResult<{ statements: unknown[] }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const where: Record<string, unknown> = { societyId };

    if (filters?.buildingId) where.buildingId = filters.buildingId;
    if (filters?.leaseId) where.leaseId = filters.leaseId;
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;

    const statements = await prisma.thirdPartyStatement.findMany({
      where,
      include: {
        lines: true,
        building: { select: { id: true, name: true } },
        lease: {
          select: {
            id: true,
            leaseNumber: true,
            lot: { select: { id: true, number: true, lotType: true } },
            tenant: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        contact: { select: { id: true, name: true } },
      },
      orderBy: { receivedDate: "desc" },
    });

    return { success: true, data: { statements } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getStatements]", error);
    return { success: false, error: "Erreur lors de la récupération des relevés" };
  }
}

// ─── Détail ──────────────────────────────────────────────────────────

export async function getStatementById(
  societyId: string,
  statementId: string
): Promise<ActionResult<{ statement: unknown }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const statement = await prisma.thirdPartyStatement.findFirst({
      where: { id: statementId, societyId },
      include: {
        lines: true,
        building: { select: { id: true, name: true, addressLine1: true, city: true } },
        lease: {
          select: {
            id: true,
            leaseNumber: true,
            currentRentHT: true,
            vatApplicable: true,
            vatRate: true,
            isThirdPartyManaged: true,
            managementFeeType: true,
            managementFeeValue: true,
            managementFeeBasis: true,
            managementFeeVatRate: true,
            lot: { select: { id: true, number: true, lotType: true } },
            tenant: { select: { id: true, firstName: true, lastName: true } },
            chargeProvisions: {
              where: { isActive: true },
              select: { id: true, label: true, monthlyAmount: true },
            },
          },
        },
        contact: { select: { id: true, name: true, company: true, phone: true, email: true } },
        document: { select: { id: true, fileName: true, fileUrl: true } },
        charges: {
          select: { id: true, description: true, amount: true, isPaid: true },
        },
      },
    });

    if (!statement) return { success: false, error: "Relevé introuvable" };

    return { success: true, data: { statement } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getStatementById]", error);
    return { success: false, error: "Erreur lors de la récupération du relevé" };
  }
}

// ─── Mise à jour ─────────────────────────────────────────────────────

export async function updateStatement(
  societyId: string,
  input: UpdateStatementInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateStatementSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, lines, ...data } = parsed.data;

    const existing = await prisma.thirdPartyStatement.findFirst({
      where: { id, societyId },
    });
    if (!existing) return { success: false, error: "Relevé introuvable" };

    if (existing.status !== "BROUILLON") {
      return { success: false, error: "Seuls les brouillons peuvent être modifiés" };
    }

    await prisma.$transaction(async (tx) => {
      // Mettre à jour les champs scalaires
      const updateData: Record<string, unknown> = {};
      if (data.type !== undefined) updateData.type = data.type;
      if (data.buildingId !== undefined) updateData.buildingId = data.buildingId;
      if (data.leaseId !== undefined) updateData.leaseId = data.leaseId;
      if (data.thirdPartyName !== undefined) updateData.thirdPartyName = data.thirdPartyName;
      if (data.contactId !== undefined) updateData.contactId = data.contactId;
      if (data.reference !== undefined) updateData.reference = data.reference;
      if (data.periodStart !== undefined) updateData.periodStart = new Date(data.periodStart);
      if (data.periodEnd !== undefined) updateData.periodEnd = new Date(data.periodEnd);
      if (data.periodLabel !== undefined) updateData.periodLabel = data.periodLabel;
      if (data.receivedDate !== undefined) updateData.receivedDate = new Date(data.receivedDate);
      if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
      if (data.netAmount !== undefined) updateData.netAmount = data.netAmount;
      if (data.notes !== undefined) updateData.notes = data.notes;

      await tx.thirdPartyStatement.update({
        where: { id },
        data: updateData,
      });

      // Remplacer les lignes si fournies
      if (lines && lines.length > 0) {
        // Supprimer les charges liées aux anciennes lignes
        await tx.charge.deleteMany({ where: { statementId: id } });

        // Supprimer les anciennes lignes
        await tx.thirdPartyStatementLine.deleteMany({ where: { statementId: id } });

        // Créer les nouvelles lignes
        for (const line of lines) {
          await tx.thirdPartyStatementLine.create({
            data: {
              statementId: id,
              lineType: line.lineType,
              label: line.label,
              amount: line.amount,
              categoryId: line.categoryId ?? null,
              nature: line.nature ?? null,
              recoverableRate: line.recoverableRate ?? null,
            },
          });
        }

        // Recréer les charges si type syndic
        const stmt = await tx.thirdPartyStatement.findUnique({ where: { id } });
        if (
          stmt &&
          (stmt.type === "APPEL_FONDS" || stmt.type === "DECOMPTE_CHARGES") &&
          stmt.buildingId
        ) {
          const chargeLines = lines.filter(
            (l) => l.lineType === "CHARGE" && l.categoryId
          );
          for (const line of chargeLines) {
            await tx.charge.create({
              data: {
                societyId,
                buildingId: stmt.buildingId,
                categoryId: line.categoryId!,
                description: line.label,
                amount: line.amount,
                date: stmt.receivedDate,
                periodStart: stmt.periodStart,
                periodEnd: stmt.periodEnd,
                supplierName: stmt.thirdPartyName,
                statementId: id,
              },
            });
          }
        }
      }
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "ThirdPartyStatement",
      entityId: id,
    });

    revalidatePath("/releves-tiers");
    revalidatePath("/charges");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateStatement]", error);
    return { success: false, error: "Erreur lors de la mise à jour du relevé" };
  }
}

// ─── Validation (BROUILLON → VALIDE) ────────────────────────────────

export async function validateStatement(
  societyId: string,
  statementId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const existing = await prisma.thirdPartyStatement.findFirst({
      where: { id: statementId, societyId },
    });
    if (!existing) return { success: false, error: "Relevé introuvable" };

    if (existing.status !== "BROUILLON") {
      return { success: false, error: "Seuls les brouillons peuvent être validés" };
    }

    await prisma.thirdPartyStatement.update({
      where: { id: statementId },
      data: { status: "VALIDE" },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "ThirdPartyStatement",
      entityId: statementId,
      details: { statusChange: "BROUILLON → VALIDE" },
    });

    revalidatePath("/releves-tiers");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[validateStatement]", error);
    return { success: false, error: "Erreur lors de la validation du relevé" };
  }
}

// ─── Enregistrement de paiement (APPEL_FONDS) ───────────────────────

export async function recordStatementPayment(
  societyId: string,
  input: RecordStatementPaymentInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = recordStatementPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { statementId, amount, paidAt, method, reference } = parsed.data;

    const existing = await prisma.thirdPartyStatement.findFirst({
      where: { id: statementId, societyId },
    });
    if (!existing) return { success: false, error: "Relevé introuvable" };

    if (existing.type !== "APPEL_FONDS") {
      return { success: false, error: "Le paiement ne concerne que les appels de fonds" };
    }

    const newPaidAmount = existing.paidAmount + amount;
    const isFullyPaid = newPaidAmount >= existing.totalAmount;

    await prisma.$transaction(async (tx) => {
      await tx.thirdPartyStatement.update({
        where: { id: statementId },
        data: {
          paidAmount: newPaidAmount,
          paidAt: new Date(paidAt),
          paymentMethod: method ?? null,
          paymentReference: reference ?? null,
          status: isFullyPaid ? "PAYE" : "PARTIELLEMENT_PAYE",
        },
      });

      // Marquer les charges liées comme payées si paiement total
      if (isFullyPaid) {
        await tx.charge.updateMany({
          where: { statementId },
          data: { isPaid: true },
        });
      }
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "ThirdPartyStatement",
      entityId: statementId,
      details: {
        action: "PAIEMENT",
        amount,
        newPaidAmount,
        isFullyPaid,
      },
    });

    revalidatePath("/releves-tiers");
    revalidatePath("/charges");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[recordStatementPayment]", error);
    return { success: false, error: "Erreur lors de l'enregistrement du paiement" };
  }
}

// ─── Vérification d'un décompte de gestion locative ──────────────────

export async function verifyManagementStatement(
  societyId: string,
  statementId: string
): Promise<ActionResult<{ verification: VerificationResult }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const statement = await prisma.thirdPartyStatement.findFirst({
      where: { id: statementId, societyId },
      include: {
        lines: true,
        lease: {
          include: {
            chargeProvisions: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!statement) return { success: false, error: "Relevé introuvable" };

    if (statement.type !== "DECOMPTE_GESTION") {
      return { success: false, error: "La vérification ne concerne que les décomptes de gestion" };
    }

    if (!statement.lease) {
      return { success: false, error: "Bail introuvable pour ce relevé" };
    }

    const lease = statement.lease;

    // Calculer le nombre de mois de la période
    const periodStart = statement.periodStart;
    const periodEnd = statement.periodEnd;
    const months = Math.max(
      1,
      (periodEnd.getFullYear() - periodStart.getFullYear()) * 12 +
        (periodEnd.getMonth() - periodStart.getMonth()) + 1
    );

    // Calculer le montant attendu des honoraires
    let expectedFees: number | null = null;
    if (lease.managementFeeType && lease.managementFeeValue) {
      const feeVatRate = lease.managementFeeVatRate ?? 20;

      if (lease.managementFeeType === "POURCENTAGE") {
        // Base de calcul selon le paramétrage
        let basis = 0;
        const monthlyRentHT = lease.currentRentHT;
        const monthlyProvisions = lease.chargeProvisions.reduce(
          (sum, p) => sum + p.monthlyAmount,
          0
        );

        if (lease.managementFeeBasis === "LOYER_HT") {
          basis = monthlyRentHT * months;
        } else if (lease.managementFeeBasis === "LOYER_CHARGES_HT") {
          basis = (monthlyRentHT + monthlyProvisions) * months;
        } else if (lease.managementFeeBasis === "TOTAL_TTC") {
          const rentTTC = lease.vatApplicable
            ? monthlyRentHT * (1 + (lease.vatRate ?? 20) / 100)
            : monthlyRentHT;
          basis = (rentTTC + monthlyProvisions * (1 + feeVatRate / 100)) * months;
        } else {
          // Défaut : loyer HT
          basis = monthlyRentHT * months;
        }

        expectedFees = basis * (lease.managementFeeValue / 100);
      } else if (lease.managementFeeType === "FORFAIT") {
        expectedFees = lease.managementFeeValue * months;
      }

      // Appliquer la TVA sur les honoraires
      if (expectedFees !== null) {
        expectedFees = expectedFees * (1 + feeVatRate / 100);
      }
    }

    // Vérifier chaque ligne
    const lineResults: VerificationLineResult[] = [];

    for (const line of statement.lines) {
      let expectedAmount: number | null = null;
      let verificationStatus: "OK" | "ECART" | "INFO" | "ANOMALIE" = "INFO";

      const labelLower = line.label.toLowerCase();

      if (line.lineType === "ENCAISSEMENT") {
        if (labelLower.includes("loyer") || labelLower.includes("lover")) {
          // Calcul du loyer attendu
          if (lease.vatApplicable) {
            expectedAmount = lease.currentRentHT * months * (1 + (lease.vatRate ?? 20) / 100);
          } else {
            expectedAmount = lease.currentRentHT * months;
          }
        } else if (
          labelLower.includes("provision") ||
          labelLower.includes("charge")
        ) {
          // Calcul des provisions attendues
          const totalMonthlyProvisions = lease.chargeProvisions.reduce(
            (sum, p) => sum + p.monthlyAmount,
            0
          );
          expectedAmount = totalMonthlyProvisions * months;
        }
      } else if (line.lineType === "HONORAIRES") {
        expectedAmount = expectedFees;
      } else if (line.lineType === "DEDUCTION") {
        // Pas de montant attendu pour les déductions — info seulement
        expectedAmount = null;
      }

      // Déterminer le statut
      if (expectedAmount !== null) {
        const ecart = Math.abs(line.amount - expectedAmount);
        if (ecart < 1) {
          verificationStatus = "OK";
        } else if (ecart < Math.abs(expectedAmount) * 0.1) {
          verificationStatus = "ECART";
        } else {
          verificationStatus = "ANOMALIE";
        }
      }

      lineResults.push({
        lineType: line.lineType,
        label: line.label,
        amount: line.amount,
        expectedAmount,
        ecart: expectedAmount !== null ? Math.round((line.amount - expectedAmount) * 100) / 100 : null,
        verificationStatus,
      });
    }

    // Statut global
    const hasAnomalie = lineResults.some((r) => r.verificationStatus === "ANOMALIE");
    const hasEcart = lineResults.some((r) => r.verificationStatus === "ECART");
    let overallStatus: "CONFORME" | "ECART" | "ANOMALIE" = "CONFORME";
    if (hasAnomalie) overallStatus = "ANOMALIE";
    else if (hasEcart) overallStatus = "ECART";

    const verification: VerificationResult = {
      overallStatus,
      lines: lineResults,
      periodMonths: months,
      computedAt: new Date().toISOString(),
    };

    // Sauvegarder les résultats et mettre à jour les lignes
    await prisma.$transaction(async (tx) => {
      await tx.thirdPartyStatement.update({
        where: { id: statementId },
        data: {
          verificationResult: JSON.parse(JSON.stringify(verification)),
          verificationStatus: overallStatus,
          status: "VERIFIE",
        },
      });

      // Mettre à jour chaque ligne avec le résultat
      for (let i = 0; i < statement.lines.length; i++) {
        const lineResult = lineResults[i];
        if (lineResult) {
          await tx.thirdPartyStatementLine.update({
            where: { id: statement.lines[i].id },
            data: {
              expectedAmount: lineResult.expectedAmount,
              verificationStatus: lineResult.verificationStatus,
            },
          });
        }
      }
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "ThirdPartyStatement",
      entityId: statementId,
      details: {
        action: "VERIFICATION",
        overallStatus,
        periodMonths: months,
      },
    });

    revalidatePath("/releves-tiers");

    return { success: true, data: { verification } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[verifyManagementStatement]", error);
    return { success: false, error: "Erreur lors de la vérification du décompte" };
  }
}

// ─── Marquer conforme (VERIFIE → CONFORME) ─────────────────────────

export async function markStatementConforme(
  societyId: string,
  statementId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const existing = await prisma.thirdPartyStatement.findFirst({
      where: { id: statementId, societyId },
    });
    if (!existing) return { success: false, error: "Relevé introuvable" };

    if (existing.status !== "VERIFIE") {
      return { success: false, error: "Seuls les relevés vérifiés peuvent être marqués conformes" };
    }

    await prisma.thirdPartyStatement.update({
      where: { id: statementId },
      data: { status: "CONFORME" },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "ThirdPartyStatement",
      entityId: statementId,
      details: { statusChange: "VERIFIE → CONFORME" },
    });

    revalidatePath("/releves-tiers");
    revalidatePath(`/baux`);

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[markStatementConforme]", error);
    return { success: false, error: "Erreur lors du marquage conforme" };
  }
}

// ─── Signaler un litige (VERIFIE → LITIGE) ─────────────────────────

export async function markStatementLitige(
  societyId: string,
  statementId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const existing = await prisma.thirdPartyStatement.findFirst({
      where: { id: statementId, societyId },
    });
    if (!existing) return { success: false, error: "Relevé introuvable" };

    if (existing.status !== "VERIFIE") {
      return { success: false, error: "Seuls les relevés vérifiés peuvent être signalés en litige" };
    }

    await prisma.thirdPartyStatement.update({
      where: { id: statementId },
      data: { status: "LITIGE" },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "ThirdPartyStatement",
      entityId: statementId,
      details: { statusChange: "VERIFIE → LITIGE" },
    });

    revalidatePath("/releves-tiers");
    revalidatePath(`/baux`);

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[markStatementLitige]", error);
    return { success: false, error: "Erreur lors du signalement du litige" };
  }
}

// ─── Suppression ─────────────────────────────────────────────────────

export async function deleteStatement(
  societyId: string,
  statementId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const existing = await prisma.thirdPartyStatement.findFirst({
      where: { id: statementId, societyId },
    });
    if (!existing) return { success: false, error: "Relevé introuvable" };

    if (existing.status !== "BROUILLON") {
      return { success: false, error: "Seuls les brouillons peuvent être supprimés" };
    }

    await prisma.$transaction(async (tx) => {
      // Supprimer les charges liées
      await tx.charge.deleteMany({ where: { statementId } });

      // Supprimer les lignes puis le relevé (cascade gérée par Prisma mais explicite ici)
      await tx.thirdPartyStatementLine.deleteMany({ where: { statementId } });

      await tx.thirdPartyStatement.delete({ where: { id: statementId } });
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "ThirdPartyStatement",
      entityId: statementId,
      details: {
        type: existing.type,
        thirdPartyName: existing.thirdPartyName,
        totalAmount: existing.totalAmount,
      },
    });

    revalidatePath("/releves-tiers");
    revalidatePath("/charges");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteStatement]", error);
    return { success: false, error: "Erreur lors de la suppression du relevé" };
  }
}
