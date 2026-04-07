"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { env } from "@/lib/env";
import { createAuditLog } from "@/lib/audit";
import type { ActionResult } from "@/actions/society";

const LETTER_TYPES = [
  "MISE_EN_DEMEURE",
  "REGULARISATION",
  "REVISION_LOYER",
  "RESILIATION_BAIL",
  "QUITTANCE_PERSONNALISEE",
  "COURRIER_LIBRE",
] as const;

export type LetterType = (typeof LETTER_TYPES)[number];

const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  MISE_EN_DEMEURE: "Mise en demeure",
  REGULARISATION: "Demande de regularisation",
  REVISION_LOYER: "Avis de revision de loyer",
  RESILIATION_BAIL: "Resiliation de bail",
  QUITTANCE_PERSONNALISEE: "Quittance personnalisee",
  COURRIER_LIBRE: "Courrier libre",
};

const LETTER_TYPE_LEGAL_REFS: Record<LetterType, string> = {
  MISE_EN_DEMEURE:
    "Articles 1344 et suivants du Code civil. Loi n89-462 du 6 juillet 1989 relative aux rapports locatifs.",
  REGULARISATION:
    "Article 23 de la loi n89-462 du 6 juillet 1989. Decret n87-713 du 26 aout 1987.",
  REVISION_LOYER:
    "Article 17-1 de la loi n89-462 du 6 juillet 1989. Indice de Reference des Loyers (IRL) publie par l'INSEE.",
  RESILIATION_BAIL:
    "Articles 12 et 15 de la loi n89-462 du 6 juillet 1989. Article 1224 du Code civil.",
  QUITTANCE_PERSONNALISEE:
    "Article 21 de la loi n89-462 du 6 juillet 1989.",
  COURRIER_LIBRE: "",
};

function buildSystemPrompt(type: LetterType): string {
  const legalRefs = LETTER_TYPE_LEGAL_REFS[type];

  return `Tu es un assistant juridique specialise en droit immobilier francais. Tu rediges des courriers professionnels pour un bailleur (proprietaire/gestionnaire immobilier).

Regles de redaction :
- Redige en francais soutenu et professionnel
- Structure le courrier avec : lieu et date, coordonnees expediteur, coordonnees destinataire, objet, corps du courrier (avec formules de politesse), signature
- Utilise les donnees reelles fournies (noms, adresses, montants, dates)
- Integre les references legales appropriees${legalRefs ? ` : ${legalRefs}` : ""}
- Les montants doivent etre affiches en euros avec le format francais (ex: 1 250,00 EUR)
- Les dates doivent etre au format francais (ex: 7 avril 2026)
- Ne genere PAS de balises HTML ou Markdown. Utilise du texte brut avec des retours a la ligne.
- Le ton doit etre ferme mais courtois
- Termine toujours par une formule de politesse adaptee au contexte`;
}

function buildUserPrompt(
  type: LetterType,
  lease: LeaseContext,
  customInstructions?: string
): string {
  const unpaidInvoices = lease.invoices.filter(
    (inv) =>
      inv.status === "EN_RETARD" ||
      inv.status === "RELANCEE" ||
      inv.status === "PARTIELLEMENT_PAYE"
  );

  const totalUnpaid = unpaidInvoices.reduce(
    (sum, inv) => sum + inv.totalHT,
    0
  );

  let prompt = `Redige un courrier de type "${LETTER_TYPE_LABELS[type]}" avec les informations suivantes :

BAILLEUR (expediteur) :
- Raison sociale : ${lease.society.name}
- Adresse : ${lease.society.addressLine1}${lease.society.addressLine2 ? `, ${lease.society.addressLine2}` : ""}, ${lease.society.postalCode} ${lease.society.city}
- SIRET : ${lease.society.siret}
${lease.society.signatoryName ? `- Signataire : ${lease.society.signatoryName}` : ""}

LOCATAIRE (destinataire) :
- Nom : ${lease.tenantName}
- Email : ${lease.tenant.email}
${lease.tenant.phone ? `- Telephone : ${lease.tenant.phone}` : ""}

BIEN LOUE :
- Immeuble : ${lease.lot.building.name}
- Adresse : ${lease.lot.building.city}${lease.lot.building.postalCode ? ` (${lease.lot.building.postalCode})` : ""}
- Lot n : ${lease.lot.number}
- Surface : ${lease.lot.area} m2

BAIL :
- Type : ${lease.leaseType}
- Date de debut : ${formatDateFr(lease.startDate)}
- Date de fin : ${formatDateFr(lease.endDate)}
- Loyer actuel HT : ${lease.currentRentHT.toLocaleString("fr-FR")} EUR
- Depot de garantie : ${lease.depositAmount.toLocaleString("fr-FR")} EUR
`;

  if (unpaidInvoices.length > 0) {
    prompt += `
FACTURES IMPAYEES (${unpaidInvoices.length}) :
${unpaidInvoices
  .map(
    (inv) =>
      `- ${inv.invoiceNumber} : ${inv.totalHT.toLocaleString("fr-FR")} EUR HT (echeance : ${formatDateFr(inv.dueDate)}, statut : ${inv.status})`
  )
  .join("\n")}
- Total impaye : ${totalUnpaid.toLocaleString("fr-FR")} EUR HT
`;
  }

  if (customInstructions) {
    prompt += `\nINSTRUCTIONS SUPPLEMENTAIRES :\n${customInstructions}\n`;
  }

  return prompt;
}

