"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import type { ActionResult } from "./society";
import { generateLetterSchema } from "@/validations/letter-template";
import { BUILTIN_TEMPLATES, interpolateTemplate } from "@/lib/letter-templates";
import { generateLetterPdf } from "@/lib/letter-pdf";
import { sendLetterEmail } from "@/lib/email";

/**
 * Génère un courrier PDF et l'envoie par email au locataire.
 */
export async function sendLetterByEmail(
  societyId: string,
  input: { templateId: string; values: Record<string, string>; tenantId: string }
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = generateLetterSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    // Trouver le modèle
    const builtin = BUILTIN_TEMPLATES.find((t) => t.id === parsed.data.templateId);
    let subject: string;
    let bodyHtml: string;

    if (builtin) {
      subject = builtin.subject;
      bodyHtml = builtin.bodyHtml;
    } else {
      const custom = await prisma.letterTemplate.findFirst({
        where: { id: parsed.data.templateId, societyId },
      });
      if (!custom) return { success: false, error: "Modèle introuvable" };
      subject = custom.subject;
      bodyHtml = custom.bodyHtml;
    }

    // Récupérer l'email du locataire
    const tenant = await prisma.tenant.findFirst({
      where: { id: input.tenantId, societyId },
      select: { email: true, firstName: true, lastName: true },
    });
    if (!tenant?.email) return { success: false, error: "Le locataire n'a pas d'adresse email" };

    // Récupérer les infos société
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { name: true, siret: true },
    });

    // Interpoler et générer le PDF
    const interpolated = interpolateTemplate(bodyHtml, parsed.data.values);
    const buffer = await generateLetterPdf({
      senderName: parsed.data.values.BAILLEUR_NOM ?? society?.name ?? "",
      senderAddress: parsed.data.values.BAILLEUR_ADRESSE ?? "",
      recipientName: parsed.data.values.LOCATAIRE_NOM ?? "",
      recipientAddress: parsed.data.values.LOCATAIRE_ADRESSE ?? "",
      date: parsed.data.values.DATE ?? new Date().toLocaleDateString("fr-FR"),
      lieu: parsed.data.values.LIEU ?? "",
      subject,
      bodyHtml: interpolated,
      societyName: society?.name,
      societySiret: society?.siret ?? undefined,
    });

    const ds = new Date().toISOString().slice(0, 10);
    const slug = parsed.data.templateId.replace(/_/g, "-");
    const filename = `courrier-${slug}-${ds}.pdf`;

    // Envoyer l'email avec le template HTML professionnel
    const tenantName = `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();
    await sendLetterEmail({
      to: tenant.email,
      tenantName,
      subject,
      societyName: society?.name ?? "",
      attachment: { filename, content: buffer },
    });

    // Audit log
    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Letter",
      entityId: parsed.data.templateId,
      details: { action: "email_sent", tenantEmail: tenant.email, subject },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors de l'envoi du courrier" };
  }
}
