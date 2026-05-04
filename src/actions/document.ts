"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { z } from "zod";
import {
  getOptionalSocietyActionContext,
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

const updateDocumentSchema = z.object({
  category: z.string().min(1, "Catégorie requise"),
  description: z.string().max(500, "Description trop longue").optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  userTags: z.array(z.string().max(50)).max(20).optional(),
});

export async function getDocuments(
  societyId: string,
  filters?: {
    buildingId?: string;
    lotId?: string;
    leaseId?: string;
    tenantId?: string;
    category?: string;
  }
) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.document.findMany({
    where: {
      societyId,
      deletedAt: null,
      versionOf: null, // only show top-level documents (not sub-versions)
      ...(filters?.buildingId ? { buildingId: filters.buildingId } : {}),
      ...(filters?.lotId ? { lotId: filters.lotId } : {}),
      ...(filters?.leaseId ? { leaseId: filters.leaseId } : {}),
      ...(filters?.tenantId ? { tenantId: filters.tenantId } : {}),
      ...(filters?.category ? { category: filters.category } : {}),
    },
    include: {
      building: { select: { id: true, name: true, city: true } },
      lot: { select: { id: true, number: true, building: { select: { name: true } } } },
      lease: {
        select: {
          id: true,
          lot: { select: { number: true, building: { select: { name: true } } } },
          tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
        },
      },
      tenant: { select: { id: true, firstName: true, lastName: true, companyName: true, entityType: true } },
      versions: {
        where: { deletedAt: null },
        orderBy: { versionNumber: "desc" },
        select: { id: true, fileName: true, versionNumber: true, createdAt: true, fileUrl: true, storagePath: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateDocument(
  societyId: string,
  documentId: string,
  input: { category: string; description?: string | null; expiresAt?: string | null; userTags?: string[] }
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateDocumentSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const doc = await prisma.document.findFirst({ where: { id: documentId, societyId, deletedAt: null } });
    if (!doc) return { success: false, error: "Document introuvable" };

    await prisma.document.update({
      where: { id: documentId },
      data: {
        category: parsed.data.category,
        description: parsed.data.description ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        userTags: parsed.data.userTags ?? [],
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Document",
      entityId: documentId,
      details: { category: parsed.data.category, description: parsed.data.description, userTags: parsed.data.userTags },
    });

    revalidatePath("/documents");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateDocument]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteDocument(societyId: string, documentId: string): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const doc = await prisma.document.findFirst({ where: { id: documentId, societyId, deletedAt: null } });
    if (!doc) return { success: false, error: "Document introuvable" };

    await prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date(), deletedBy: context.userId, archivedReason: "Suppression utilisateur" },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "Document",
      entityId: documentId,
      details: { fileName: doc.fileName, category: doc.category },
    });

    revalidatePath("/documents");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteDocument]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

export async function createDocumentVersion(
  societyId: string,
  parentDocumentId: string,
  input: { fileName: string; fileUrl: string; storagePath: string; fileSize?: number; mimeType?: string }
): Promise<ActionResult<{ id: string; versionNumber: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parent = await prisma.document.findFirst({
      where: { id: parentDocumentId, societyId, deletedAt: null, versionOf: null },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!parent) return { success: false, error: "Document parent introuvable" };

    const latestVersion = parent.versions[0]?.versionNumber ?? parent.versionNumber;
    const nextVersion = latestVersion + 1;

    const version = await prisma.document.create({
      data: {
        societyId,
        versionOf: parentDocumentId,
        versionNumber: nextVersion,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        storagePath: input.storagePath,
        fileSize: input.fileSize ?? null,
        mimeType: input.mimeType ?? null,
        category: parent.category,
        description: parent.description,
        buildingId: parent.buildingId,
        lotId: parent.lotId,
        leaseId: parent.leaseId,
        tenantId: parent.tenantId,
        aiStatus: input.mimeType === "application/pdf" ? "pending" : null,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Document",
      entityId: version.id,
      details: { type: "version", parentId: parentDocumentId, versionNumber: nextVersion, fileName: input.fileName },
    });

    revalidatePath("/documents");
    return { success: true, data: { id: version.id, versionNumber: nextVersion } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createDocumentVersion]", error);
    return { success: false, error: "Erreur lors de la création de la version" };
  }
}

export async function bulkUpdateCategory(
  societyId: string,
  documentIds: string[],
  category: string
): Promise<ActionResult<{ updated: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");
    if (!documentIds.length) return { success: false, error: "Aucun document sélectionné" };
    if (!category) return { success: false, error: "Catégorie requise" };

    const result = await prisma.document.updateMany({
      where: { id: { in: documentIds }, societyId, deletedAt: null },
      data: { category },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Document",
      entityId: documentIds[0],
      details: { type: "bulk_category", category, count: result.count },
    });

    revalidatePath("/documents");
    return { success: true, data: { updated: result.count } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[bulkUpdateCategory]", error);
    return { success: false, error: "Erreur lors de la mise à jour groupée" };
  }
}

export async function getExpiringDocuments(societyId: string, days = 30) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return { expired: [], expiringSoon: [] };

  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 3600 * 1000);

  const [expired, expiringSoon] = await Promise.all([
    prisma.document.findMany({
      where: { societyId, deletedAt: null, versionOf: null, expiresAt: { lt: now } },
      include: { building: { select: { name: true } } },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.document.findMany({
      where: { societyId, deletedAt: null, versionOf: null, expiresAt: { gte: now, lte: future } },
      include: { building: { select: { name: true } } },
      orderBy: { expiresAt: "asc" },
    }),
  ]);

  return { expired, expiringSoon };
}