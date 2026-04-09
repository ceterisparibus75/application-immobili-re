"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import type {
  BuildingType,
  LotType,
  LeaseType,
  LeaseDestination,
  PaymentFrequency,
  IndexType,
  TenantEntityType,
} from "@/generated/prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export type ImportBuildingInput = {
  existingId?: string;
  name: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  buildingType: BuildingType;
};

export type ImportLotInput = {
  existingId?: string;
  number: string;
  lotType: LotType;
  area: number;
  floor?: string | null;
  position?: string | null;
};

export type ImportTenantInput = {
  existingId?: string;
  entityType: TenantEntityType;
  // Personne morale
  companyName?: string | null;
  companyLegalForm?: string | null;
  siret?: string | null;
  legalRepName?: string | null;
  legalRepTitle?: string | null;
  legalRepEmail?: string | null;
  legalRepPhone?: string | null;
  // Personne physique
  firstName?: string | null;
  lastName?: string | null;
  // Commun
  email: string;
  phone?: string | null;
  mobile?: string | null;
};

export type ImportLeaseInput = {
  leaseType: LeaseType;
  destination?: LeaseDestination | null;
  startDate: string;
  durationMonths: number;
  baseRentHT: number;
  depositAmount: number;
  paymentFrequency: PaymentFrequency;
  vatApplicable: boolean;
  vatRate: number;
  indexType?: IndexType | null;
  rentFreeMonths: number;
  entryFee: number;
  tenantWorksClauses?: string | null;
};

export type ImportInput = {
  building: ImportBuildingInput;
  lot: ImportLotInput;
  tenant: ImportTenantInput;
  lease: ImportLeaseInput;
};

export type ImportResult = {
  leaseId: string;
  buildingId: string;
  lotId: string;
  tenantId: string;
};

