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
import { getOptionalAccessibleActiveSocietyId } from "@/lib/active-society";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type {
  ImportInput,
  ImportResult,
} from "@/actions/import-shared";

export async function importFromPdf(
  societyId: string,
  input: ImportInput
): Promise<ActionResult<ImportResult>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

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

      const secondaryLotIds = Array.from(
        new Set((input.secondaryLotIds ?? []).filter((lotId) => lotId !== lot.id))
      );
      if (secondaryLotIds.length > 0) {
        const secondaryLots = await tx.lot.findMany({
          where: {
            id: { in: secondaryLotIds },
            building: { societyId },
          },
          select: { id: true },
        });

        if (secondaryLots.length !== secondaryLotIds.length) {
          throw new Error("Un ou plusieurs lots secondaires sont introuvables");
        }
      }

      const allLotIds = [lot.id, ...secondaryLotIds];

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
      const activeLease = await tx.leaseLot.findFirst({
        where: { lotId: lot.id, lease: { status: "EN_COURS" } },
      });
      if (activeLease) throw new Error("Ce lot a déjà un bail actif");

      if (secondaryLotIds.length > 0) {
        const activeSecondaryLeases = await tx.leaseLot.findMany({
          where: {
            lotId: { in: secondaryLotIds },
            lease: { status: "EN_COURS" },
          },
          include: { lot: { select: { number: true } } },
        });
        if (activeSecondaryLeases.length > 0) {
          const lotNumbers = activeSecondaryLeases.map((item) => item.lot.number).join(", ");
          throw new Error(`Le(s) lot(s) secondaire(s) ${lotNumbers} ont déjà un bail actif`);
        }
      }

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
          baseIndexValue: input.lease.baseIndexValue ?? null,
          baseIndexQuarter: input.lease.baseIndexQuarter ?? null,
          revisionFrequency: input.lease.revisionFrequency ?? 12,
          revisionDateBasis: input.lease.revisionDateBasis ?? "DATE_SIGNATURE",
          revisionCustomMonth: input.lease.revisionCustomMonth ?? null,
          revisionCustomDay: input.lease.revisionCustomDay ?? null,
          rentFreeMonths: input.lease.rentFreeMonths,
          entryFee: input.lease.entryFee,
          tenantWorksClauses: input.lease.tenantWorksClauses ?? null,
          isThirdPartyManaged: input.lease.isThirdPartyManaged ?? false,
          managingContactId: input.lease.managingContactId ?? null,
          managementFeeType: input.lease.managementFeeType ?? null,
          managementFeeValue: input.lease.managementFeeValue ?? null,
          managementFeeBasis: input.lease.managementFeeBasis ?? null,
          managementFeeVatRate: input.lease.managementFeeVatRate ?? null,
        },
      });

      // 5. Créer les entrées LeaseLot
      await tx.leaseLot.createMany({
        data: allLotIds.map((lotId, index) => ({
          leaseId: lease.id,
          lotId,
          isPrimary: index === 0,
        })),
      });

      // 6. Mise à jour statut des lots
      await tx.lot.updateMany({
        where: { id: { in: allLotIds } },
        data: { status: "OCCUPE" },
      });
      await tx.lot.update({
        where: { id: lot.id },
        data: { currentRent: input.lease.baseRentHT },
      });

      return { leaseId: lease.id, buildingId: buildingId!, lotId: lot.id, tenantId: tenantId! };
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
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
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    "baseIndexValue": 0.0,
    "baseIndexQuarter": "T1 2021|T2 2021|T3 2021|T4 2021|null",
    "revisionFrequency": 12,
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
- indexType : IRL pour habitation/meublé, ILC pour commercial/rural, ILAT pour professionnel/tertiaire, ICC rarement utilisé. Cherche la mention explicite dans le bail (ex: "indice de référence des loyers" = IRL, "indice des loyers commerciaux" = ILC)
- baseIndexValue : valeur numérique de l'indice de référence mentionnée dans le bail (ex: "indice de base 130.69", "IRL du T1 2021 = 130.69"). Si non trouvée, null
- baseIndexQuarter : trimestre de référence au format "T1 YYYY" (ex: "T1 2021", "T4 2020"). Cherche "trimestre de référence", "indice du T...", "publié au..."
- revisionFrequency : 12 par défaut (annuel). Si le bail mentionne une révision triennale, mettre 36
- Les montants sont en euros HT/an si loyer annuel, /mois si mensuel — converti toujours en euros HT/MOIS
- Si une info est absente, mets null pour les champs optionnels
- startDate au format ISO YYYY-MM-DD`;

/** Analyse un PDF de bail via l'IA et extrait les données structurées. */
export async function analyzePdfAction(formData: FormData): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const context = await requireAuthenticatedActionContext();

    const societyId = await getOptionalAccessibleActiveSocietyId(
      context.userId,
      "GESTIONNAIRE"
    );
    if (!societyId) return { success: false, error: "Accès non autorisé" };

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
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    console.error("[analyzePdfAction]", error);
    const msg = error instanceof Error ? error.message : "Erreur lors de l'analyse du document";
    return { success: false, error: msg };
  }
}
