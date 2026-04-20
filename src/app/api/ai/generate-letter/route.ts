import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { generateLetter } from "@/lib/ai-letter-generator";
import { createAuditLog } from "@/lib/audit";

const LETTER_TYPES = [
  "relance_loyer",
  "mise_en_demeure",
  "conge_locataire",
  "conge_bailleur",
  "augmentation_loyer",
  "revision_loyer",
  "resiliation_bail",
  "attestation_domicile",
  "attestation",
  "quittance_manuelle",
  "courrier_travaux",
  "avis_travaux",
  "regularisation_charges",
  "demande_assurance",
  "courrier_libre",
] as const;

const letterRequestSchema = z.object({
  letterType: z.enum(LETTER_TYPES),
  description: z.string().min(10, "Description trop courte").max(2000, "Description trop longue"),
  context: z.object({
    bailleurNom: z.string().min(1).max(200),
    bailleurAdresse: z.string().min(1).max(500),
    locataireNom: z.string().max(200).optional(),
    locataireAdresse: z.string().max(500).optional(),
    bienAdresse: z.string().max(500).optional(),
    loyerMontant: z.number().min(0).max(1_000_000).optional(),
    chargesMontant: z.number().min(0).max(1_000_000).optional(),
    dateDebutBail: z.string().max(20).optional(),
    dateFinBail: z.string().max(20).optional(),
    montantImpayes: z.number().min(0).max(10_000_000).optional(),
    periodesImpayees: z.string().max(500).optional(),
    extra: z.string().max(1000, "Informations complémentaires trop longues").optional(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const context = await requireActiveSocietyRouteContext({ minRole: "GESTIONNAIRE" });
    if (context instanceof NextResponse) return context;

    const body = await req.json();
    const parsed = letterRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const letter = await generateLetter(parsed.data);

    await createAuditLog({
      societyId: context.societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "AILetter",
      entityId: "generated",
      details: { letterType: parsed.data.letterType, tone: letter.tone },
    });

    return NextResponse.json({ letter });
  } catch (error) {
    console.error("[AI Letter]", error);
    return NextResponse.json({ error: "Erreur lors de la génération du courrier" }, { status: 500 });
  }
}
