"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { encrypt, decrypt } from "@/lib/encryption";
import { createQontoTransfer } from "@/lib/qonto";
import type { ActionResult } from "@/actions/society";
import {
  uploadSupplierInvoiceSchema,
  updateSupplierInvoiceDataSchema,
  validateSupplierInvoiceSchema,
  rejectSupplierInvoiceSchema,
  markSupplierInvoicePaidSchema,
  type UploadSupplierInvoiceInput,
  type UpdateSupplierInvoiceDataInput,
  type MarkSupplierInvoicePaidInput,
} from "@/validations/supplier-invoice";

const REVALIDATE_PATH = "/banque/factures-fournisseurs";

// ─── Upload manuel d'une facture fournisseur ──────────────────────────────────

export async function uploadSupplierInvoice(
  societyId: string,
  input: UploadSupplierInvoiceInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = uploadSupplierInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const invoice = await prisma.supplierInvoice.create({
      data: {
        societyId,
        fileName: parsed.data.fileName,
        storagePath: parsed.data.storagePath,
        fileUrl: parsed.data.fileUrl,
        fileSize: parsed.data.fileSize ?? null,
        status: "PENDING_REVIEW",
        source: "manual_upload",
        aiStatus: "pending",
        reference: `FINV-${Date.now()}`,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "SupplierInvoice",
      entityId: invoice.id,
      details: { fileName: parsed.data.fileName, source: "manual_upload" },
    });

    revalidatePath(REVALIDATE_PATH);
    return { success: true, data: { id: invoice.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[uploadSupplierInvoice]", error);
    return { success: false, error: "Erreur lors de l'upload" };
  }
}

// ─── Liste paginée ────────────────────────────────────────────────────────────

export async function getSupplierInvoicesPaginated(
  societyId: string,
  params: {
    page?: number;
    pageSize?: number;
    status?: string;
    buildingId?: string;
    search?: string;
    sortOrder?: "asc" | "desc";
  } = {}
): Promise<{
  data: Awaited<ReturnType<typeof prisma.supplierInvoice.findMany>>;
  total: number;
}> {
  const session = await auth();
  if (!session?.user?.id) return { data: [], total: 0 };

  await requireSocietyAccess(session.user.id, societyId);

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const skip = (page - 1) * pageSize;
  const sortOrder = params.sortOrder ?? "desc";

  const where: Record<string, unknown> = { societyId };

  if (params.status) where.status = params.status;
  if (params.buildingId) where.buildingId = params.buildingId;

  if (params.search) {
    const q = params.search;
    where.OR = [
      { supplierName: { contains: q, mode: "insensitive" } },
      { invoiceNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.supplierInvoice.findMany({
      where,
      include: {
        building: { select: { name: true } },
        lease: { select: { lot: { select: { number: true } } } },
      },
      orderBy: { createdAt: sortOrder },
      skip,
      take: pageSize,
    }),
    prisma.supplierInvoice.count({ where }),
  ]);

  return { data, total };
}

// ─── Détail d'une facture ─────────────────────────────────────────────────────

export async function getSupplierInvoiceById(
  societyId: string,
  invoiceId: string
) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.supplierInvoice.findFirst({
    where: { id: invoiceId, societyId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      societyId: true,
      status: true,
      reference: true,
      source: true,
      senderEmail: true,
      emailSubject: true,
      receivedAt: true,
      fileName: true,
      fileUrl: true,
      storagePath: true,
      fileSize: true,
      mimeType: true,
      supplierName: true,
      supplierSiret: true,
      supplierAddress: true,
      // supplierIbanEncrypted intentionnellement exclu
      supplierBic: true,
      invoiceNumber: true,
      invoiceDate: true,
      dueDate: true,
      amountHT: true,
      amountVAT: true,
      amountTTC: true,
      vatRate: true,
      currency: true,
      description: true,
      periodStart: true,
      periodEnd: true,
      aiAnalyzedAt: true,
      aiConfidence: true,
      aiRawMetadata: true,
      aiStatus: true,
      buildingId: true,
      leaseId: true,
      categoryId: true,
      chargeId: true,
      journalEntryId: true,
      paymentMethod: true,
      paymentStatus: true,
      paymentScheduledAt: true,
      paymentExecutedAt: true,
      paymentReference: true,
      bankAccountId: true,
      sepaXmlUrl: true,
      sepaXmlStoragePath: true,
      qontoTransferId: true,
      bankJournalEntryId: true,
      rejectedAt: true,
      rejectedBy: true,
      rejectionReason: true,
      validatedAt: true,
      validatedBy: true,
      building: { select: { id: true, name: true, city: true } },
      lease: {
        select: {
          id: true,
          lot: {
            select: {
              id: true,
              number: true,
              building: { select: { id: true, name: true } },
            },
          },
        },
      },
      category: { select: { id: true, name: true, nature: true } },
      charge: { select: { id: true, amount: true, isPaid: true } },
      bankAccount: { select: { id: true, bankName: true, accountName: true } },
    },
  });
}

// ─── Mise à jour des données ──────────────────────────────────────────────────

export async function updateSupplierInvoiceData(
  societyId: string,
  input: UpdateSupplierInvoiceDataInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateSupplierInvoiceDataSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const existing = await prisma.supplierInvoice.findFirst({
      where: { id: parsed.data.id, societyId },
    });
    if (!existing) return { success: false, error: "Facture introuvable" };

    // Extraire supplierIban pour chiffrement, ne pas le stocker en clair
    const { id, supplierIban, invoiceDate, dueDate, periodStart, periodEnd, ...rest } =
      parsed.data;

    // Construire l'objet de mise à jour
    const updateData: Record<string, unknown> = { ...rest };

    if (supplierIban !== undefined) {
      updateData.supplierIbanEncrypted =
        supplierIban != null ? encrypt(supplierIban) : null;
    }

    if (invoiceDate !== undefined) {
      updateData.invoiceDate = invoiceDate != null ? new Date(invoiceDate) : null;
    }
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate != null ? new Date(dueDate) : null;
    }
    if (periodStart !== undefined) {
      updateData.periodStart = periodStart != null ? new Date(periodStart) : null;
    }
    if (periodEnd !== undefined) {
      updateData.periodEnd = periodEnd != null ? new Date(periodEnd) : null;
    }

    await prisma.supplierInvoice.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "SupplierInvoice",
      entityId: id,
      details: { updatedFields: Object.keys(updateData) },
    });

    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateSupplierInvoiceData]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

