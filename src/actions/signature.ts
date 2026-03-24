"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createEnvelope,
  getEmbeddedSigningUrl,
  voidEnvelope,
  getEnvelopeStatus,
} from "@/lib/docusign";
import { createSignatureRequestSchema } from "@/validations/signature";
import type { ActionResult } from "@/actions/society";
import { revalidatePath } from "next/cache";
import { ForbiddenError } from "@/lib/permissions";
import { randomUUID } from "crypto";

// ── Creer une demande de signature ────────────────────────────────

export async function createSignatureRequest(
  societyId: string,
  input: unknown
): Promise<ActionResult<{ id: string; signingUrl?: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createSignatureRequestSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const {
      documentType, documentId, documentName, documentBase64,
      signerEmail, signerName, subject, message, embedded, returnUrl,
    } = parsed.data;

    // clientUserId unique pour la signature embarquee
    const clientUserId = embedded ? randomUUID() : undefined;

    // Creer l'enveloppe DocuSign
    const envelopeId = await createEnvelope({
      subject: subject ?? `Signature requise : ${documentName}`,
      message,
      documents: [{ contentBase64: documentBase64, name: documentName }],
      signers: [{ email: signerEmail, name: signerName, clientUserId }],
    });

    // Persister en base
    const record = await prisma.signatureRequest.create({
      data: {
        societyId,
        envelopeId,
        status: "SENT",
        documentType,
        documentId,
        documentName,
        signerEmail,
        signerName,
        signerClientId: clientUserId,
        subject,
        message,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "SignatureRequest",
      entityId: record.id,
      details: { envelopeId, documentType, signerEmail },
    });

    revalidatePath("/baux");
    revalidatePath("/documents");

    // Generer l'URL de signature embarquee si demande
    if (embedded && clientUserId && returnUrl) {
      const signingUrl = await getEmbeddedSigningUrl(
        envelopeId,
        { email: signerEmail, name: signerName, clientUserId },
        returnUrl
      );
      return { success: true, data: { id: record.id, signingUrl } };
    }

    return { success: true, data: { id: record.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createSignatureRequest]", error);
    return { success: false, error: "Erreur lors de la creation de la demande de signature" };
  }
}


// ── Creer une demande depuis une URL de document ──────────────────

export async function createSignatureRequestFromUrl(
  societyId: string,
  input: {
    documentUrl: string;
    documentName: string;
    documentType: "BAIL" | "ETAT_DES_LIEUX" | "MANDAT" | "AUTRE";
    documentId?: string;
    signerEmail: string;
    signerName: string;
    subject?: string;
    message?: string;
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const response = await fetch(input.documentUrl);
    if (!response.ok)
      return { success: false, error: "Impossible de recuperer le document" };

    const buffer = await response.arrayBuffer();
    const documentBase64 = Buffer.from(buffer).toString("base64");

    const envelopeId = await createEnvelope({
      subject: input.subject ?? `Signature requise : ${input.documentName}`,
      message: input.message,
      documents: [{ contentBase64: documentBase64, name: input.documentName }],
      signers: [{ email: input.signerEmail, name: input.signerName }],
    });

    const record = await prisma.signatureRequest.create({
      data: {
        societyId,
        envelopeId,
        status: "SENT",
        documentType: input.documentType,
        documentId: input.documentId,
        documentName: input.documentName,
        signerEmail: input.signerEmail,
        signerName: input.signerName,
        subject: input.subject,
        message: input.message,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "SignatureRequest",
      entityId: record.id,
      details: { envelopeId, documentType: input.documentType, signerEmail: input.signerEmail },
    });

    revalidatePath("/baux");
    revalidatePath("/documents");

    return { success: true, data: { id: record.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createSignatureRequestFromUrl]", error);
    return { success: false, error: "Erreur lors de la creation de la demande de signature" };
  }
}

// ── Lister les demandes d'une societe ────────────────────────────

export async function getSignatureRequests(
  societyId: string,
  filters?: { documentType?: string; status?: string }
) {
  const session = await auth();
  if (!session?.user?.id) return null;
  await requireSocietyAccess(session.user.id, societyId);

  return prisma.signatureRequest.findMany({
    where: {
      societyId,
      ...(filters?.documentType ? { documentType: filters.documentType as import("@prisma/client").SignatureDocumentType } : {}),
      ...(filters?.status ? { status: filters.status as import("@prisma/client").SignatureStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── Obtenir l'URL de signature embarquee pour une demande existante ─

export async function getEmbeddedSigningUrlForRequest(
  societyId: string,
  signatureRequestId: string,
  returnUrl: string
): Promise<ActionResult<{ signingUrl: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };
    await requireSocietyAccess(session.user.id, societyId);

    const record = await prisma.signatureRequest.findFirst({
      where: { id: signatureRequestId, societyId },
    });

    if (!record) return { success: false, error: "Demande introuvable" };
    if (!record.signerClientId)
      return { success: false, error: "Signature embarquee non disponible pour cette demande" };
    if (record.status === "COMPLETED")
      return { success: false, error: "Ce document a deja ete signe" };

    const signingUrl = await getEmbeddedSigningUrl(
      record.envelopeId,
      { email: record.signerEmail, name: record.signerName, clientUserId: record.signerClientId },
      returnUrl
    );

    return { success: true, data: { signingUrl } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getEmbeddedSigningUrl]", error);
    return { success: false, error: "Impossible d'obtenir l'URL de signature" };
  }
}

// ── Annuler une demande de signature ─────────────────────────────

export async function cancelSignatureRequest(
  societyId: string,
  signatureRequestId: string,
  reason: string = "Annulee par le gestionnaire"
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const record = await prisma.signatureRequest.findFirst({
      where: { id: signatureRequestId, societyId },
    });

    if (!record) return { success: false, error: "Demande introuvable" };
    if (["COMPLETED", "DECLINED", "VOIDED"].includes(record.status))
      return { success: false, error: "Cette demande ne peut plus etre annulee" };

    await voidEnvelope(record.envelopeId, reason);

    await prisma.signatureRequest.update({
      where: { id: record.id },
      data: { status: "VOIDED", voidedAt: new Date(), voidReason: reason },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "SignatureRequest",
      entityId: record.id,
      details: { action: "voided", reason },
    });

    revalidatePath("/baux");
    revalidatePath("/documents");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[cancelSignatureRequest]", error);
    return { success: false, error: "Erreur lors de l'annulation" };
  }
}

// ── Synchroniser le statut depuis DocuSign ────────────────────────

export async function syncSignatureStatus(
  societyId: string,
  signatureRequestId: string
): Promise<ActionResult<{ status: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };
    await requireSocietyAccess(session.user.id, societyId);

    const record = await prisma.signatureRequest.findFirst({
      where: { id: signatureRequestId, societyId },
    });
    if (!record) return { success: false, error: "Demande introuvable" };

    const envelope = await getEnvelopeStatus(record.envelopeId);
    const statusMap: Record<string, import("@prisma/client").SignatureStatus> = {
      sent: "SENT", delivered: "DELIVERED", completed: "COMPLETED",
      declined: "DECLINED", voided: "VOIDED",
    };
    const newStatus = statusMap[envelope.status.toLowerCase()] ?? record.status;

    await prisma.signatureRequest.update({
      where: { id: record.id },
      data: {
        status: newStatus,
        ...(newStatus === "COMPLETED" && envelope.completedDateTime
          ? { signedAt: new Date(envelope.completedDateTime) }
          : {}),
      },
    });

    return { success: true, data: { status: newStatus } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[syncSignatureStatus]", error);
    return { success: false, error: "Erreur lors de la synchronisation" };
  }
}
