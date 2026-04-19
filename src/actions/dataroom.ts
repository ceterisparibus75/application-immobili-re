"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { createDataroomSchema, updateDataroomSchema } from "@/validations/dataroom";
import bcrypt from "bcryptjs";
import { sendDataroomDocumentAddedEmail } from "@/lib/email";
import {
  getOptionalSocietyActionContext,
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

// ─── Requêtes ─────────────────────────────────────────────────────────────────

export async function getDatarooms(societyId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

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
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return null;

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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createDataroomSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : null;

    const dataroom = await prisma.dataroom.create({
      data: {
        societyId,
        createdBy: context.userId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        password: passwordHash,
        purpose: parsed.data.purpose ?? null,
        recipientEmail: parsed.data.recipientEmail ?? null,
        recipientName: parsed.data.recipientName ?? null,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Dataroom",
      entityId: dataroom.id,
      details: { name: dataroom.name },
    });

    revalidatePath("/dataroom");
    return { success: true, data: { id: dataroom.id, token: dataroom.shareToken || dataroom.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createDataroom]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateDataroom(
  societyId: string,
  dataroomId: string,
  input: { name?: string; description?: string | null; expiresAt?: string | null; password?: string | null; purpose?: string | null; recipientEmail?: string | null; recipientName?: string | null }
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

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
        ...(parsed.data.recipientEmail !== undefined && { recipientEmail: parsed.data.recipientEmail }),
        ...(parsed.data.recipientName !== undefined && { recipientName: parsed.data.recipientName }),
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
      userId: context.userId,
      action: "UPDATE",
      entity: "Dataroom",
      entityId: dataroomId,
      details: parsed.data,
    });

    revalidatePath("/dataroom");
    revalidatePath(`/dataroom/${dataroomId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateDataroom]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteDataroom(societyId: string, dataroomId: string): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const dr = await prisma.dataroom.findFirst({ where: { id: dataroomId, societyId } });
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    await prisma.dataroom.delete({ where: { id: dataroomId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "Dataroom",
      entityId: dataroomId,
      details: { name: dr.name },
    });

    revalidatePath("/dataroom");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");

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

    // Envoyer notification au destinataire externe si configuré
    if (dr.recipientEmail && dr.shareToken) {
      const newCount = await prisma.dataroomDocument.count({ where: { dataroomId } });
      const appUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "https://app.example.com";
      void sendDataroomDocumentAddedEmail({
        to: dr.recipientEmail,
        recipientName: dr.recipientName ?? null,
        dataroomName: dr.name,
        documentName: doc.fileName,
        documentCount: newCount,
        dataroomUrl: `${appUrl}/dataroom/share/${dr.shareToken}`,
        societyName: dr.society.name,
      }).catch((err) => console.error("[addDocumentToDataroom] email failed:", err));
    }










    revalidatePath(`/dataroom/${dataroomId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const dr = await prisma.dataroom.findFirst({ where: { id: dataroomId, societyId } });
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    await prisma.dataroomDocument.deleteMany({ where: { dataroomId, documentId } });

    revalidatePath(`/dataroom/${dataroomId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const dr = await prisma.dataroom.findFirst({ where: { id: dataroomId, societyId } });
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    await prisma.dataroom.update({
      where: { id: dataroomId },
      data: { status: "ACTIF" },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Dataroom",
      entityId: dataroomId,
      details: { action: "activate" },
    });

    revalidatePath("/dataroom");
    revalidatePath("/dataroom/" + dataroomId);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const dr = await prisma.dataroom.findFirst({ where: { id: dataroomId, societyId } });
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    await prisma.dataroom.update({
      where: { id: dataroomId },
      data: { status: "ARCHIVE" },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Dataroom",
      entityId: dataroomId,
      details: { action: "archive" },
    });

    revalidatePath("/dataroom");
    revalidatePath("/dataroom/" + dataroomId);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[archiveDataroom]", error);
    return { success: false, error: "Erreur lors de l'archivage" };
  }
}

export async function reorderDocument(
  societyId: string,
  dataroomId: string,
  documentId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  try {
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const dr = await prisma.dataroom.findFirst({ where: { id: dataroomId, societyId } });
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    const docs = await prisma.dataroomDocument.findMany({
      where: { dataroomId },
      orderBy: { sortOrder: "asc" },
    });

    const idx = docs.findIndex((d) => d.documentId === documentId);
    if (idx < 0) return { success: false, error: "Document introuvable" };

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= docs.length) return { success: true };

    await prisma.$transaction([
      prisma.dataroomDocument.update({
        where: { id: docs[idx].id },
        data: { sortOrder: docs[targetIdx].sortOrder },
      }),
      prisma.dataroomDocument.update({
        where: { id: docs[targetIdx].id },
        data: { sortOrder: docs[idx].sortOrder },
      }),
    ]);

    revalidatePath(`/dataroom/${dataroomId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[reorderDocument]", error);
    return { success: false, error: "Erreur lors de la réorganisation" };
  }
}

/** Retourne les métadonnées publiques d'une dataroom (sans incrémenter le compteur). */
export async function getDataroomMeta(token: string) {
  const dataroom = await prisma.dataroom.findUnique({
    where: { shareToken: token },
    select: {
      name: true,
      description: true,
      purpose: true,
      expiresAt: true,
      status: true,
      password: true,
      society: { select: { name: true, logoUrl: true } },
    },
  });

  if (!dataroom || dataroom.status !== "ACTIF") return null;
  if (dataroom.expiresAt && new Date(dataroom.expiresAt) < new Date()) return null;

  return {
    name: dataroom.name,
    description: dataroom.description,
    purpose: dataroom.purpose,
    expiresAt: dataroom.expiresAt,
    society: dataroom.society,
    hasPassword: !!dataroom.password,
  };
}