export async function importFromPdf(
  societyId: string,
  input: ImportInput
): Promise<ActionResult<ImportResult>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const result = await prisma.$transaction(async (tx) => {
      // 1. Immeuble
      let buildingId = input.building.existingId;
      if (!buildingId) {
        const building = await tx.building.create({
          data: {
            societyId,
            name: input.building.name,
            addressLine1: input.building.addressLine1,
            city: input.building.city,
            postalCode: input.building.postalCode,
            buildingType: input.building.buildingType,
          },
        });
        buildingId = building.id;
      } else {
        const existing = await tx.building.findFirst({ where: { id: buildingId, societyId } });
        if (!existing) throw new Error("Immeuble introuvable dans cette société");
      }

      // 2. Lot — utiliser un existant ou en créer un nouveau
      let lot;
      if (input.lot.existingId) {
        // Lot existant : vérifier qu'il appartient à cet immeuble
        const foundLot = await tx.lot.findFirst({
          where: { id: input.lot.existingId, buildingId },
        });
        if (!foundLot) throw new Error("Lot introuvable dans cet immeuble");
        lot = foundLot;
      } else {
        // Nouveau lot
        const existingLot = await tx.lot.findFirst({
          where: { buildingId, number: input.lot.number },
        });
        if (existingLot) {
          throw new Error(`Le lot "${input.lot.number}" existe déjà dans cet immeuble`);
        }
        lot = await tx.lot.create({
          data: {
            buildingId,
            number: input.lot.number,
            lotType: input.lot.lotType,
            area: input.lot.area,
            floor: input.lot.floor ?? null,
            position: input.lot.position ?? null,
            status: "VACANT",
          },
        });
      }

      // 3. Locataire
      let tenantId = input.tenant.existingId;
      if (!tenantId) {
        const baseData = {
          societyId,
          entityType: input.tenant.entityType,
          email: input.tenant.email,
          phone: input.tenant.phone ?? null,
          mobile: input.tenant.mobile ?? null,
        };

        const specificData =
          input.tenant.entityType === "PERSONNE_MORALE"
            ? {
                companyName: input.tenant.companyName ?? "À compléter",
                companyLegalForm: input.tenant.companyLegalForm ?? null,
                siret: input.tenant.siret ?? null,
                legalRepName: input.tenant.legalRepName ?? null,
                legalRepTitle: input.tenant.legalRepTitle ?? null,
                legalRepEmail: input.tenant.legalRepEmail ?? null,
                legalRepPhone: input.tenant.legalRepPhone ?? null,
              }
            : {
                firstName: input.tenant.firstName ?? "À compléter",
                lastName: input.tenant.lastName ?? "À compléter",
              };

        const tenant = await tx.tenant.create({ data: { ...baseData, ...specificData } });
        tenantId = tenant.id;
      } else {
        const existing = await tx.tenant.findFirst({ where: { id: tenantId, societyId } });
        if (!existing) throw new Error("Locataire introuvable dans cette société");
      }

      // Check no active lease on this lot
      const activeLease = await tx.lease.findFirst({
        where: { lotId: lot.id, status: "EN_COURS" },
      });
      if (activeLease) throw new Error("Ce lot a déjà un bail actif");

      // 4. Bail
      const startDate = new Date(input.lease.startDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + input.lease.durationMonths);

      const lease = await tx.lease.create({
        data: {
          societyId,
          lotId: lot.id,
          tenantId,
          leaseType: input.lease.leaseType,
          destination: input.lease.destination ?? null,
          status: "EN_COURS",
          startDate,
          endDate,
          durationMonths: input.lease.durationMonths,
          baseRentHT: input.lease.baseRentHT,
          currentRentHT: input.lease.baseRentHT,
          depositAmount: input.lease.depositAmount,
          paymentFrequency: input.lease.paymentFrequency,
          vatApplicable: input.lease.vatApplicable,
          vatRate: input.lease.vatRate,
          indexType: input.lease.indexType ?? null,
          rentFreeMonths: input.lease.rentFreeMonths,
          entryFee: input.lease.entryFee,
          tenantWorksClauses: input.lease.tenantWorksClauses ?? null,
        },
      });

      // 5. Mise à jour statut du lot
      await tx.lot.update({
        where: { id: lot.id },
        data: { status: "OCCUPE", currentRent: input.lease.baseRentHT },
      });

      return { leaseId: lease.id, buildingId: buildingId!, lotId: lot.id, tenantId: tenantId! };
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Import",
      entityId: result.leaseId,
      details: {
        source: "pdf_import",
        buildingId: result.buildingId,
        lotId: result.lotId,
        tenantId: result.tenantId,
        leaseId: result.leaseId,
      },
    });

    revalidatePath("/patrimoine/immeubles");
    revalidatePath("/patrimoine/lots");
    revalidatePath("/locataires");
    revalidatePath("/baux");

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    if (error instanceof Error) return { success: false, error: error.message };
    console.error("[importFromPdf]", error);
    return { success: false, error: "Erreur lors de l'import" };
  }
}

