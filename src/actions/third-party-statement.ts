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
  leaseId?: string;
  leaseName?: string;
}

interface LeaseVerificationResult {
  leaseId: string;
  leaseName: string;
  tenantName: string;
  status: "CONFORME" | "ECART" | "ANOMALIE";
  lines: VerificationLineResult[];
}

interface VerificationResult {
  overallStatus: "CONFORME" | "ECART" | "ANOMALIE";
  lines: VerificationLineResult[];
  byLease?: LeaseVerificationResult[];
  periodMonths: number;
  computedAt: string;
}

// ─── Récupérer les baux gérés par un tiers ──────────────────────────

export async function getThirdPartyManagedLeases(
  societyId: string
): Promise<ActionResult<{ leases: unknown[] }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const leases = await prisma.lease.findMany({
      where: {
        societyId,
        isThirdPartyManaged: true,
        status: { in: ["EN_COURS", "RENOUVELE"] },
      },
      select: {
        id: true,
        leaseNumber: true,
        currentRentHT: true,
        vatApplicable: true,
        vatRate: true,
        managementFeeType: true,
        managementFeeValue: true,
        managementFeeBasis: true,
        managementFeeVatRate: true,
        lot: {
          select: {
            id: true,
            number: true,
            lotType: true,
            building: { select: { id: true, name: true, addressLine1: true } },
          },
        },
        tenant: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        chargeProvisions: {
          where: { isActive: true },
          select: { id: true, label: true, monthlyAmount: true },
        },
      },
      orderBy: { leaseNumber: "asc" },
    });

    return { success: true, data: { leases } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getThirdPartyManagedLeases]", error);
    return { success: false, error: "Erreur lors de la récupération des baux" };
  }
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

    // Vérifier le(s) bail(s)
    const allLeaseIds: string[] = [];
    if (data.leaseId) allLeaseIds.push(data.leaseId);
    if (data.leaseIds) {
      for (const lid of data.leaseIds) {
        if (!allLeaseIds.includes(lid)) allLeaseIds.push(lid);
      }
    }

    if (allLeaseIds.length > 0) {
      const leases = await prisma.lease.findMany({
        where: { id: { in: allLeaseIds }, societyId },
        select: { id: true },
      });
      if (leases.length !== allLeaseIds.length) {
        return { success: false, error: "Un ou plusieurs baux introuvables" };
      }
    }

    // Vérifier le contact si renseigné
    if (data.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: data.contactId },
      });
      if (!contact) return { success: false, error: "Contact introuvable" };
    }

    // Transaction : créer le relevé + lignes + liaisons baux + éventuellement des charges
    const result = await prisma.$transaction(async (tx) => {
      const statement = await tx.thirdPartyStatement.create({
        data: {
          societyId,
          buildingId: data.buildingId ?? null,
          leaseId: data.leaseId ?? (allLeaseIds.length === 1 ? allLeaseIds[0] : null),
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
              leaseId: line.leaseId ?? null,
            })),
          },
        },
      });

      // Créer les liaisons baux (multi-baux)
      if (allLeaseIds.length > 0) {
        const leasesData = data.leases ?? [];
        for (const leaseId of allLeaseIds) {
          const leaseInfo = leasesData.find((l) => l.leaseId === leaseId);
          await tx.thirdPartyStatementLease.create({
            data: {
              statementId: statement.id,
              leaseId,
              rentAmount: leaseInfo?.rentAmount ?? null,
              provisionAmount: leaseInfo?.provisionAmount ?? null,
              feeAmount: leaseInfo?.feeAmount ?? null,
              deductionAmount: leaseInfo?.deductionAmount ?? null,
              netAmount: leaseInfo?.netAmount ?? null,
            },
          });
        }
      }

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
        leasesCount: allLeaseIds.length,
      },
    });

    revalidatePath("/releves-tiers");
    revalidatePath("/releves-gestion");
    revalidatePath("/charges");
    if (data.buildingId) {
      revalidatePath(`/patrimoine/immeubles/${data.buildingId}`);
    }
    for (const lid of allLeaseIds) {
      revalidatePath(`/baux/${lid}`);
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
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;

    // Pour le filtre par bail : chercher dans le bail principal OU les liaisons multi-baux
    if (filters?.leaseId) {
      where.OR = [
        { leaseId: filters.leaseId },
        { leases: { some: { leaseId: filters.leaseId } } },
      ];
    }

    const statements = await prisma.thirdPartyStatement.findMany({
      where,
      include: {
        lines: true,
        leases: {
          include: {
            lease: {
              select: {
                id: true,
                leaseNumber: true,
                lot: { select: { id: true, number: true, lotType: true } },
                tenant: { select: { id: true, firstName: true, lastName: true, companyName: true } },
              },
            },
          },
        },
        building: { select: { id: true, name: true } },
        lease: {
          select: {
            id: true,
            leaseNumber: true,
            lot: { select: { id: true, number: true, lotType: true } },
            tenant: { select: { id: true, firstName: true, lastName: true, companyName: true } },
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
        lines: {
          include: {
            lease: {
              select: {
                id: true,
                leaseNumber: true,
                lot: { select: { number: true } },
                tenant: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        leases: {
          include: {
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
                lot: { select: { id: true, number: true, lotType: true, building: { select: { name: true } } } },
                tenant: { select: { id: true, firstName: true, lastName: true, companyName: true } },
                chargeProvisions: {
                  where: { isActive: true },
                  select: { id: true, label: true, monthlyAmount: true },
                },
              },
            },
          },
        },
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
            tenant: { select: { id: true, firstName: true, lastName: true, companyName: true } },
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
        bankReconciliations: {
          include: {
            transaction: { select: { id: true, label: true, amount: true, transactionDate: true, reference: true } },
          },
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

    const { id, lines, leases: leasesInput, leaseIds, ...data } = parsed.data;

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

      // Remplacer les liaisons baux si fournies
      if (leaseIds && leaseIds.length > 0) {
        await tx.thirdPartyStatementLease.deleteMany({ where: { statementId: id } });
        const leasesData = leasesInput ?? [];
        for (const leaseId of leaseIds) {
          const leaseInfo = leasesData.find((l) => l.leaseId === leaseId);
          await tx.thirdPartyStatementLease.create({
            data: {
              statementId: id,
              leaseId,
              rentAmount: leaseInfo?.rentAmount ?? null,
              provisionAmount: leaseInfo?.provisionAmount ?? null,
              feeAmount: leaseInfo?.feeAmount ?? null,
              deductionAmount: leaseInfo?.deductionAmount ?? null,
              netAmount: leaseInfo?.netAmount ?? null,
            },
          });
        }
      }

      // Remplacer les lignes si fournies
      if (lines && lines.length > 0) {
        await tx.charge.deleteMany({ where: { statementId: id } });
        await tx.thirdPartyStatementLine.deleteMany({ where: { statementId: id } });

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
              leaseId: line.leaseId ?? null,
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
    revalidatePath("/releves-gestion");
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
    revalidatePath("/releves-gestion");

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

// ─── Utilitaire : calcul attendu pour un bail ──────────────────────

interface LeaseForVerification {
  id: string;
  leaseNumber: string | null;
  currentRentHT: number;
  vatApplicable: boolean;
  vatRate: number | null;
  managementFeeType: string | null;
  managementFeeValue: number | null;
  managementFeeBasis: string | null;
  managementFeeVatRate: number | null;
  chargeProvisions: Array<{ monthlyAmount: number }>;
  lot?: { number: string } | null;
  tenant?: { firstName: string; lastName: string; companyName?: string | null } | null;
}

function computeExpectedAmounts(
  lease: LeaseForVerification,
  months: number
): { expectedRent: number; expectedProvisions: number; expectedFees: number | null } {
  // Loyer attendu
  const expectedRent = lease.vatApplicable
    ? lease.currentRentHT * months * (1 + (lease.vatRate ?? 20) / 100)
    : lease.currentRentHT * months;

  // Provisions attendues
  const totalMonthlyProvisions = lease.chargeProvisions.reduce(
    (sum, p) => sum + p.monthlyAmount,
    0
  );
  const expectedProvisions = totalMonthlyProvisions * months;

  // Honoraires attendus
  let expectedFees: number | null = null;
  if (lease.managementFeeType && lease.managementFeeValue) {
    const feeVatRate = lease.managementFeeVatRate ?? 20;

    if (lease.managementFeeType === "POURCENTAGE") {
      let basis = 0;
      const monthlyRentHT = lease.currentRentHT;
      const monthlyProvisions = totalMonthlyProvisions;

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
        basis = monthlyRentHT * months;
      }
      expectedFees = basis * (lease.managementFeeValue / 100);
    } else if (lease.managementFeeType === "FORFAIT") {
      expectedFees = lease.managementFeeValue * months;
    }

    if (expectedFees !== null) {
      expectedFees = expectedFees * (1 + feeVatRate / 100);
    }
  }

  return { expectedRent, expectedProvisions, expectedFees };
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
        leases: {
          include: {
            lease: {
              include: {
                chargeProvisions: { where: { isActive: true } },
                lot: { select: { number: true } },
                tenant: { select: { firstName: true, lastName: true, companyName: true } },
              },
            },
          },
        },
        lease: {
          include: {
            chargeProvisions: { where: { isActive: true } },
            lot: { select: { number: true } },
            tenant: { select: { firstName: true, lastName: true, companyName: true } },
          },
        },
      },
    });

    if (!statement) return { success: false, error: "Relevé introuvable" };

    if (statement.type !== "DECOMPTE_GESTION") {
      return { success: false, error: "La vérification ne concerne que les décomptes de gestion" };
    }

    // Construire la liste des baux à vérifier
    const leasesToVerify: LeaseForVerification[] = [];

    if (statement.leases.length > 0) {
      // Multi-baux
      for (const sl of statement.leases) {
        if (sl.lease) leasesToVerify.push(sl.lease as unknown as LeaseForVerification);
      }
    } else if (statement.lease) {
      // Bail unique
      leasesToVerify.push(statement.lease as unknown as LeaseForVerification);
    }

    if (leasesToVerify.length === 0) {
      return { success: false, error: "Aucun bail trouvé pour ce relevé" };
    }

    // Calculer le nombre de mois de la période
    const periodStart = statement.periodStart;
    const periodEnd = statement.periodEnd;
    const months = Math.max(
      1,
      (periodEnd.getFullYear() - periodStart.getFullYear()) * 12 +
        (periodEnd.getMonth() - periodStart.getMonth()) + 1
    );

    const lineResults: VerificationLineResult[] = [];
    const byLease: LeaseVerificationResult[] = [];

    if (leasesToVerify.length === 1) {
      // Mode bail unique : vérification directe comme avant
      const lease = leasesToVerify[0];
      const expected = computeExpectedAmounts(lease, months);

      for (const line of statement.lines) {
        const result = verifyLine(line, expected);
        lineResults.push(result);
      }
    } else {
      // Mode multi-baux : vérification par bail
      for (const lease of leasesToVerify) {
        const expected = computeExpectedAmounts(lease, months);
        const leaseLines = statement.lines.filter((l) => l.leaseId === lease.id);
        const tenantName = lease.tenant
          ? (lease.tenant.companyName || `${lease.tenant.firstName} ${lease.tenant.lastName}`)
          : "Inconnu";
        const leaseName = `${lease.lot?.number ?? ""} — ${lease.leaseNumber ?? ""}`.trim();

        const leaseLineResults: VerificationLineResult[] = [];
        for (const line of leaseLines) {
          const result = verifyLine(line, expected);
          result.leaseId = lease.id;
          result.leaseName = leaseName;
          leaseLineResults.push(result);
          lineResults.push(result);
        }

        const hasAnomalie = leaseLineResults.some((r) => r.verificationStatus === "ANOMALIE");
        const hasEcart = leaseLineResults.some((r) => r.verificationStatus === "ECART");
        let leaseStatus: "CONFORME" | "ECART" | "ANOMALIE" = "CONFORME";
        if (hasAnomalie) leaseStatus = "ANOMALIE";
        else if (hasEcart) leaseStatus = "ECART";

        byLease.push({
          leaseId: lease.id,
          leaseName,
          tenantName,
          status: leaseStatus,
          lines: leaseLineResults,
        });
      }

      // Lignes non affectées à un bail
      const unassignedLines = statement.lines.filter(
        (l) => !l.leaseId || !leasesToVerify.some((le) => le.id === l.leaseId)
      );
      for (const line of unassignedLines) {
        lineResults.push({
          lineType: line.lineType,
          label: line.label,
          amount: line.amount,
          expectedAmount: null,
          ecart: null,
          verificationStatus: "INFO",
        });
      }
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
      byLease: byLease.length > 0 ? byLease : undefined,
      periodMonths: months,
      computedAt: new Date().toISOString(),
    };

    // Sauvegarder les résultats
    await prisma.$transaction(async (tx) => {
      await tx.thirdPartyStatement.update({
        where: { id: statementId },
        data: {
          verificationResult: JSON.parse(JSON.stringify(verification)),
          verificationStatus: overallStatus,
          status: "VERIFIE",
        },
      });

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
        leasesVerified: leasesToVerify.length,
      },
    });

    revalidatePath("/releves-tiers");
    revalidatePath("/releves-gestion");

    return { success: true, data: { verification } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[verifyManagementStatement]", error);
    return { success: false, error: "Erreur lors de la vérification du décompte" };
  }
}

// Utilitaire pour vérifier une ligne
function verifyLine(
  line: { lineType: string; label: string; amount: number },
  expected: { expectedRent: number; expectedProvisions: number; expectedFees: number | null }
): VerificationLineResult {
  let expectedAmount: number | null = null;
  let verificationStatus: "OK" | "ECART" | "INFO" | "ANOMALIE" = "INFO";

  const labelLower = line.label.toLowerCase();

  if (line.lineType === "ENCAISSEMENT") {
    if (labelLower.includes("loyer") || labelLower.includes("lover")) {
      expectedAmount = expected.expectedRent;
    } else if (labelLower.includes("provision") || labelLower.includes("charge")) {
      expectedAmount = expected.expectedProvisions;
    }
  } else if (line.lineType === "HONORAIRES") {
    expectedAmount = expected.expectedFees;
  }

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

  return {
    lineType: line.lineType,
    label: line.label,
    amount: line.amount,
    expectedAmount,
    ecart: expectedAmount !== null ? Math.round((line.amount - expectedAmount) * 100) / 100 : null,
    verificationStatus,
  };
}

// ─── Rapprochement bancaire avec un décompte de gestion ─────────────

export async function reconcileWithStatement(
  societyId: string,
  statementId: string,
  transactionId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    // Charger le décompte avec les baux et leurs factures
    const statement = await prisma.thirdPartyStatement.findFirst({
      where: { id: statementId, societyId },
      include: {
        leases: {
          include: {
            lease: {
              include: {
                tenant: true,
              },
            },
          },
        },
        lease: {
          include: { tenant: true },
        },
      },
    });

    if (!statement) return { success: false, error: "Décompte introuvable" };
    if (statement.type !== "DECOMPTE_GESTION") {
      return { success: false, error: "Le rapprochement ne concerne que les décomptes de gestion" };
    }

    const transaction = await prisma.bankTransaction.findFirst({
      where: { id: transactionId, bankAccount: { societyId }, isReconciled: false },
    });
    if (!transaction) return { success: false, error: "Transaction introuvable ou déjà rapprochée" };

    // Construire la ventilation par bail
    interface LeasePaymentInfo {
      leaseId: string;
      tenantId: string | null;
      netAmount: number;
    }

    const paymentInfos: LeasePaymentInfo[] = [];

    if (statement.leases.length > 0) {
      // Multi-baux : ventiler selon les montants nets par bail
      for (const sl of statement.leases) {
        if (sl.lease && sl.netAmount) {
          paymentInfos.push({
            leaseId: sl.leaseId,
            tenantId: sl.lease.tenantId,
            netAmount: sl.netAmount,
          });
        }
      }
    } else if (statement.lease) {
      // Bail unique
      paymentInfos.push({
        leaseId: statement.leaseId!,
        tenantId: statement.lease.tenantId,
        netAmount: statement.netAmount ?? Math.abs(transaction.amount),
      });
    }

    if (paymentInfos.length === 0) {
      return { success: false, error: "Aucun bail à ventiler pour ce décompte" };
    }

    await prisma.$transaction(async (tx) => {
      // Pour chaque bail, trouver la facture d'appel de loyer non payée et créer un paiement
      for (const info of paymentInfos) {
        // Chercher une facture en attente de paiement pour ce bail dans la période
        const invoice = await tx.invoice.findFirst({
          where: {
            societyId,
            leaseId: info.leaseId,
            status: { in: ["ENVOYEE", "PARTIELLEMENT_PAYE"] },
            invoiceType: "APPEL_LOYER",
          },
          orderBy: { dueDate: "asc" },
        });

        if (invoice) {
          // Calculer le montant déjà payé
          const paidAgg = await tx.payment.aggregate({
            where: { invoiceId: invoice.id },
            _sum: { amount: true },
          });
          const paidSoFar = paidAgg._sum.amount ?? 0;
          const newTotal = paidSoFar + info.netAmount;
          const targetAmount = invoice.isThirdPartyManaged && invoice.expectedNetAmount
            ? invoice.expectedNetAmount
            : invoice.totalTTC;
          const newStatus = newTotal >= targetAmount - 0.01 ? "PAYE" : "PARTIELLEMENT_PAYE";

          const payment = await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              amount: info.netAmount,
              paidAt: transaction.transactionDate,
              method: "virement",
              reference: transaction.reference ?? statement.reference ?? undefined,
              notes: `Rapprochement décompte ${statement.thirdPartyName} — ${statement.periodLabel ?? ""}`,
              isReconciled: true,
            },
          });

          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: newStatus },
          });

          // Créer le rapprochement bancaire
          await tx.bankReconciliation.create({
            data: {
              transactionId,
              paymentId: payment.id,
              statementId: statement.id,
              isValidated: true,
              validatedAt: new Date(),
              validatedBy: session.user.id,
              notes: `Ventilation automatique — ${statement.thirdPartyName}`,
            },
          });
        }
      }

      // Marquer la transaction comme rapprochée
      await tx.bankTransaction.update({
        where: { id: transactionId },
        data: { isReconciled: true },
      });

      // Mettre à jour le décompte
      await tx.thirdPartyStatement.update({
        where: { id: statementId },
        data: {
          paidAmount: Math.abs(transaction.amount),
          paidAt: transaction.transactionDate,
        },
      });
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "BankReconciliation",
      entityId: transactionId,
      details: {
        statementId,
        action: "reconcile_statement",
        leasesCount: paymentInfos.length,
        totalAmount: Math.abs(transaction.amount),
      },
    });

    revalidatePath("/banque");
    revalidatePath("/releves-gestion");
    revalidatePath("/facturation");
    revalidatePath("/locataires");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[reconcileWithStatement]", error);
    return { success: false, error: "Erreur lors du rapprochement bancaire" };
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
    revalidatePath("/releves-gestion");
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
    revalidatePath("/releves-gestion");
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
      await tx.charge.deleteMany({ where: { statementId } });
      await tx.thirdPartyStatementLease.deleteMany({ where: { statementId } });
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
    revalidatePath("/releves-gestion");
    revalidatePath("/charges");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteStatement]", error);
    return { success: false, error: "Erreur lors de la suppression du relevé" };
  }
}
