"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { createDataroomSchema, updateDataroomSchema } from "@/validations/dataroom";
import bcrypt from "bcryptjs";
import { sendDataroomDocumentAddedEmail } from "@/lib/email";

// ─── Requêtes ─────────────────────────────────────────────────────────────────

export async function getDatarooms(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];
  await requireSocietyAccess(session.user.id, societyId);

  return prisma.dataroom.findMany({
    where: { societyId },
    include: {
      creator: { select: { name: true, email: true } },
      _count: { select: { documents: true, accesses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDataroom(societyId: string, dataroomId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  await requireSocietyAccess(session.user.id, societyId);

  return prisma.dataroom.findFirst({
    where: { id: dataroomId, societyId },
    include: {
      documents: {
        orderBy: { sortOrder: "asc" },
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              fileUrl: true,
              fileSize: true,
              mimeType: true,
              category: true,
              description: true,
              storagePath: true,
              aiStatus: true,
              createdAt: true,
            },
          },
        },
      },
      creator: { select: { name: true, email: true } },
      accesses: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { documents: true, accesses: true } },
    },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createDataroom(
  societyId: string,
  input: { name: string; description?: string | null; expiresAt?: string | null; password?: string | null; recipientEmail?: string | null; recipientName?: string | null; purpose?: string | null }
): Promise<ActionResult<{ id: string; token: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createDataroomSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : null;

    const dataroom = await prisma.dataroom.create({
      data: {
        societyId,
        createdBy: session.user.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        password: passwordHash,
        purpose: parsed.data.purpose ?? null,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Dataroom",
      entityId: dataroom.id,
      details: { name: dataroom.name },
    });

    revalidatePath("/dataroom");
    return { success: true, data: { id: dataroom.id, token: dataroom.shareToken || dataroom.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createDataroom]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateDataroom(
  societyId: string,
  dataroomId: string,
  input: { name?: string; description?: string | null; expiresAt?: string | null; password?: string | null; purpose?: string | null }
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateDataroomSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const dr = await prisma.dataroom.findFirst({ where: { id: dataroomId, societyId } });
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    // Handle password: empty string = remove password, non-empty = set new hash, undefined = don't change
    let passwordHashUpdate: { password: string | null } | undefined;
    if (parsed.data.password !== undefined) {
      passwordHashUpdate = {
        password: parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : null,
      };
    }

    await prisma.dataroom.update({
      where: { id: dataroomId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.purpose !== undefined && { purpose: parsed.data.purpose }),
        ...(passwordHashUpdate !== undefined && passwordHashUpdate),
        expiresAt:
          parsed.data.expiresAt !== undefined
            ? parsed.data.expiresAt
              ? new Date(parsed.data.expiresAt)
              : null
            : undefined,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Dataroom",
      entityId: dataroomId,
      details: parsed.data,
    });

    revalidatePath("/dataroom");
    revalidatePath(`/dataroom/${dataroomId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateDataroom]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteDataroom(societyId: string, dataroomId: string): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const dr = await prisma.dataroom.findFirst({ where: { id: dataroomId, societyId } });
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    await prisma.dataroom.delete({ where: { id: dataroomId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "Dataroom",
      entityId: dataroomId,
      details: { name: dr.name },
    });

    revalidatePath("/dataroom");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteDataroom]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

export async function addDocumentToDataroom(
  societyId: string,
  dataroomId: string,
  documentId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const [dr, doc] = await Promise.all([
      prisma.dataroom.findFirst({
        where: { id: dataroomId, societyId },
        include: { society: { select: { name: true } } },
      }),
      prisma.document.findFirst({ where: { id: documentId, societyId } }),
    ]);
    if (!dr) return { success: false, error: "Dataroom introuvable" };
    if (!doc) return { success: false, error: "Document introuvable" };

    const count = await prisma.dataroomDocument.count({ where: { dataroomId } });

    await prisma.dataroomDocument.upsert({
      where: { dataroomId_documentId: { dataroomId, documentId } },
      create: { dataroomId, documentId, sortOrder: count },
      update: {},
    });

    // Email notification skipped - recipientEmail not in current schema













    revalidatePath(`/dataroom/${dataroomId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[addDocumentToDataroom]", error);
    return { success: false, error: "Erreur lors de l'ajout" };
  }
}

export async function verifyDataroomPassword(
  token: string,
  password: string
): Promise<ActionResult> {
  try {
    const dataroom = await prisma.dataroom.findUnique({
      where: { shareToken: token },
      select: { id: true, password: true, status: true, expiresAt: true },
    });

    if (!dataroom || dataroom.status !== "ACTIF")
      return { success: false, error: "Dataroom introuvable ou inactive" };
    if (dataroom.expiresAt && new Date(dataroom.expiresAt) < new Date())
      return { success: false, error: "Cette dataroom a expiré" };
    if (!dataroom.password)
      return { success: true }; // no password required

    const valid = await bcrypt.compare(password, dataroom.password);
    if (!valid) return { success: false, error: "Mot de passe incorrect" };
    return { success: true };
  } catch (error) {
    console.error("[verifyDataroomPassword]", error);
    return { success: false, error: "Erreur lors de la vérification" };
  }
}

export async function removeDocumentFromDataroom(
  societyId: string,
  dataroomId: string,
  documentId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const dr = await prisma.dataroom.findFirst({ where: { id: dataroomId, societyId } });
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    await prisma.dataroomDocument.deleteMany({ where: { dataroomId, documentId } });

    revalidatePath(`/dataroom/${dataroomId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[removeDocumentFromDataroom]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}


// --- Fonctions complementaires ---

export async function getDataroomByToken(token: string) {
  const dataroom = await prisma.dataroom.findUnique({
    where: { shareToken: token },
    include: {
      society: { select: { name: true, logoUrl: true } },
      documents: {
        orderBy: { sortOrder: "asc" },
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              fileUrl: true,
              fileSize: true,
              mimeType: true,
              category: true,
              description: true,
              storagePath: true,
            },
          },
        },
      },
    },
  });

  if (!dataroom || dataroom.status !== "ACTIF") return null;
  if (dataroom.expiresAt && new Date(dataroom.expiresAt) < new Date()) return null;

  // Incrementer accessCount et creer un acces
  await Promise.all([
    prisma.dataroom.update({
      where: { id: dataroom.id },
      data: { accessCount: { increment: 1 } },
    }),
    prisma.dataroomAccess.create({
      data: { dataroomId: dataroom.id },
    }),
  ]);

  return dataroom;
}

export async function getDataroomsForDocument(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];
  await requireSocietyAccess(session.user.id, societyId);

  return prisma.dataroom.findMany({
    where: { societyId, status: "ACTIF" },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
}

export async function activateDataroom(
  societyId: string,
  dataroomId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const dr = await prisma.dataroom.findFirst({ where: { id: dataroomId, societyId } });
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    await prisma.dataroom.update({
      where: { id: dataroomId },
      data: { status: "ACTIF" },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Dataroom",
      entityId: dataroomId,
      details: { action: "activate" },
    });

    revalidatePath("/dataroom");
    revalidatePath("/dataroom/" + dataroomId);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[activateDataroom]", error);
    return { success: false, error: "Erreur lors de l'activation" };
  }
}

export async function archiveDataroom(
  societyId: string,
  dataroomId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const dr = await prisma.dataroom.findFirst({ where: { id: dataroomId, societyId } });
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    await prisma.dataroom.update({
      where: { id: dataroomId },
      data: { status: "ARCHIVE" },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Dataroom",
      entityId: dataroomId,
      details: { action: "archive" },
    });

    revalidatePath("/dataroom");
    revalidatePath("/dataroom/" + dataroomId);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[archiveDataroom]", error);
    return { success: false, error: "Erreur lors de l'archivage" };
  }
}