const EXTRACTION_PROMPT = `Tu es un expert en droit immobilier commercial français. Analyse ce bail et extrais les informations structurées.

Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas d'explication).

Structure exacte :
{
  "immeuble": {
    "name": "Nom ou adresse courte de l'immeuble",
    "addressLine1": "Numéro et rue",
    "city": "Ville",
    "postalCode": "Code postal 5 chiffres",
    "buildingType": "BUREAU|COMMERCE|MIXTE|ENTREPOT"
  },
  "lot": {
    "number": "Numéro ou référence du lot (ex: A1, 12, RDC-G)",
    "lotType": "LOCAL_COMMERCIAL|BUREAUX|LOCAL_ACTIVITE|BUREAU|ENTREPOT|PARKING|CAVE|TERRASSE|RESERVE",
    "area": 0.0,
    "floor": "RDC|1er|2ème...",
    "position": "Description de la position (ex: aile gauche, bâtiment B)"
  },
  "locataire": {
    "entityType": "PERSONNE_MORALE|PERSONNE_PHYSIQUE",
    "companyName": "Raison sociale si personne morale, sinon null",
    "companyLegalForm": "SAS|SARL|SA|EURL|SNC|EI|AUTRE ou null",
    "siret": "14 chiffres ou null",
    "legalRepName": "Nom prénom du représentant légal ou null",
    "legalRepTitle": "Gérant|Président|DG... ou null",
    "legalRepEmail": "Email représentant ou null",
    "legalRepPhone": "Téléphone représentant ou null",
    "firstName": "Prénom si personne physique, sinon null",
    "lastName": "Nom si personne physique, sinon null",
    "email": "Email principal (si absent utilise 'a-renseigner@exemple.fr')",
    "phone": "Téléphone ou null",
    "mobile": "Mobile ou null"
  },
  "bail": {
    "leaseType": "HABITATION|MEUBLE|ETUDIANT|MOBILITE|COLOCATION|SAISONNIER|LOGEMENT_FONCTION|ANAH|CIVIL|GLISSANT|SOUS_LOCATION|COMMERCIAL_369|DEROGATOIRE|PRECAIRE|BAIL_PROFESSIONNEL|MIXTE|EMPHYTEOTIQUE|CONSTRUCTION|REHABILITATION|BRS|RURAL",
    "startDate": "YYYY-MM-DD",
    "durationMonths": 108,
    "baseRentHT": 0.0,
    "depositAmount": 0.0,
    "paymentFrequency": "MENSUEL|TRIMESTRIEL",
    "vatApplicable": true,
    "vatRate": 20.0,
    "indexType": "IRL|ILC|ILAT|ICC|null",
    "rentFreeMonths": 0,
    "entryFee": 0.0,
    "destination": "HABITATION|BUREAU|COMMERCE|ACTIVITE|ENTREPOT|INDUSTRIEL|PROFESSIONNEL|MIXTE|PARKING|TERRAIN|AGRICOLE|HOTELLERIE|EQUIPEMENT|AUTRE|null",
    "tenantWorksClauses": "Clauses travaux preneur ou null"
  }
}

Règles :
- destination : usage prévu des locaux tel que mentionné dans le bail. HABITATION pour logement, BUREAU pour bureaux/tertiaire, COMMERCE pour boutique/restaurant, ACTIVITE pour atelier/artisanat, ENTREPOT pour stockage/logistique, INDUSTRIEL pour usine, PROFESSIONNEL pour cabinet libéral, MIXTE pour habitation+professionnel, PARKING pour garage/box, TERRAIN pour terrain nu, AGRICOLE pour exploitation agricole, HOTELLERIE pour hôtel/tourisme, EQUIPEMENT pour salle/crèche/clinique, AUTRE sinon. Si non précisé, déduire du type de bail.
- buildingType : COMMERCE pour local commercial/boutique, BUREAU pour bureaux, ENTREPOT pour entrepôt/stockage, MIXTE sinon
- leaseType : HABITATION pour bail vide loi 1989, MEUBLE pour bail meublé ALUR, ETUDIANT pour bail étudiant meublé 9 mois, MOBILITE pour bail mobilité ELAN, COLOCATION pour bail colocation, SAISONNIER pour location saisonnière, LOGEMENT_FONCTION pour logement de fonction, ANAH pour convention ANAH, CIVIL pour bail Code civil (résidence secondaire), GLISSANT pour bail glissant (insertion sociale), SOUS_LOCATION pour sous-location, COMMERCIAL_369 pour bail 3-6-9 (art. L145), DEROGATOIRE pour bail < 3 ans, PRECAIRE pour convention précaire, BAIL_PROFESSIONNEL pour bail professionnel (professions libérales), MIXTE pour bail mixte habitation+professionnel, EMPHYTEOTIQUE pour bail emphytéotique (18-99 ans), CONSTRUCTION pour bail à construction, REHABILITATION pour bail à réhabilitation, BRS pour bail réel solidaire (OFS), RURAL pour bail rural/agricole
- durationMonths : 36 pour habitation (3 ans), 12 pour meublé (1 an), 9 pour étudiant, 10 pour mobilité, 108 pour bail 3-6-9 (9 ans), 72 pour professionnel (6 ans), 36 pour dérogatoire (3 ans max), 1188 pour emphytéotique (99 ans)
- Les montants sont en euros HT/an si loyer annuel, /mois si mensuel — converti toujours en euros HT/MOIS
- Si une info est absente, mets null pour les champs optionnels
- startDate au format ISO YYYY-MM-DD`;

