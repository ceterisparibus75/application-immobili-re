"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./society";
import { generateLetterSchema, saveCustomTemplateSchema } from "@/validations/letter-template";
import { BUILTIN_TEMPLATES, interpolateTemplate } from "@/lib/letter-templates";
import { generateLetterPdf } from "@/lib/letter-pdf";
import { formatCurrency, formatDate } from "@/lib/utils";

// ── Locataires avec bail actif pour sélection courrier ──────────

interface TenantForLetter {
  id: string;
  firstName: string;
  lastName: string;
  leaseId?: string;
}

export async function getTenantsWithLease(
  societyId: string
): Promise<ActionResult<TenantForLetter[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "LECTURE");

    const tenants = await prisma.tenant.findMany({
      where: { societyId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        leases: {
          where: { status: "ACTIVE" },
          select: { id: true },
          take: 1,
          orderBy: { startDate: "desc" },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return {
      success: true,
      data: tenants.map((t) => ({
        id: t.id,
        firstName: t.firstName ?? "",
        lastName: t.lastName ?? "",
        leaseId: t.leases[0]?.id,
      })),
    };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors du chargement des locataires" };
  }
}

// ── Récupérer la liste des modèles (builtins + customs) ────────

interface TemplateListItem {
  id: string;
  name: string;
  description: string;
  category: string;
  isCustom: boolean;
}

export async function getLetterTemplates(
  societyId: string
): Promise<ActionResult<{ templates: TemplateListItem[] }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "LECTURE");

    // Modèles prédéfinis
    const builtins: TemplateListItem[] = BUILTIN_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      isCustom: false,
    }));

    // Modèles personnalisés de la société
    const customs = await prisma.letterTemplate.findMany({
      where: { societyId },
      orderBy: { name: "asc" },
    });

    const customItems: TemplateListItem[] = customs.map((c) => ({
      id: c.id,
      name: c.name,
      description: "Modèle personnalisé",
      category: "administratif",
      isCustom: true,
    }));

    return { success: true, data: { templates: [...builtins, ...customItems] } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors du chargement des modèles" };
  }
}

// ── Auto-remplissage des variables depuis les données ───────────

interface AutoFillData {
  societyName: string;
  societyAddress: string;
  societySiret: string;
  tenantName?: string;
  tenantAddress?: string;
  lotAddress?: string;
  leaseStart?: string;
  leaseEnd?: string;
  rentAmount?: string;
  chargesAmount?: string;
}