// ─── Validation → création Charge + écriture comptable ───────────────────────

export async function validateSupplierInvoice(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ chargeId: string; journalEntryId: string | null }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = validateSupplierInvoiceSchema.safeParse({ invoiceId });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const invoice = await prisma.supplierInvoice.findFirst({
      where: { id: invoiceId, societyId },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (invoice.status !== "PENDING_REVIEW") {
      return { success: false, error: "Seules les factures en attente de révision peuvent être validées" };
    }

    // Vérification des champs obligatoires
    if (!invoice.buildingId) return { success: false, error: "Veuillez associer un immeuble avant de valider" };
    if (!invoice.categoryId) return { success: false, error: "Veuillez sélectionner une catégorie avant de valider" };
    if (invoice.amountTTC == null) return { success: false, error: "Le montant TTC est requis" };
    if (!invoice.supplierName) return { success: false, error: "Le nom du fournisseur est requis" };
    if (!invoice.invoiceDate) return { success: false, error: "La date de facture est requise" };

    const result = await prisma.$transaction(async (tx) => {
      // 1. Créer la Charge
      const charge = await tx.charge.create({
        data: {
          societyId,
          buildingId: invoice.buildingId!,
          categoryId: invoice.categoryId!,
          description: `Facture ${invoice.supplierName}${invoice.invoiceNumber ? " n°" + invoice.invoiceNumber : ""}`,
          amount: invoice.amountTTC!,
          date: new Date(invoice.invoiceDate!),
          periodStart: invoice.periodStart ?? new Date(invoice.invoiceDate!),
          periodEnd: invoice.periodEnd ?? new Date(invoice.invoiceDate!),
          supplierName: invoice.supplierName,
          invoiceUrl: invoice.fileUrl,
          isPaid: false,
        },
      });

      // 2. Chercher les comptes comptables (best effort)
      const [compte60, compte401] = await Promise.all([
        tx.accountingAccount.findFirst({
          where: { societyId, code: { startsWith: "60" }, isActive: true },
          orderBy: { code: "asc" },
        }),
        tx.accountingAccount.findFirst({
          where: { societyId, code: { startsWith: "401" }, isActive: true },
          orderBy: { code: "asc" },
        }),
      ]);

      // 3. Créer l'écriture comptable AC si les comptes existent
      let journalEntryId: string | null = null;

      if (compte60 && compte401) {
        const lines: Array<{
          accountId: string;
          debit: number;
          credit: number;
          label: string;
        }> = [
          {
            accountId: compte60.id,
            debit: invoice.amountHT ?? invoice.amountTTC!,
            credit: 0,
            label: invoice.description ?? invoice.supplierName!,
          },
          {
            accountId: compte401.id,
            debit: 0,
            credit: invoice.amountTTC!,
            label: invoice.supplierName!,
          },
        ];

        // Ajouter la ligne TVA si applicable
        if (invoice.amountVAT && invoice.amountVAT > 0) {
          const compte44566 = await tx.accountingAccount.findFirst({
            where: { societyId, code: { startsWith: "445" }, isActive: true },
          });
          if (compte44566) {
            lines.splice(1, 0, {
              accountId: compte44566.id,
              debit: invoice.amountVAT,
              credit: 0,
              label: "TVA déductible",
            });
          }
        }

        const entry = await tx.journalEntry.create({
          data: {
            societyId,
            journalType: "AC",
            entryDate: new Date(invoice.invoiceDate!),
            piece: invoice.invoiceNumber ?? undefined,
            label: `Facture fournisseur - ${invoice.supplierName}`,
            status: "BROUILLON",
            lines: { create: lines },
          },
        });
        journalEntryId = entry.id;
      }

      // 4. Mettre à jour le statut de la facture
      await tx.supplierInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "VALIDATED",
          chargeId: charge.id,
          journalEntryId,
          validatedAt: new Date(),
          validatedBy: session.user.id,
        },
      });

      return { chargeId: charge.id, journalEntryId };
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "SupplierInvoice",
      entityId: invoiceId,
      details: {
        action: "validated",
        chargeId: result.chargeId,
        journalEntryId: result.journalEntryId,
      },
    });

    revalidatePath(REVALIDATE_PATH);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[validateSupplierInvoice]", error);
    return { success: false, error: "Erreur lors de la validation" };
  }
}

