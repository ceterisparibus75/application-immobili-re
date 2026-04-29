"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./society";
import { generateLetterSchema, saveCustomTemplateSchema } from "@/validations/letter-template";
import { BUILTIN_TEMPLATES, interpolateTemplate } from "@/lib/letter-templates";
import { generateLetterPdf } from "@/lib/letter-pdf";
import { getTenantDisplayName, getTenantMailingAddress } from "@/lib/tenant-format";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

// ── Locataires avec bail actif pour sélection courrier ──────────

interface TenantForLetter {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  leaseId?: string;
}

export async function getTenantsWithLease(
  societyId: string
): Promise<ActionResult<TenantForLetter[]>> {
  try {
    await requireSocietyActionContext(societyId, "LECTURE");

    const tenants = await prisma.tenant.findMany({
      where: { societyId, isActive: true, deletedAt: null },
      select: {
        id: true,
        entityType: true,
        companyName: true,
        firstName: true,
        lastName: true,
        leases: {
          where: { status: "EN_COURS", deletedAt: null },
          select: { id: true },
          take: 1,
          orderBy: { startDate: "desc" },
        },
      },
      orderBy: [{ companyName: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    });

    return {
      success: true,
      data: tenants.map((t) => ({
        id: t.id,
        name: getTenantDisplayName(t),
        firstName: t.firstName ?? "",
        lastName: t.lastName ?? "",
        leaseId: t.leases[0]?.id,
      })),
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors du chargement des locataires" };
  }
}

// ── Immeubles avec locataires actifs (pour envoi groupé) ──────────

export interface BuildingForLetter {
  id: string;
  name: string;
  city: string;
  tenants: { id: string; name: string; leaseId: string }[];
}

export async function getBuildingsWithTenants(
  societyId: string
): Promise<ActionResult<BuildingForLetter[]>> {
  try {
    await requireSocietyActionContext(societyId, "LECTURE");

    const buildings = await prisma.building.findMany({
      where: { societyId },
      select: {
        id: true, name: true, city: true,
        lots: {
          select: {
            leases: {
              where: { status: "EN_COURS", deletedAt: null },
              select: {
                id: true,
                tenant: { select: { id: true, firstName: true, lastName: true, companyName: true, entityType: true } },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: buildings
        .map((b) => ({
          id: b.id,
          name: b.name,
          city: b.city,
          tenants: b.lots
            .filter((l) => l.leases.length > 0)
            .map((l) => {
              const lease = l.leases[0];
              const t = lease.tenant;
              const name = getTenantDisplayName(t);
              return { id: t.id, name, leaseId: lease.id };
            }),
        }))
        .filter((b) => b.tenants.length > 0),
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors du chargement des immeubles" };
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
    await requireSocietyActionContext(societyId, "LECTURE");

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
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors du chargement des modèles" };
  }
}

// ── Auto-remplissage des variables depuis les données ───────────

const DESTINATION_LABELS: Record<string, string> = {
  HABITATION: "logement",
  BUREAU: "bureau",
  COMMERCE: "local commercial",
  ACTIVITE: "local d'activité",
  ENTREPOT: "entrepôt",
  INDUSTRIEL: "local industriel",
  PROFESSIONNEL: "local professionnel",
  MIXTE: "locaux mixtes",
  PARKING: "parking/garage",
  TERRAIN: "terrain",
  AGRICOLE: "exploitation agricole",
  HOTELLERIE: "local hôtelier",
  EQUIPEMENT: "local d'équipement",
  AUTRE: "bien immobilier",
};

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
  destinationBien?: string;
}

export async function getAutoFillData(
  societyId: string,
  tenantId?: string,
  leaseId?: string
): Promise<ActionResult<AutoFillData>> {
  try {
    await requireSocietyActionContext(societyId, "LECTURE");

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
        select: {
          startDate: true, endDate: true, currentRentHT: true, destination: true,
          tenant: {
            select: {
              entityType: true,
              companyName: true,
              companyAddress: true,
              firstName: true,
              lastName: true,
              email: true,
              personalAddress: true,
            },
          },
          lot: { select: { building: { select: { addressLine1: true, city: true, postalCode: true } } } },
          chargeProvisions: { where: { isActive: true }, select: { monthlyAmount: true } },
        },
      });

      if (lease) {
        data.tenantName = getTenantDisplayName(lease.tenant, "");
        data.tenantAddress = getTenantMailingAddress(lease.tenant);
        data.lotAddress = [lease.lot.building.addressLine1, [lease.lot.building.postalCode, lease.lot.building.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
        data.leaseStart = formatDate(lease.startDate);
        data.leaseEnd = lease.endDate ? formatDate(lease.endDate) : "";
        data.rentAmount = formatCurrency(lease.currentRentHT);
        const totalCharges = lease.chargeProvisions.reduce((sum, cp) => sum + cp.monthlyAmount, 0);
        data.chargesAmount = formatCurrency(totalCharges);
        if (lease.destination) data.destinationBien = DESTINATION_LABELS[lease.destination] ?? "logement";
      }
    } else if (tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, societyId, deletedAt: null },
        select: {
          entityType: true,
          companyName: true,
          companyAddress: true,
          firstName: true,
          lastName: true,
          personalAddress: true,
        },
      });
      if (tenant) {
        data.tenantName = getTenantDisplayName(tenant, "");
        data.tenantAddress = getTenantMailingAddress(tenant);
      }

      // Chercher le bail actif du locataire
      const activeLease = await prisma.lease.findFirst({
        where: { tenantId, societyId, status: "EN_COURS", deletedAt: null },
        select: {
          startDate: true, endDate: true, currentRentHT: true, destination: true,
          lot: { select: { building: { select: { addressLine1: true, city: true, postalCode: true } } } },
          chargeProvisions: { where: { isActive: true }, select: { monthlyAmount: true } },
        },
        orderBy: { startDate: "desc" },
      });
      if (activeLease) {
        data.lotAddress = [activeLease.lot.building.addressLine1, [activeLease.lot.building.postalCode, activeLease.lot.building.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
        data.leaseStart = formatDate(activeLease.startDate);
        data.leaseEnd = activeLease.endDate ? formatDate(activeLease.endDate) : "";
        data.rentAmount = formatCurrency(activeLease.currentRentHT);
        const totalCharges = activeLease.chargeProvisions.reduce((sum, cp) => sum + cp.monthlyAmount, 0);
        data.chargesAmount = formatCurrency(totalCharges);
        if (activeLease.destination) data.destinationBien = DESTINATION_LABELS[activeLease.destination] ?? "logement";
      }
    }

    return { success: true, data };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

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
      userId: context.userId,
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
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

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
      userId: context.userId,
      action: "CREATE",
      entity: "LetterTemplate",
      entityId: template.id,
    });

    revalidatePath("/courriers");
    return { success: true, data: { id: template.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    await prisma.letterTemplate.delete({
      where: { id: templateId, societyId },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "LetterTemplate",
      entityId: templateId,
    });

    revalidatePath("/courriers");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
