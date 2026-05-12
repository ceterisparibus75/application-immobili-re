"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import { requireAuthenticatedActionContext } from "@/lib/action-auth";
import { parseImportFile } from "@/lib/import-parser";
import {
  importTenantRowSchema,
  importBuildingRowSchema,
  importLotRowSchema,
  importContactRowSchema,
  type ImportEntityType,
} from "@/validations/import";
import { checkSubscriptionActive, checkLotLimit } from "@/lib/plan-limits";

export type ParsedFileResult = {
  headers: string[];
  rows: Record<string, string>[];
};

/**
 * Server action to parse an uploaded CSV/Excel file and return structured rows.
 */
export async function parseImportFileAction(
  formData: FormData
): Promise<ActionResult<ParsedFileResult>> {
  try {
    await requireAuthenticatedActionContext();

    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "Aucun fichier fourni" };

    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ];
    // Some browsers may not set MIME correctly for CSV, so also check extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowedTypes.includes(file.type) && !["csv", "xlsx", "xls"].includes(ext ?? "")) {
      return { success: false, error: "Format non supporte. Utilisez un fichier CSV ou Excel (.xlsx)." };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: "Fichier trop volumineux (max 10 Mo)" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseImportFile(buffer, file.name);

    if (parsed.rows.length === 0) {
      return { success: false, error: "Le fichier est vide ou ne contient aucune ligne de donnees." };
    }

    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifie" };
    console.error("[parseImportFileAction]", error);
    return { success: false, error: "Erreur lors de la lecture du fichier" };
  }
}

export type BulkImportResult = {
  imported: number;
  errors: { row: number; message: string }[];
};

function normalizeImportHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/²/g, "2")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const IMPORT_COLUMN_ALIASES: Record<ImportEntityType, Record<string, string>> = {
  tenants: {
    nom: "nom",
    lastname: "nom",
    name: "nom",
    prenom: "prenom",
    firstname: "prenom",
    email: "email",
    mail: "email",
    telephone: "telephone",
    tel: "telephone",
    phone: "telephone",
    mobile: "telephone",
    type: "entityType",
    typelocataire: "entityType",
    entitytype: "entityType",
    nature: "entityType",
    raisonsociale: "companyName",
    societe: "companyName",
    entreprise: "companyName",
    company: "companyName",
    companyname: "companyName",
    companylegalform: "companyLegalForm",
    formejuridique: "companyLegalForm",
    siret: "siret",
  },
  buildings: {
    name: "name",
    nom: "name",
    immeuble: "name",
    batiment: "name",
    address: "address",
    adresse: "address",
    adresseligne1: "address",
    rue: "address",
    postalcode: "postalCode",
    codepostal: "postalCode",
    cp: "postalCode",
    city: "city",
    ville: "city",
    commune: "city",
    type: "type",
    buildingtype: "type",
    typeimmeuble: "type",
  },
  lots: {
    reference: "reference",
    ref: "reference",
    numero: "reference",
    numerolot: "reference",
    lot: "reference",
    type: "type",
    typelot: "type",
    surface: "surface",
    surfacem2: "surface",
    m2: "surface",
    area: "surface",
    etage: "etage",
    floor: "etage",
    buildingid: "buildingId",
    immeubleid: "buildingId",
    idimmeuble: "buildingId",
    building: "buildingName",
    buildingname: "buildingName",
    immeuble: "buildingName",
    nomimmeuble: "buildingName",
    batiment: "buildingName",
    nombatiment: "buildingName",
  },
  contacts: {
    type: "contactType",
    typecontact: "contactType",
    contacttype: "contactType",
    nature: "contactType",
    nom: "name",
    name: "name",
    contact: "name",
    societe: "company",
    entreprise: "company",
    company: "company",
    specialite: "specialty",
    specialty: "specialty",
    metier: "specialty",
    email: "email",
    mail: "email",
    telephone: "phone",
    tel: "phone",
    phone: "phone",
    mobile: "mobile",
    adresse: "addressLine1",
    address: "addressLine1",
    ville: "city",
    city: "city",
    codepostal: "postalCode",
    postalcode: "postalCode",
    cp: "postalCode",
    notes: "notes",
    note: "notes",
  },
};

function normalizeBulkImportRow(
  entityType: ImportEntityType,
  row: Record<string, string>
): Record<string, string> {
  const aliases = IMPORT_COLUMN_ALIASES[entityType];
  const normalized: Record<string, string> = {};

  for (const [header, value] of Object.entries(row)) {
    const canonical = aliases[normalizeImportHeader(header)];
    if (canonical && normalized[canonical] === undefined) {
      normalized[canonical] = value;
    }
  }

  return { ...row, ...normalized };
}

/**
 * Bulk import entities from parsed CSV/Excel rows.
 * Each row is validated and inserted individually; failures are collected, not thrown.
 */
