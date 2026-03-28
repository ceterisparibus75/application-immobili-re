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
        orderBy: { order: "asc" },
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
  input: { name: string; description?: string | null; expiresAt?: string | null; password?: string | null; recipientEmail?: string | null; recipientName?: string | null }
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
        createdById: session.user.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        passwordHash,
        recipientEmail: parsed.data.recipientEmail ?? null,
        recipientName: parsed.data.recipientName ?? null,
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

    revalidatePath("/datarooms");
    return { success: true, data: { id: dataroom.id, token: dataroom.token } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createDataroom]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateDataroom(
  societyId: string,
  dataroomId: string,
  input: { name?: string; description?: string | null; expiresAt?: string | null; isActive?: boolean; password?: string | null; recipientEmail?: string | null; recipientName?: string | null }
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
    let passwordHashUpdate: { passwordHash: string | null } | undefined;
    if (parsed.data.password !== undefined) {
      passwordHashUpdate = {
        passwordHash: parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : null,
      };
    }

    await prisma.dataroom.update({
      where: { id: dataroomId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        ...(passwordHashUpdate !== undefined && passwordHashUpdate),
        ...(parsed.data.recipientEmail !== undefined && { recipientEmail: parsed.data.recipientEmail }),
        ...(parsed.data.recipientName !== undefined && { recipientName: parsed.data.recipientName }),
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

    revalidatePath("/datarooms");
    revalidatePath(`/datarooms/${dataroomId}`);
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

    revalidatePath("/datarooms");
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
      create: { dataroomId, documentId, order: count },
      update: {},
    });

    // Notifier le bénéficiaire si un email est configuré (non-bloquant)
    if (dr.recipientEmail) {
      const appUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "https://app.example.com";
      void sendDataroomDocumentAddedEmail({
        to: dr.recipientEmail,
        recipientName: dr.recipientName,
        dataroomName: dr.name,
        documentName: doc.fileName,
        documentCount: count + 1,
        dataroomUrl: `${appUrl}/dataroom/${dr.token}`,
        societyName: dr.society.name,
      }).catch((err) => console.error("[addDocumentToDataroom] email failed:", err));
    }

    revalidatePath(`/datarooms/${dataroomId}`);
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
      where: { token },
      select: { id: true, passwordHash: true, isActive: true, expiresAt: true },
    });

    if (!dataroom || !dataroom.isActive)
      return { success: false, error: "Dataroom introuvable ou inactive" };
    if (dataroom.expiresAt && new Date(dataroom.expiresAt) < new Date())
      return { success: false, error: "Cette dataroom a expiré" };
    if (!dataroom.passwordHash)
      return { success: true }; // no password required

    const valid = await bcrypt.compare(password, dataroom.passwordHash);
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

    revalidatePath(`/datarooms/${dataroomId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[removeDocumentFromDataroom]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