function formatDateFr(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface LeaseContext {
  leaseType: string;
  startDate: Date;
  endDate: Date;
  currentRentHT: number;
  depositAmount: number;
  tenantName: string;
  tenant: {
    email: string;
    phone: string | null;
  };
  lot: {
    number: string;
    area: number;
    building: {
      name: string;
      city: string;
      postalCode: string | null;
    };
  };
  society: {
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postalCode: string;
    siret: string;
    signatoryName: string | null;
  };
  invoices: Array<{
    invoiceNumber: string;
    totalHT: number;
    dueDate: Date;
    status: string;
  }>;
}

export async function generateLetter(
  societyId: string,
  leaseId: string,
  type: LetterType,
  customInstructions?: string
): Promise<ActionResult<{ content: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifie" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    if (!env.ANTHROPIC_API_KEY) {
      return {
        success: false,
        error:
          "La cle API Anthropic n'est pas configuree. Contactez l'administrateur.",
      };
    }

    if (!LETTER_TYPES.includes(type)) {
      return { success: false, error: "Type de courrier invalide" };
    }

    // Fetch lease with all needed relations
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId },
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            entityType: true,
            email: true,
            phone: true,
          },
        },
        lot: {
          include: {
            building: {
              select: {
                name: true,
                city: true,
                postalCode: true,
              },
            },
          },
        },
        society: {
          select: {
            name: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            postalCode: true,
            siret: true,
            signatoryName: true,
          },
        },
        invoices: {
          where: {
            createdAt: {
              gte: new Date(
                new Date().setMonth(new Date().getMonth() - 12)
              ),
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            invoiceNumber: true,
            totalHT: true,
            dueDate: true,
            status: true,
          },
        },
      },
    });

    if (!lease) {
      return { success: false, error: "Bail introuvable" };
    }

    const tenantName =
      lease.tenant.entityType === "PERSONNE_MORALE"
        ? lease.tenant.companyName ?? "—"
        : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim() || "—";

    const leaseContext: LeaseContext = {
      leaseType: lease.leaseType,
      startDate: lease.startDate,
      endDate: lease.endDate,
      currentRentHT: lease.currentRentHT,
      depositAmount: lease.depositAmount,
      tenantName,
      tenant: {
        email: lease.tenant.email,
        phone: lease.tenant.phone,
      },
      lot: {
        number: lease.lot.number,
        area: lease.lot.area,
        building: lease.lot.building,
      },
      society: lease.society,
      invoices: lease.invoices,
    };

    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: buildSystemPrompt(type),
        messages: [
          {
            role: "user",
            content: buildUserPrompt(type, leaseContext, customInstructions),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[generateLetter] API error:", response.status, errorBody);
      return {
        success: false,
        error: "Erreur lors de la generation du courrier. Veuillez reessayer.",
      };
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = data.content.find((block) => block.type === "text");
    if (!textContent) {
      return {
        success: false,
        error: "La reponse de l'IA ne contient pas de texte.",
      };
    }

    // Audit log
    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "EXPORT",
      entity: "Lease",
      entityId: leaseId,
      details: {
        operation: "GENERATE_AI_LETTER",
        letterType: type,
        tenantName,
      },
    });

    return { success: true, data: { content: textContent.text } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[generateLetter]", error);
    return {
      success: false,
      error: "Erreur lors de la generation du courrier",
    };
  }
}