export async function importEntities(
  societyId: string,
  entityType: ImportEntityType,
  data: Record<string, string>[]
): Promise<ActionResult<BulkImportResult>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };

    if (!data.length) return { success: false, error: "Aucune donnee a importer" };

    let imported = 0;
    const errors: { row: number; message: string }[] = [];

    if (entityType === "tenants") {
      const seenTenantEmails = new Set<string>();

      for (let i = 0; i < data.length; i++) {
        const row = normalizeBulkImportRow(entityType, data[i]);
        const parsed = importTenantRowSchema.safeParse(row);
        if (!parsed.success) {
          errors.push({
            row: i + 2,
            message: parsed.error.errors.map((e) => e.message).join(", "),
          });
          continue;
        }

        const emailKey = parsed.data.email.trim().toLowerCase();
        if (seenTenantEmails.has(emailKey)) {
          errors.push({
            row: i + 2,
            message: "Email dupliqué dans le fichier",
          });
          continue;
        }
        seenTenantEmails.add(emailKey);

        const existingTenant = await prisma.tenant.findFirst({
          where: {
            societyId,
            deletedAt: null,
            email: { equals: parsed.data.email, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (existingTenant) {
          errors.push({
            row: i + 2,
            message: "Un locataire existe déjà avec cet email",
          });
          continue;
        }

        try {
          const tenantData = parsed.data.entityType === "PERSONNE_MORALE"
            ? {
                entityType: "PERSONNE_MORALE" as const,
                companyName: parsed.data.companyName.trim(),
                companyLegalForm: parsed.data.companyLegalForm.trim() || null,
                siret: parsed.data.siret.trim() || null,
              }
            : {
                entityType: "PERSONNE_PHYSIQUE" as const,
                lastName: parsed.data.nom,
                firstName: parsed.data.prenom,
              };

          await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
              data: {
                societyId,
                email: parsed.data.email,
                phone: parsed.data.telephone || null,
                ...tenantData,
              },
              select: { id: true },
            });

            await tx.contact.create({
              data: {
                societyId,
                tenantId: tenant.id,
                contactType: "LOCATAIRE",
                name: parsed.data.entityType === "PERSONNE_MORALE"
                  ? parsed.data.companyName.trim()
                  : `${parsed.data.prenom} ${parsed.data.nom}`.trim(),
                company: null,
                email: parsed.data.email,
                phone: parsed.data.telephone || null,
              },
            });
          });
          imported++;
        } catch (err) {
          errors.push({
            row: i + 2,
            message: err instanceof Error ? err.message : "Erreur d'insertion",
          });
        }
      }
    } else if (entityType === "buildings") {
      const seenBuildings = new Set<string>();

      for (let i = 0; i < data.length; i++) {
        const row = normalizeBulkImportRow(entityType, data[i]);
        const parsed = importBuildingRowSchema.safeParse(row);
        if (!parsed.success) {
          errors.push({
            row: i + 2,
            message: parsed.error.errors.map((e) => e.message).join(", "),
          });
          continue;
        }

        const buildingKey = `${parsed.data.name.trim().toLowerCase()}::${parsed.data.postalCode}`;
        if (seenBuildings.has(buildingKey)) {
          errors.push({
            row: i + 2,
            message: "Immeuble dupliqué dans le fichier",
          });
          continue;
        }
        seenBuildings.add(buildingKey);

        const existingBuilding = await prisma.building.findFirst({
          where: {
            societyId,
            postalCode: parsed.data.postalCode,
            name: { equals: parsed.data.name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (existingBuilding) {
          errors.push({
            row: i + 2,
            message: "Un immeuble existe déjà avec ce nom et ce code postal",
          });
          continue;
        }

        try {
          await prisma.building.create({
            data: {
              societyId,
              name: parsed.data.name,
              addressLine1: parsed.data.address,
              city: parsed.data.city,
              postalCode: parsed.data.postalCode,
              buildingType: parsed.data.type,
            },
          });
          imported++;
        } catch (err) {
          errors.push({
            row: i + 2,
            message: err instanceof Error ? err.message : "Erreur d'insertion",
          });
        }
      }
    } else if (entityType === "lots") {
      const lotCheck = await checkLotLimit(societyId);
      if (!lotCheck.allowed) return { success: false, error: lotCheck.message };
      const seenLots = new Set<string>();

      for (let i = 0; i < data.length; i++) {
        const row = normalizeBulkImportRow(entityType, data[i]);
        const parsed = importLotRowSchema.safeParse(row);
        if (!parsed.success) {
          errors.push({
            row: i + 2,
            message: parsed.error.errors.map((e) => e.message).join(", "),
          });
          continue;
        }
        // Verify building belongs to this society. Prefer the technical id when present,
        // but accept the building name to match real-world Excel exports.
        const building = parsed.data.buildingId.trim()
          ? await prisma.building.findFirst({
              where: { id: parsed.data.buildingId, societyId },
              select: { id: true },
            })
          : await prisma.building.findFirst({
              where: {
                societyId,
                name: { equals: parsed.data.buildingName.trim(), mode: "insensitive" },
              },
              select: { id: true },
            });
        if (!building) {
          errors.push({ row: i + 2, message: "Immeuble introuvable dans cette societe" });
          continue;
        }

        const lotKey = `${building.id}::${parsed.data.reference.trim().toLowerCase()}`;
        if (seenLots.has(lotKey)) {
          errors.push({
            row: i + 2,
            message: "Numéro de lot dupliqué dans le fichier pour cet immeuble",
          });
          continue;
        }
        seenLots.add(lotKey);

        const existingLot = await prisma.lot.findFirst({
          where: { buildingId: building.id, number: parsed.data.reference },
          select: { id: true },
        });
        if (existingLot) {
          errors.push({
            row: i + 2,
            message: `Le lot "${parsed.data.reference}" existe déjà dans cet immeuble`,
          });
          continue;
        }

        try {
          await prisma.lot.create({
            data: {
              buildingId: building.id,
              number: parsed.data.reference,
              lotType: parsed.data.type,
              area: parsed.data.surface,
              floor: parsed.data.etage || null,
              status: "VACANT",
            },
          });
          imported++;
        } catch (err) {
          errors.push({
            row: i + 2,
            message: err instanceof Error ? err.message : "Erreur d'insertion",
          });
        }
      }
    } else if (entityType === "contacts") {
      const seenContactEmails = new Set<string>();
      const seenContactNames = new Set<string>();

      for (let i = 0; i < data.length; i++) {
        const row = normalizeBulkImportRow(entityType, data[i]);
        const parsed = importContactRowSchema.safeParse(row);
        if (!parsed.success) {
          errors.push({
            row: i + 2,
            message: parsed.error.errors.map((e) => e.message).join(", "),
          });
          continue;
        }

        const email = (parsed.data.email ?? "").trim();
        const contactName = parsed.data.name.trim();
        const company = parsed.data.company.trim();
        if (email) {
          const emailKey = email.toLowerCase();
          if (seenContactEmails.has(emailKey)) {
            errors.push({
              row: i + 2,
              message: "Email dupliqué dans le fichier",
            });
            continue;
          }
          seenContactEmails.add(emailKey);

          const existingContact = await prisma.contact.findFirst({
            where: {
              societyId,
              isActive: true,
              email: { equals: email, mode: "insensitive" },
            },
            select: { id: true },
          });
          if (existingContact) {
            errors.push({
              row: i + 2,
              message: "Un contact existe déjà avec cet email",
            });
            continue;
          }
        }
        if (!email) {
          const contactKey = `${parsed.data.contactType}::${contactName.toLowerCase()}::${company.toLowerCase()}`;
          if (seenContactNames.has(contactKey)) {
            errors.push({
              row: i + 2,
              message: "Contact dupliqué dans le fichier",
            });
            continue;
          }
          seenContactNames.add(contactKey);

          const existingContact = await prisma.contact.findFirst({
            where: {
              societyId,
              isActive: true,
              contactType: parsed.data.contactType,
              name: { equals: contactName, mode: "insensitive" },
              company: company ? { equals: company, mode: "insensitive" } : null,
            },
            select: { id: true },
          });
          if (existingContact) {
            errors.push({
              row: i + 2,
              message: "Un contact existe déjà avec ce nom",
            });
            continue;
          }
        }

        try {
          await prisma.contact.create({
            data: {
              societyId,
              contactType: parsed.data.contactType,
              name: contactName,
              company: company || null,
              specialty: parsed.data.specialty || null,
              email: email || null,
              phone: parsed.data.phone || null,
              mobile: parsed.data.mobile || null,
              addressLine1: parsed.data.addressLine1 || null,
              city: parsed.data.city || null,
              postalCode: parsed.data.postalCode || null,
              notes: parsed.data.notes || null,
            },
          });
          imported++;
        } catch (err) {
          errors.push({
            row: i + 2,
            message: err instanceof Error ? err.message : "Erreur d'insertion",
          });
        }
      }
    }

    // Audit log for the bulk import
    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "BulkImport",
      entityId: societyId,
      details: {
        entityType,
        totalRows: data.length,
        imported,
        errorCount: errors.length,
      },
    });

    revalidatePath("/patrimoine/immeubles");
    revalidatePath("/patrimoine/lots");
    revalidatePath("/locataires");
    revalidatePath("/contacts");
    revalidatePath("/dashboard");

    return { success: true, data: { imported, errors } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifie" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[importEntities]", error);
    return { success: false, error: "Erreur lors de l'import en masse" };
  }
}

