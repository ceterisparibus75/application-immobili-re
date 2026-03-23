"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
