"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

/**
 * Fusionne un immeuble source dans un immeuble cible.
 * Transfère toutes les relations (lots, diagnostics, maintenances, charges, documents, emprunts)
 * puis supprime l'immeuble source.
 */
export async function mergeBuildings(
  societyId: string,
  sourceId: string,
  targetId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    if (sourceId === targetId) return { success: false, error: "Impossible de fusionner un immeuble avec lui-même" };

    const [source, target] = await Promise.all([
      prisma.building.findFirst({ where: { id: sourceId, societyId } }),
      prisma.building.findFirst({ where: { id: targetId, societyId } }),
    ]);

    if (!source) return { success: false, error: "Immeuble source introuvable" };
    if (!target) return { success: false, error: "Immeuble cible introuvable" };

    await prisma.$transaction([
      // Transférer les lots
      prisma.lot.updateMany({ where: { buildingId: sourceId }, data: { buildingId: targetId } }),
      // Transférer les diagnostics
      prisma.diagnostic.updateMany({ where: { buildingId: sourceId }, data: { buildingId: targetId } }),
      // Transférer les maintenances
      prisma.maintenance.updateMany({ where: { buildingId: sourceId }, data: { buildingId: targetId } }),
      // Transférer les catégories de charges
      prisma.chargeCategory.updateMany({ where: { buildingId: sourceId }, data: { buildingId: targetId } }),
      // Transférer les charges
      prisma.charge.updateMany({ where: { buildingId: sourceId }, data: { buildingId: targetId } }),
      // Transférer les documents
      prisma.document.updateMany({ where: { buildingId: sourceId }, data: { buildingId: targetId } }),
      // Transférer les emprunts
      prisma.loan.updateMany({ where: { buildingId: sourceId }, data: { buildingId: targetId } }),
      // Supprimer l'immeuble source (maintenant vide)
      prisma.building.delete({ where: { id: sourceId } }),
    ]);

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Building",
      entityId: targetId,
      details: {
        action: "merge",
        mergedFrom: { id: sourceId, name: source.name },
        mergedInto: { id: targetId, name: target.name },
      },
    });

    revalidatePath("/patrimoine/immeubles");
    revalidatePath(`/patrimoine/immeubles/${targetId}`);

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[mergeBuildings]", error);
    return { success: false, error: "Erreur lors de la fusion des immeubles" };
  }
}

/**
 * Fusionne un lot source dans un lot cible.
 * Transfère toutes les relations (baux, provisions charges, annonces, documents, compteurs)
 * puis supprime le lot source.
 */
export async function mergeLots(
  societyId: string,
  sourceId: string,
  targetId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    if (sourceId === targetId) return { success: false, error: "Impossible de fusionner un lot avec lui-même" };

    const [source, target] = await Promise.all([
      prisma.lot.findFirst({ where: { id: sourceId, building: { societyId } }, include: { building: true } }),
      prisma.lot.findFirst({ where: { id: targetId, building: { societyId } }, include: { building: true } }),
    ]);

    if (!source) return { success: false, error: "Lot source introuvable" };
    if (!target) return { success: false, error: "Lot cible introuvable" };

    await prisma.$transaction([
      // Transférer les baux (lot principal)
      prisma.lease.updateMany({ where: { lotId: sourceId }, data: { lotId: targetId } }),
      // Transférer les entrées LeaseLot
      prisma.leaseLot.updateMany({ where: { lotId: sourceId }, data: { lotId: targetId } }),
      // Transférer les provisions de charges
      prisma.chargeProvision.updateMany({ where: { lotId: sourceId }, data: { lotId: targetId } }),
      // Transférer les clés de répartition
      prisma.allocationKeyEntry.updateMany({ where: { lotId: sourceId }, data: { lotId: targetId } }),
      // Transférer les compteurs
      prisma.meterReading.updateMany({ where: { lotId: sourceId }, data: { lotId: targetId } }),
      // Transférer les annonces
      prisma.announcement.updateMany({ where: { lotId: sourceId }, data: { lotId: targetId } }),
      // Transférer les documents
      prisma.document.updateMany({ where: { lotId: sourceId }, data: { lotId: targetId } }),
      // Supprimer le lot source
      prisma.lot.delete({ where: { id: sourceId } }),
    ]);

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Lot",
      entityId: targetId,
      details: {
        action: "merge",
        mergedFrom: { id: sourceId, number: source.number },
        mergedInto: { id: targetId, number: target.number },
      },
    });

    revalidatePath("/patrimoine/lots");
    revalidatePath(`/patrimoine/immeubles/${target.buildingId}`);

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[mergeLots]", error);
    return { success: false, error: "Erreur lors de la fusion des lots" };
  }
}

