"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/actions/society";
import { createDataroomSchema, updateDataroomSchema } from "@/validations/dataroom";
import bcrypt from "bcryptjs";
import { sendDataroomDocumentAddedEmail } from "@/lib/email";
import {
  getOptionalSocietyActionContext,
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import { env } from "@/lib/env";

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
  input: {
    name: string;
    description?: string | null;
    expiresAt?: string | null;
    password?: string | null;
    recipientEmail?: string | null;
    recipientName?: string | null;
    purpose?: string | null;
    templateKey?: string | null;
    accessMode?: "LINK" | "EMAIL_REQUIRED";
    allowDownload?: boolean;
    allowPrint?: boolean;
    watermarkEnabled?: boolean;
    ndaRequired?: boolean;
    groups?: unknown;
    checklist?: unknown;
    qnaEnabled?: boolean;
    qna?: unknown;
    branding?: unknown;
    reportSettings?: unknown;
  }
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
        templateKey: parsed.data.templateKey ?? null,
        accessMode: parsed.data.accessMode ?? "LINK",
        allowDownload: parsed.data.allowDownload ?? true,
        allowPrint: parsed.data.allowPrint ?? false,
        watermarkEnabled: parsed.data.watermarkEnabled ?? false,
        ndaRequired: parsed.data.ndaRequired ?? false,
        groups: parsed.data.groups === undefined ? undefined : (parsed.data.groups as Prisma.InputJsonValue),
        checklist: parsed.data.checklist === undefined ? undefined : (parsed.data.checklist as Prisma.InputJsonValue),
        qnaEnabled: parsed.data.qnaEnabled ?? false,
        qna: parsed.data.qna === undefined ? undefined : (parsed.data.qna as Prisma.InputJsonValue),
        branding: parsed.data.branding === undefined ? undefined : (parsed.data.branding as Prisma.InputJsonValue),
        reportSettings: parsed.data.reportSettings === undefined ? undefined : (parsed.data.reportSettings as Prisma.InputJsonValue),
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
  input: {
    name?: string;
    description?: string | null;
    expiresAt?: string | null;
    password?: string | null;
    purpose?: string | null;
    recipientEmail?: string | null;
    recipientName?: string | null;
    status?: "BROUILLON" | "ACTIF" | "ARCHIVE";
    templateKey?: string | null;
    accessMode?: "LINK" | "EMAIL_REQUIRED";
    allowDownload?: boolean;
    allowPrint?: boolean;
    watermarkEnabled?: boolean;
    ndaRequired?: boolean;
    groups?: unknown;
    checklist?: unknown;
    qnaEnabled?: boolean;
    qna?: unknown;
    branding?: unknown;
    reportSettings?: unknown;
  }
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
        ...(parsed.data.templateKey !== undefined && { templateKey: parsed.data.templateKey }),
        ...(parsed.data.accessMode !== undefined && { accessMode: parsed.data.accessMode }),
        ...(parsed.data.allowDownload !== undefined && { allowDownload: parsed.data.allowDownload }),
        ...(parsed.data.allowPrint !== undefined && { allowPrint: parsed.data.allowPrint }),
        ...(parsed.data.watermarkEnabled !== undefined && { watermarkEnabled: parsed.data.watermarkEnabled }),
        ...(parsed.data.ndaRequired !== undefined && { ndaRequired: parsed.data.ndaRequired }),
        ...(parsed.data.groups !== undefined && { groups: parsed.data.groups as Prisma.InputJsonValue }),
        ...(parsed.data.checklist !== undefined && { checklist: parsed.data.checklist as Prisma.InputJsonValue }),
        ...(parsed.data.qnaEnabled !== undefined && { qnaEnabled: parsed.data.qnaEnabled }),
        ...(parsed.data.qna !== undefined && { qna: parsed.data.qna as Prisma.InputJsonValue }),
        ...(parsed.data.branding !== undefined && { branding: parsed.data.branding as Prisma.InputJsonValue }),
        ...(parsed.data.reportSettings !== undefined && { reportSettings: parsed.data.reportSettings as Prisma.InputJsonValue }),
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const [dr, doc, sharedBy] = await Promise.all([
      prisma.dataroom.findFirst({
        where: { id: dataroomId, societyId },
        include: { society: { select: { name: true } } },
      }),
      prisma.document.findFirst({ where: { id: documentId, societyId } }),
      prisma.user.findUnique({
        where: { id: context.userId },
        select: { name: true, email: true },
      }),
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
      const appUrl = env.AUTH_URL ?? "https://app.example.com";
      void sendDataroomDocumentAddedEmail({
        to: dr.recipientEmail,
        recipientName: dr.recipientName ?? null,
        dataroomName: dr.name,
        documentName: doc.fileName,
        documentCount: newCount,
        dataroomUrl: `${appUrl}/dataroom/share/${dr.shareToken}`,
        societyName: dr.society.name,
        sharedByName: sharedBy?.name ?? null,
        sharedByEmail: sharedBy?.email ?? null,
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

export async function updateDataroomDocumentSettings(
  societyId: string,
  dataroomId: string,
  documentId: string,
  input: {
    accessLevel?: "INHERIT" | "VISIBLE" | "HIDDEN";
    allowDownload?: boolean | null;
    watermarkEnabled?: boolean | null;
    visibleToGroups?: unknown;
    section?: string | null;
  }
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const dr = await prisma.dataroom.findFirst({ where: { id: dataroomId, societyId } });
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    await prisma.dataroomDocument.updateMany({
      where: { dataroomId, documentId },
      data: {
        ...(input.accessLevel !== undefined && { accessLevel: input.accessLevel }),
        ...(input.allowDownload !== undefined && { allowDownload: input.allowDownload }),
        ...(input.watermarkEnabled !== undefined && { watermarkEnabled: input.watermarkEnabled }),
        ...(input.visibleToGroups !== undefined && { visibleToGroups: input.visibleToGroups as Prisma.InputJsonValue }),
        ...(input.section !== undefined && { section: input.section }),
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "DataroomDocument",
      entityId: documentId,
      details: { dataroomId, ...input },
    });

    revalidatePath(`/dataroom/${dataroomId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateDataroomDocumentSettings]", error);
    return { success: false, error: "Erreur lors de la mise à jour du document" };
  }
}

type DataroomQuestion = {
  id: string;
  category: string;
  question: string;
  askedBy: string;
  askedAt: string;
  status: "OUVERTE" | "REPONDUE" | "CLOTUREE";
  answer?: string;
  answeredBy?: string;
  answeredAt?: string;
};

function readQna(value: unknown): DataroomQuestion[] {
  return Array.isArray(value) ? value as DataroomQuestion[] : [];
}

export async function addDataroomQuestion(
  societyId: string,
  dataroomId: string,
  input: { question: string; category?: string; askedBy?: string }
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");
    const dr = await prisma.dataroom.findFirst({ where: { id: dataroomId, societyId }, select: { qna: true } });
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    const question = input.question.trim();
    if (question.length < 3) return { success: false, error: "Question trop courte" };

    const qna = readQna(dr.qna);
    const next: DataroomQuestion[] = [
      {
        id: `q_${Date.now()}`,
        category: input.category?.trim() || "Général",
        question,
        askedBy: input.askedBy?.trim() || "Interne",
        askedAt: new Date().toISOString(),
        status: "OUVERTE",
      },
      ...qna,
    ];

    await prisma.dataroom.update({
      where: { id: dataroomId },
      data: { qnaEnabled: true, qna: next as Prisma.InputJsonValue },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "DataroomQuestion",
      entityId: dataroomId,
      details: { question },
    });

    revalidatePath(`/dataroom/${dataroomId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[addDataroomQuestion]", error);
    return { success: false, error: "Erreur lors de l'ajout de la question" };
  }
}

export async function answerDataroomQuestion(
  societyId: string,
  dataroomId: string,
  questionId: string,
  answer: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");
    const [dr, user] = await Promise.all([
      prisma.dataroom.findFirst({ where: { id: dataroomId, societyId }, select: { qna: true } }),
      prisma.user.findUnique({ where: { id: context.userId }, select: { name: true, email: true } }),
    ]);
    if (!dr) return { success: false, error: "Dataroom introuvable" };

    const cleanAnswer = answer.trim();
    if (cleanAnswer.length < 2) return { success: false, error: "Réponse trop courte" };

    const qna = readQna(dr.qna);
    const next = qna.map((item) => item.id === questionId
      ? {
        ...item,
        status: "REPONDUE" as const,
        answer: cleanAnswer,
        answeredBy: user?.name ?? user?.email ?? "Utilisateur",
        answeredAt: new Date().toISOString(),
      }
      : item);

    await prisma.dataroom.update({
      where: { id: dataroomId },
      data: { qna: next as Prisma.InputJsonValue },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "DataroomQuestion",
      entityId: questionId,
      details: { action: "answer" },
    });

    revalidatePath(`/dataroom/${dataroomId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[answerDataroomQuestion]", error);
    return { success: false, error: "Erreur lors de la réponse" };
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
      accessMode: true,
      allowDownload: true,
      watermarkEnabled: true,
      ndaRequired: true,
      qnaEnabled: true,
      branding: true,
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
    accessMode: dataroom.accessMode,
    allowDownload: dataroom.allowDownload,
    watermarkEnabled: dataroom.watermarkEnabled,
    ndaRequired: dataroom.ndaRequired,
    qnaEnabled: dataroom.qnaEnabled,
    branding: dataroom.branding,
  };
}