// ─── Rejet ────────────────────────────────────────────────────────────────────

export async function rejectSupplierInvoice(
  societyId: string,
  invoiceId: string,
  reason: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = rejectSupplierInvoiceSchema.safeParse({ invoiceId, reason });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const existing = await prisma.supplierInvoice.findFirst({
      where: { id: invoiceId, societyId },
    });
    if (!existing) return { success: false, error: "Facture introuvable" };

    await prisma.supplierInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectedBy: session.user.id,
        rejectionReason: reason,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "SupplierInvoice",
      entityId: invoiceId,
      details: { action: "rejected", reason },
    });

    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[rejectSupplierInvoice]", error);
    return { success: false, error: "Erreur lors du rejet" };
  }
}

// ─── Marquage paiement manuel ─────────────────────────────────────────────────

export async function markSupplierInvoicePaid(
  societyId: string,
  input: MarkSupplierInvoicePaidInput
): Promise<ActionResult<{ bankJournalEntryId: string | null }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = markSupplierInvoicePaidSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const invoice = await prisma.supplierInvoice.findFirst({
      where: { id: parsed.data.invoiceId, societyId },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (invoice.status !== "VALIDATED") {
      return { success: false, error: "Seules les factures validées peuvent être marquées comme payées" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Chercher les comptes 401 et 512
      const [compte401, compte512] = await Promise.all([
        tx.accountingAccount.findFirst({
          where: { societyId, code: { startsWith: "401" }, isActive: true },
          orderBy: { code: "asc" },
        }),
        tx.accountingAccount.findFirst({
          where: { societyId, code: { startsWith: "512" }, isActive: true },
          orderBy: { code: "asc" },
        }),
      ]);

      // 2. Créer l'écriture bancaire BQUE si les comptes existent
      let bankJournalEntryId: string | null = null;

      if (compte401 && compte512 && invoice.amountTTC != null) {
        const entry = await tx.journalEntry.create({
          data: {
            societyId,
            journalType: "BQUE",
            entryDate: new Date(parsed.data.paidAt),
            piece: parsed.data.reference ?? undefined,
            label: `Règlement facture fournisseur - ${invoice.supplierName ?? invoice.reference}`,
            status: "BROUILLON",
            lines: {
              create: [
                {
                  accountId: compte401.id,
                  debit: invoice.amountTTC,
                  credit: 0,
                  label: invoice.supplierName ?? "",
                },
                {
                  accountId: compte512.id,
                  debit: 0,
                  credit: invoice.amountTTC,
                  label: invoice.supplierName ?? "",
                },
              ],
            },
          },
        });
        bankJournalEntryId = entry.id;
      }

      // 3. Marquer la charge comme payée
      if (invoice.chargeId) {
        await tx.charge.update({
          where: { id: invoice.chargeId },
          data: { isPaid: true },
        });
      }

      // 4. Mettre à jour la facture fournisseur
      await tx.supplierInvoice.update({
        where: { id: parsed.data.invoiceId },
        data: {
          status: "PAID",
          paymentMethod: "MANUAL",
          paymentStatus: "SUBMITTED",
          paymentExecutedAt: new Date(parsed.data.paidAt),
          paymentReference: parsed.data.reference ?? null,
          bankAccountId: parsed.data.bankAccountId,
          bankJournalEntryId,
        },
      });

      return { bankJournalEntryId };
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "SupplierInvoice",
      entityId: parsed.data.invoiceId,
      details: {
        action: "marked_paid",
        paidAt: parsed.data.paidAt,
        bankAccountId: parsed.data.bankAccountId,
      },
    });

    revalidatePath(REVALIDATE_PATH);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[markSupplierInvoicePaid]", error);
    return { success: false, error: "Erreur lors du marquage comme payé" };
  }
}