/**
 * Fusionne un locataire source dans un locataire cible.
 * Transfère toutes les relations (baux, factures, garanties, contacts, documents, portail)
 * puis supprime le locataire source.
 */
export async function mergeTenants(
  societyId: string,
  sourceId: string,
  targetId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    if (sourceId === targetId) return { success: false, error: "Impossible de fusionner un locataire avec lui-même" };

    const [source, target] = await Promise.all([
      prisma.tenant.findFirst({ where: { id: sourceId, societyId } }),
      prisma.tenant.findFirst({ where: { id: targetId, societyId } }),
    ]);

    if (!source) return { success: false, error: "Locataire source introuvable" };
    if (!target) return { success: false, error: "Locataire cible introuvable" };

    // Supprimer le portail du source (conflit @unique sur tenantId)
    await prisma.tenantPortalAccess.deleteMany({ where: { tenantId: sourceId } });

    await prisma.$transaction([
      // Transférer les baux
      prisma.lease.updateMany({ where: { tenantId: sourceId }, data: { tenantId: targetId } }),
      // Transférer les factures
      prisma.invoice.updateMany({ where: { tenantId: sourceId }, data: { tenantId: targetId } }),
      // Transférer les garanties
      prisma.guarantee.updateMany({ where: { tenantId: sourceId }, data: { tenantId: targetId } }),
      // Transférer les contacts secondaires
      prisma.tenantContact.updateMany({ where: { tenantId: sourceId }, data: { tenantId: targetId } }),
      // Transférer les documents checklist
      prisma.tenantDocument.updateMany({ where: { tenantId: sourceId }, data: { tenantId: targetId } }),
      // Transférer les documents généraux
      prisma.document.updateMany({ where: { tenantId: sourceId }, data: { tenantId: targetId } }),
      // Transférer les relances
      prisma.reminder.updateMany({ where: { tenantId: sourceId }, data: { tenantId: targetId } }),
      // Supprimer le locataire source
      prisma.tenant.delete({ where: { id: sourceId } }),
    ]);

    const sourceName = source.entityType === "PERSONNE_MORALE"
      ? (source.companyName ?? "")
      : `${source.firstName ?? ""} ${source.lastName ?? ""}`.trim();
    const targetName = target.entityType === "PERSONNE_MORALE"
      ? (target.companyName ?? "")
      : `${target.firstName ?? ""} ${target.lastName ?? ""}`.trim();

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Tenant",
      entityId: targetId,
      details: {
        action: "merge",
        mergedFrom: { id: sourceId, name: sourceName },
        mergedInto: { id: targetId, name: targetName },
      },
    });

    revalidatePath("/locataires");
    revalidatePath(`/locataires/${targetId}`);

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[mergeTenants]", error);
    return { success: false, error: "Erreur lors de la fusion des locataires" };
  }
}

/**
 * Recherche des entités similaires pour la fusion.
 */
export async function searchDuplicates(
  societyId: string,
  entityType: "building" | "lot" | "tenant",
  query: string
) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  if (!query || query.length < 2) return [];

  switch (entityType) {
    case "building":
      return prisma.building.findMany({
        where: {
          societyId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { addressLine1: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, addressLine1: true, city: true },
        take: 10,
      });

    case "lot":
      return prisma.lot.findMany({
        where: {
          building: { societyId },
          OR: [
            { number: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          number: true,
          lotType: true,
          building: { select: { name: true } },
        },
        take: 10,
      });

    case "tenant":
      return prisma.tenant.findMany({
        where: {
          societyId,
          OR: [
            { companyName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { firstName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { siret: { contains: query } },
          ],
        },
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
        },
        take: 10,
      });

    default:
      return [];
  }
}
