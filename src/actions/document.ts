"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const updateDocumentSchema = z.object({
  category: z.string().min(1, "Catégorie requise"),
  description: z.string().max(500, "Description trop longue").optional().nullable(),
  expiresAt: z.string().optional().nullable(),
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
  const session = await auth();
  if (!session?.user?.id) return [];
  await requireSocietyAccess(session.user.id, societyId);

  return prisma.document.findMany({
    where: {
      societyId,
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
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateDocument(
  societyId: string,
  documentId: string,
  input: { category: string; description?: string | null; expiresAt?: string | null }
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateDocumentSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const doc = await prisma.document.findFirst({ where: { id: documentId, societyId } });
    if (!doc) return { success: false, error: "Document introuvable" };

    await prisma.document.update({
      where: { id: documentId },
      data: {
        category: parsed.data.category,
        description: parsed.data.description ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Document",
      entityId: documentId,
      details: { category: parsed.data.category, description: parsed.data.description },
    });

    revalidatePath("/documents");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateDocument]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteDocument(
  societyId: string,
  documentId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const doc = await prisma.document.findFirst({ where: { id: documentId, societyId } });
    if (!doc) return { success: false, error: "Document introuvable" };

    // Supprimer le fichier de Supabase Storage (best-effort)
    const storagePath = doc.fileUrl.includes("storage/v1/object")
      ? doc.fileUrl.split("/").slice(-3).join("/")
      : null;
    if (storagePath) {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
        .remove([storagePath])
        .catch(() => null);
    }

    await prisma.document.delete({ where: { id: documentId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "Document",
      entityId: documentId,
      details: { fileName: doc.fileName, category: doc.category },
    });

    revalidatePath("/documents");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteDocument]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