export async function getAutoFillData(
  societyId: string,
  tenantId?: string,
  leaseId?: string
): Promise<ActionResult<AutoFillData>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "LECTURE");

    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { name: true, addressLine1: true, addressLine2: true, city: true, postalCode: true, siret: true },
    });

    if (!society) return { success: false, error: "Société introuvable" };

    const data: AutoFillData = {
      societyName: society.name,
      societyAddress: [society.addressLine1, society.addressLine2, [society.postalCode, society.city].filter(Boolean).join(" ")].filter(Boolean).join("\n"),
      societySiret: society.siret ?? "",
    };

    // Si un bail est spécifié, récupérer les infos du locataire et du lot
    if (leaseId) {
      const lease = await prisma.lease.findFirst({
        where: { id: leaseId, societyId },
        include: {
          tenant: { select: { firstName: true, lastName: true, email: true, address: true, city: true, postalCode: true } },
          lot: { include: { building: { select: { addressLine1: true, city: true, postalCode: true } } } },
        },
      });

      if (lease) {
        data.tenantName = [lease.tenant.firstName, lease.tenant.lastName].filter(Boolean).join(" ");
        data.tenantAddress = [lease.tenant.address, [lease.tenant.postalCode, lease.tenant.city].filter(Boolean).join(" ")].filter(Boolean).join("\n");
        data.lotAddress = [lease.lot.building.addressLine1, [lease.lot.building.postalCode, lease.lot.building.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
        data.leaseStart = formatDate(lease.startDate);
        data.leaseEnd = lease.endDate ? formatDate(lease.endDate) : "";
        data.rentAmount = formatCurrency(lease.rentAmount);
        data.chargesAmount = formatCurrency(lease.chargesAmount ?? 0);
      }
    } else if (tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, societyId },
        select: { firstName: true, lastName: true, address: true, city: true, postalCode: true },
      });
      if (tenant) {
        data.tenantName = [tenant.firstName, tenant.lastName].filter(Boolean).join(" ");
        data.tenantAddress = [tenant.address, [tenant.postalCode, tenant.city].filter(Boolean).join(" ")].filter(Boolean).join("\n");
      }

      // Chercher le bail actif du locataire
      const activeLease = await prisma.lease.findFirst({
        where: { tenantId, societyId, status: "ACTIVE" },
        include: { lot: { include: { building: { select: { addressLine1: true, city: true, postalCode: true } } } } },
        orderBy: { startDate: "desc" },
      });
      if (activeLease) {
        data.lotAddress = [activeLease.lot.building.addressLine1, [activeLease.lot.building.postalCode, activeLease.lot.building.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
        data.leaseStart = formatDate(activeLease.startDate);
        data.leaseEnd = activeLease.endDate ? formatDate(activeLease.endDate) : "";
        data.rentAmount = formatCurrency(activeLease.rentAmount);
        data.chargesAmount = formatCurrency(activeLease.chargesAmount ?? 0);
      }
    }

    return { success: true, data };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors du chargement des données" };
  }
}

// ── Génération du PDF ───────────────────────────────────────────

export async function generateLetter(
  societyId: string,
  input: { templateId: string; values: Record<string, string>; tenantId?: string; leaseId?: string }
): Promise<ActionResult<{ buffer: string; filename: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = generateLetterSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    // Trouver le modèle (builtin ou custom)
    let subject: string;
    let bodyHtml: string;
    const templateId = parsed.data.templateId;

    const builtin = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
    if (builtin) {
      subject = builtin.subject;
      bodyHtml = builtin.bodyHtml;
    } else {
      // Modèle personnalisé
      const custom = await prisma.letterTemplate.findFirst({
        where: { id: templateId, societyId },
      });
      if (!custom) return { success: false, error: "Modèle introuvable" };
      subject = custom.subject;
      bodyHtml = custom.bodyHtml;
    }

    // Interpoler les variables
    const interpolated = interpolateTemplate(bodyHtml, parsed.data.values);

    // Récupérer les infos société pour le PDF
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { name: true, siret: true },
    });

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

    // Audit log
    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Letter",
      entityId: templateId,
      details: { templateId, subject },
    });

    const ds = new Date().toISOString().slice(0, 10);
    const slug = templateId.replace(/_/g, "-");
    const filename = `courrier-${slug}-${ds}.pdf`;

    return {
      success: true,
      data: {
        buffer: buffer.toString("base64"),
        filename,
      },
    };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors de la génération du courrier" };
  }
}

// ── Sauvegarde d'un modèle personnalisé ─────────────────────────

export async function saveCustomTemplate(
  societyId: string,
  input: { name: string; subject: string; bodyHtml: string; variables: string[] }
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = saveCustomTemplateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const template = await prisma.letterTemplate.create({
      data: {
        societyId,
        name: parsed.data.name,
        subject: parsed.data.subject,
        bodyHtml: parsed.data.bodyHtml,
        variables: parsed.data.variables,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "LetterTemplate",
      entityId: template.id,
    });

    revalidatePath("/courriers");
    return { success: true, data: { id: template.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors de la sauvegarde du modèle" };
  }
}

// ── Suppression d'un modèle personnalisé ────────────────────────

export async function deleteCustomTemplate(
  societyId: string,
  templateId: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    await prisma.letterTemplate.delete({
      where: { id: templateId, societyId },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "LetterTemplate",
      entityId: templateId,
    });

    revalidatePath("/courriers");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
