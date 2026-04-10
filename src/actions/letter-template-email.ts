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
import { getAutoFillData } from "./letter-template";
import { createClient } from "@supabase/supabase-js";

// ── Upload PDF courrier dans Supabase + création Document ───────

async function saveLetterDocument(
  societyId: string,
  tenantId: string,
  filename: string,
  buffer: Buffer,
  subject: string,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return; // Supabase non configuré, on skip

  const supabase = createClient(supabaseUrl, supabaseKey);
  const bucket = "documents";
  const storagePath = `documents/${societyId}/courriers/${Date.now()}_${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    console.error("[saveLetterDocument] Upload error:", uploadError.message);
    return;
  }

  const { data: signedData } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 365 * 24 * 3600);

  await prisma.document.create({
    data: {
      societyId,
      tenantId,
      fileName: filename,
      fileUrl: signedData?.signedUrl ?? storagePath,
      storagePath,
      fileSize: buffer.length,
      mimeType: "application/pdf",
      category: "courrier",
      description: `Courrier : ${subject}`,
    },
  });
}

/**
 * Génère un courrier PDF et l'envoie par email au locataire.
 * Sauvegarde aussi le PDF dans l'espace documents du locataire (portail).
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

    // Sauvegarder le PDF dans l'espace documents du locataire (portail)
    await saveLetterDocument(societyId, input.tenantId, filename, buffer, subject);

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

// ── Envoi groupé par immeuble ──────────────────────────────────

export async function sendLetterToBuilding(
  societyId: string,
  input: {
    templateId: string;
    buildingId: string;
    commonValues: Record<string, string>;
  }
): Promise<ActionResult<{ sent: number; errors: string[] }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    // Trouver le modèle
    const builtin = BUILTIN_TEMPLATES.find((t) => t.id === input.templateId);
    let subject: string;
    let bodyHtml: string;
    let templateVariables: { key: string; autoFill?: string }[] = [];

    if (builtin) {
      subject = builtin.subject;
      bodyHtml = builtin.bodyHtml;
      templateVariables = builtin.variables;
    } else {
      const custom = await prisma.letterTemplate.findFirst({
        where: { id: input.templateId, societyId },
      });
      if (!custom) return { success: false, error: "Modèle introuvable" };
      subject = custom.subject;
      bodyHtml = custom.bodyHtml;
    }

    // Récupérer les locataires actifs de l'immeuble
    const building = await prisma.building.findFirst({
      where: { id: input.buildingId, societyId },
      select: {
        name: true,
        lots: {
          select: {
            leases: {
              where: { status: "EN_COURS" },
              select: {
                id: true,
                tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!building) return { success: false, error: "Immeuble introuvable" };

    const tenantLeases = building.lots
      .filter((l) => l.leases.length > 0 && l.leases[0].tenant.email)
      .map((l) => ({ tenant: l.leases[0].tenant, leaseId: l.leases[0].id }));

    if (tenantLeases.length === 0) {
      return { success: false, error: "Aucun locataire avec email dans cet immeuble" };
    }

    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { name: true, siret: true },
    });

    let sent = 0;
    const errors: string[] = [];

    for (const { tenant, leaseId } of tenantLeases) {
      try {
        // Auto-remplir les variables spécifiques au locataire
        const autoFillResult = await getAutoFillData(societyId, tenant.id, leaseId);
        const autoFillData = autoFillResult.success ? autoFillResult.data : null;

        const values: Record<string, string> = { ...input.commonValues };
        if (autoFillData) {
          for (const v of templateVariables) {
            if (values[v.key] && !["tenant_name", "tenant_address", "lot_address", "lease_start", "lease_end", "rent_amount", "charges_amount"].includes(v.autoFill ?? "")) {
              continue; // Garder les valeurs communes déjà saisies (bailleur, date, lieu…)
            }
            switch (v.autoFill) {
              case "society_name": values[v.key] = autoFillData.societyName; break;
              case "society_address": values[v.key] = autoFillData.societyAddress; break;
              case "society_siret": values[v.key] = autoFillData.societySiret; break;
              case "today": values[v.key] = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }); break;
              case "tenant_name": if (autoFillData.tenantName) values[v.key] = autoFillData.tenantName; break;
              case "tenant_address": if (autoFillData.tenantAddress) values[v.key] = autoFillData.tenantAddress; break;
              case "lot_address": if (autoFillData.lotAddress) values[v.key] = autoFillData.lotAddress; break;
              case "lease_start": if (autoFillData.leaseStart) values[v.key] = autoFillData.leaseStart; break;
              case "lease_end": if (autoFillData.leaseEnd) values[v.key] = autoFillData.leaseEnd; break;
              case "rent_amount": if (autoFillData.rentAmount) values[v.key] = autoFillData.rentAmount; break;
              case "charges_amount": if (autoFillData.chargesAmount) values[v.key] = autoFillData.chargesAmount; break;
            }
          }
        }

        // Générer le PDF personnalisé
        const interpolated = interpolateTemplate(bodyHtml, values);
        const buffer = await generateLetterPdf({
          senderName: values.BAILLEUR_NOM ?? society?.name ?? "",
          senderAddress: values.BAILLEUR_ADRESSE ?? "",
          recipientName: values.LOCATAIRE_NOM ?? "",
          recipientAddress: values.LOCATAIRE_ADRESSE ?? "",
          date: values.DATE ?? new Date().toLocaleDateString("fr-FR"),
          lieu: values.LIEU ?? "",
          subject,
          bodyHtml: interpolated,
          societyName: society?.name,
          societySiret: society?.siret ?? undefined,
        });

        const ds = new Date().toISOString().slice(0, 10);
        const slug = input.templateId.replace(/_/g, "-");
        const filename = `courrier-${slug}-${ds}.pdf`;

        const tenantName = `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();
        await sendLetterEmail({
          to: tenant.email!,
          tenantName,
          subject,
          societyName: society?.name ?? "",
          attachment: { filename, content: buffer },
        });

        // Sauvegarder dans l'espace documents du locataire
        await saveLetterDocument(societyId, tenant.id, filename, buffer, subject);

        sent++;
      } catch (e) {
        const tenantName = `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();
        errors.push(`${tenantName}: ${e instanceof Error ? e.message : "Erreur inconnue"}`);
      }
    }

    // Audit log
    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Letter",
      entityId: input.templateId,
      details: {
        action: "building_email_sent",
        buildingId: input.buildingId,
        buildingName: building.name,
        sent,
        errors: errors.length,
      },
    });

    return { success: true, data: { sent, errors } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors de l'envoi groupé" };
  }
}