// ─── Initiation d'un virement Qonto ──────────────────────────────────────────

export async function initiateQontoPayment(
  societyId: string,
  invoiceId: string,
  bankAccountId: string
): Promise<ActionResult<{ qontoTransferId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const invoice = await prisma.supplierInvoice.findFirst({
      where: { id: invoiceId, societyId },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (invoice.status !== "VALIDATED") {
      return { success: false, error: "Seules les factures validées peuvent être payées via Qonto" };
    }
    if (!invoice.supplierIbanEncrypted) {
      return { success: false, error: "L'IBAN du fournisseur est requis pour un virement Qonto" };
    }
    if (invoice.amountTTC == null) {
      return { success: false, error: "Le montant TTC est requis" };
    }
    if (!invoice.supplierName) {
      return { success: false, error: "Le nom du fournisseur est requis" };
    }

    // Récupérer le compte bancaire et la connexion Qonto
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, societyId },
      include: {
        connection: true,
      },
    });

    if (!bankAccount) return { success: false, error: "Compte bancaire introuvable" };
    if (!bankAccount.connection) return { success: false, error: "Aucune connexion bancaire associée à ce compte" };
    if (bankAccount.connection.provider !== "QONTO") {
      return { success: false, error: "Ce compte n'est pas un compte Qonto" };
    }
    if (
      !bankAccount.connection.qontoSlugEncrypted ||
      !bankAccount.connection.qontoSecretKeyEncrypted
    ) {
      return { success: false, error: "Identifiants Qonto manquants" };
    }
    if (!bankAccount.qontoAccountId) {
      return { success: false, error: "Identifiant de compte Qonto manquant" };
    }

    // Déchiffrer les identifiants Qonto
    const qontoSlug = decrypt(bankAccount.connection.qontoSlugEncrypted);
    const qontoSecretKey = decrypt(bankAccount.connection.qontoSecretKeyEncrypted);
    const supplierIban = decrypt(invoice.supplierIbanEncrypted);

    // Initier le virement via l'API Qonto
    const transfer = await createQontoTransfer(
      qontoSlug,
      qontoSecretKey,
      bankAccount.qontoAccountId,
      {
        beneficiary_name: invoice.supplierName,
        beneficiary_iban: supplierIban,
        beneficiary_bic: invoice.supplierBic ?? undefined,
        amount_cents: Math.round(invoice.amountTTC * 100),
        currency: "EUR",
        note: invoice.description ?? undefined,
        reference: invoice.invoiceNumber ?? undefined,
      }
    );

    // Mettre à jour la facture
    await prisma.supplierInvoice.update({
      where: { id: invoiceId },
      data: {
        paymentMethod: "QONTO",
        paymentStatus: "SUBMITTED",
        qontoTransferId: transfer.id,
        paymentScheduledAt: new Date(),
        bankAccountId,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "SupplierInvoice",
      entityId: invoiceId,
      details: {
        action: "qonto_payment_initiated",
        qontoTransferId: transfer.id,
        bankAccountId,
      },
    });

    revalidatePath(REVALIDATE_PATH);
    return { success: true, data: { qontoTransferId: transfer.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[initiateQontoPayment]", error);
    return { success: false, error: "Erreur lors de l'initiation du virement Qonto" };
  }
}