/** Analyse un PDF de bail via l'IA et extrait les données structurées. */
export async function analyzePdfAction(formData: FormData): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (societyId) {
      try {
        await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");
      } catch {
        return { success: false, error: "Accès non autorisé" };
      }
    }

    if (!env.ANTHROPIC_API_KEY) {
      return { success: false, error: "La clé API Anthropic n'est pas configurée. Contactez l'administrateur." };
    }

    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "Aucun fichier fourni" };
    if (file.type !== "application/pdf") return { success: false, error: "Seuls les fichiers PDF sont acceptés" };
    if (file.size > 20 * 1024 * 1024) return { success: false, error: "Fichier trop volumineux (max 20 Mo)" };

    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const pdfBase64 = fileBuffer.toString("base64");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } } as Anthropic.DocumentBlockParam,
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "Impossible d'extraire les données du document. Vérifiez qu'il s'agit bien d'un bail." };
    }

    const extracted = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return { success: true, data: extracted };
  } catch (error) {
    console.error("[analyzePdfAction]", error);
    return { success: false, error: "Erreur lors de l'analyse du document" };
  }
}

// ---- Bulk CSV/Excel import ----

import { parseImportFile } from "@/lib/import-parser";
import {
  importTenantRowSchema,
  importBuildingRowSchema,
  importLotRowSchema,
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

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
    console.error("[parseImportFileAction]", error);
    return { success: false, error: "Erreur lors de la lecture du fichier" };
  }
}

export type BulkImportResult = {
  imported: number;
  errors: { row: number; message: string }[];
};

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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };

    if (!data.length) return { success: false, error: "Aucune donnee a importer" };

    let imported = 0;
    const errors: { row: number; message: string }[] = [];

    if (entityType === "tenants") {
      for (let i = 0; i < data.length; i++) {
        const parsed = importTenantRowSchema.safeParse(data[i]);
        if (!parsed.success) {
          errors.push({
            row: i + 2,
            message: parsed.error.errors.map((e) => e.message).join(", "),
          });
          continue;
        }
        try {
          await prisma.tenant.create({
            data: {
              societyId,
              entityType: "PERSONNE_PHYSIQUE",
              lastName: parsed.data.nom,
              firstName: parsed.data.prenom,
              email: parsed.data.email,
              phone: parsed.data.telephone || null,
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
    } else if (entityType === "buildings") {
      for (let i = 0; i < data.length; i++) {
        const parsed = importBuildingRowSchema.safeParse(data[i]);
        if (!parsed.success) {
          errors.push({
            row: i + 2,
            message: parsed.error.errors.map((e) => e.message).join(", "),
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

      for (let i = 0; i < data.length; i++) {
        const parsed = importLotRowSchema.safeParse(data[i]);
        if (!parsed.success) {
          errors.push({
            row: i + 2,
            message: parsed.error.errors.map((e) => e.message).join(", "),
          });
          continue;
        }
        // Verify building belongs to this society
        const building = await prisma.building.findFirst({
          where: { id: parsed.data.buildingId, societyId },
        });
        if (!building) {
          errors.push({ row: i + 2, message: "Immeuble introuvable dans cette societe" });
          continue;
        }
        try {
          await prisma.lot.create({
            data: {
              buildingId: parsed.data.buildingId,
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
    }

    // Audit log for the bulk import
    await createAuditLog({
      societyId,
      userId: session.user.id,
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
    revalidatePath("/dashboard");

    return { success: true, data: { imported, errors } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[importEntities]", error);
    return { success: false, error: "Erreur lors de l'import en masse" };
  }
}
