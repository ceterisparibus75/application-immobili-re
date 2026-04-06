"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { checkSubscriptionActive } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  createValuationSchema,
  runAiAnalysisSchema,
  uploadExpertReportSchema,
  searchComparablesSchema,
  updateValuationResultsSchema,
  type CreateValuationInput,
  type RunAiAnalysisInput,
  type SearchComparablesInput,
  type UpdateValuationResultsInput,
} from "@/validations/valuation";
import { collectBuildingData } from "@/lib/valuation/data-collector";
import { searchDvfTransactions } from "@/lib/valuation/dvf-service";
import { callClaude, callMistral, extractReportData } from "@/lib/valuation/ai-service";
import type { AiValuationResult } from "@/lib/valuation/types";

// ============================================================
// Création d'une évaluation
// ============================================================

export async function createValuation(
  societyId: string,
  input: CreateValuationInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };

    const parsed = createValuationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    // Vérifier que l'immeuble appartient à la société
    const building = await prisma.building.findFirst({
      where: { id: parsed.data.buildingId, societyId },
    });
    if (!building) return { success: false, error: "Immeuble introuvable" };

    // Limite : 2 avis de valeur par an et par immeuble
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const valuationsThisYear = await prisma.propertyValuation.count({
      where: {
        buildingId: parsed.data.buildingId,
        societyId,
        createdAt: { gte: yearStart },
      },
    });
    if (valuationsThisYear >= 2) {
      return { success: false, error: "Limite atteinte : 2 avis de valeur maximum par an et par immeuble" };
    }

    const valuation = await prisma.propertyValuation.create({
      data: {
        buildingId: parsed.data.buildingId,
        societyId,
        createdBy: session.user.id,
        status: "DRAFT",
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "PropertyValuation",
      entityId: valuation.id,
      details: { buildingId: building.id, buildingName: building.name },
    });

    revalidatePath(`/patrimoine/immeubles/${building.id}/valorisation`);
    return { success: true, data: { id: valuation.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createValuation]", error);
    return { success: false, error: "Erreur lors de la création de l'évaluation" };
  }
}

// ============================================================
// Lancer les analyses IA
// ============================================================

export async function runAiAnalysis(
  societyId: string,
  valuationId: string,
  input: RunAiAnalysisInput
): Promise<ActionResult<{ analysisCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = runAiAnalysisSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const valuation = await prisma.propertyValuation.findFirst({
      where: { id: valuationId, societyId },
    });
    if (!valuation) return { success: false, error: "Évaluation introuvable" };

    // Passer en IN_PROGRESS
    await prisma.propertyValuation.update({
      where: { id: valuationId },
      data: { status: "IN_PROGRESS" },
    });

    // Collecter les données
    const buildingData = await collectBuildingData(societyId, valuation.buildingId);

    // Lancer les analyses en parallèle
    const providers = parsed.data.providers;
    const promises: Promise<{ provider: "CLAUDE" | "MISTRAL"; result: AiValuationResult; rawResponse: string; durationMs: number; tokenCount: number }>[] = [];

    if (providers.includes("CLAUDE")) {
      promises.push(
        callClaude(buildingData).then((r) => ({ provider: "CLAUDE" as const, ...r }))
      );
    }
    if (providers.includes("MISTRAL")) {
      promises.push(
        callMistral(buildingData).then((r) => ({ provider: "MISTRAL" as const, ...r }))
      );
    }

    const results = await Promise.allSettled(promises);
    let analysisCount = 0;

    for (const settled of results) {
      if (settled.status === "fulfilled") {
        const { provider, result, rawResponse, durationMs, tokenCount } = settled.value;
        await prisma.aiValuationAnalysis.create({
          data: {
            valuationId,
            provider,
            modelVersion: provider === "CLAUDE" ? "claude-sonnet-4-20250514" : "mistral-large-latest",
            inputPayload: buildingData as object,
            rawResponse,
            structuredResult: result as object,
            estimatedValue: result.summary.estimatedValueMid,
            rentalValue: result.summary.rentalValue,
            pricePerSqm: result.summary.pricePerSqm,
            capRate: result.summary.capitalizationRate,
            methodology: [
              result.methodology.comparisonMethod.applied ? "Comparaison" : null,
              result.methodology.incomeMethod.applied ? "Capitalisation" : null,
              result.methodology.costMethod.applied ? "Coût de remplacement" : null,
            ]
              .filter(Boolean)
              .join(", "),
            strengths: result.swot.strengths,
            weaknesses: result.swot.weaknesses,
            opportunities: result.swot.opportunities,
            threats: result.swot.threats,
            confidence: result.summary.confidence,
            durationMs,
            tokenCount,
          },
        });
        analysisCount++;
      } else {
        const reason = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
        console.error("[runAiAnalysis] Provider failed:", reason, settled.reason);
      }
    }

    // Mettre à jour les valeurs synthétiques si au moins une analyse a réussi
    if (analysisCount > 0) {
      const analyses = await prisma.aiValuationAnalysis.findMany({
        where: { valuationId },
        select: {
          estimatedValue: true,
          rentalValue: true,
          pricePerSqm: true,
          capRate: true,
        },
      });

      const values = analyses.filter((a) => a.estimatedValue != null).map((a) => a.estimatedValue!);
      if (values.length > 0) {
        await prisma.propertyValuation.update({
          where: { id: valuationId },
          data: {
            status: "COMPLETED",
            estimatedValueLow: Math.min(...values),
            estimatedValueMid: values.reduce((a, b) => a + b, 0) / values.length,
            estimatedValueHigh: Math.max(...values),
            estimatedRentalValue: average(analyses.map((a) => a.rentalValue)),
            pricePerSqm: average(analyses.map((a) => a.pricePerSqm)),
            capitalizationRate: average(analyses.map((a) => a.capRate)),
          },
        });
      }
    }

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "AiValuationAnalysis",
      entityId: valuationId,
      details: { providers: parsed.data.providers, analysisCount },
    });

    revalidatePath(`/patrimoine/immeubles/${valuation.buildingId}/valorisation`);
    return { success: true, data: { analysisCount } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[runAiAnalysis]", error);
    return { success: false, error: "Erreur lors de l'analyse IA" };
  }
}

// ============================================================
// Upload rapport d'expertise PDF
// ============================================================

export async function uploadExpertReport(
  societyId: string,
  valuationId: string,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "Aucun fichier fourni" };

    const metaParsed = uploadExpertReportSchema.safeParse({
      expertName: formData.get("expertName"),
      reportDate: formData.get("reportDate"),
      reportReference: formData.get("reportReference"),
    });
    if (!metaParsed.success) {
      return { success: false, error: metaParsed.error.errors.map((e) => e.message).join(", ") };
    }

    const valuation = await prisma.propertyValuation.findFirst({
      where: { id: valuationId, societyId },
    });
    if (!valuation) return { success: false, error: "Évaluation introuvable" };

    // Lire le buffer du fichier
    const buffer = Buffer.from(await file.arrayBuffer());

    // Stocker le fichier (URL temporaire locale en attendant Supabase)
    const fileUrl = `/api/storage/valuations/${valuationId}/${file.name}`;

    // Extraire les données via IA
    let extractedData: object = {};
    let estimatedValue: number | null = null;
    let rentalValue: number | null = null;
    let pricePerSqm: number | null = null;
    let capRate: number | null = null;
    let usableArea: number | null = null;
    let methodology: string | null = null;

    try {
      const extraction = await extractReportData(buffer);
      extractedData = extraction.result;
      estimatedValue = extraction.result.valuation.estimatedValue;
      rentalValue = extraction.result.valuation.rentalValue;
      pricePerSqm = extraction.result.valuation.pricePerSqm;
      capRate = extraction.result.valuation.capRate;
      usableArea = extraction.result.property.totalArea;
      methodology = extraction.result.valuation.methodsUsed.join(", ") || null;
    } catch (error) {
      console.error("[uploadExpertReport] Extraction IA échouée:", error);
      extractedData = { error: "Extraction automatique échouée" };
    }

    const report = await prisma.expertReport.create({
      data: {
        valuationId,
        expertName: metaParsed.data.expertName,
        reportDate: new Date(metaParsed.data.reportDate),
        reportReference: metaParsed.data.reportReference ?? null,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        extractedData,
        estimatedValue,
        rentalValue,
        pricePerSqm,
        capRate,
        usableArea,
        methodology,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "ExpertReport",
      entityId: report.id,
      details: { expertName: metaParsed.data.expertName, fileName: file.name },
    });

    revalidatePath(`/patrimoine/immeubles/${valuation.buildingId}/valorisation`);
    return { success: true, data: { id: report.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[uploadExpertReport]", error);
    return { success: false, error: "Erreur lors de l'import du rapport" };
  }
}

// ============================================================
// Recherche de comparables DVF
// ============================================================

export async function searchComparables(
  societyId: string,
  valuationId: string,
  input: SearchComparablesInput
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = searchComparablesSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const valuation = await prisma.propertyValuation.findFirst({
      where: { id: valuationId, societyId },
      include: { building: { select: { latitude: true, longitude: true, city: true, postalCode: true } } },
    });
    if (!valuation) return { success: false, error: "Évaluation introuvable" };

    const lat = valuation.building.latitude;
    const lng = valuation.building.longitude;

    if (!lat || !lng) {
      return { success: false, error: "Coordonnées GPS de l'immeuble manquantes. Mettez à jour la fiche immeuble." };
    }

    // Supprimer les anciens comparables DVF pour cette évaluation
    await prisma.comparableSale.deleteMany({
      where: { valuationId, source: "DVF" },
    });

    const transactions = await searchDvfTransactions({
      latitude: lat,
      longitude: lng,
      radiusKm: parsed.data.radiusKm,
      periodYears: parsed.data.periodYears,
      propertyTypes: parsed.data.propertyTypes,
    });

    // Insérer les résultats (max 50)
    const toInsert = transactions.slice(0, 50);
    if (toInsert.length > 0) {
      await prisma.comparableSale.createMany({
        data: toInsert.map((t) => ({
          valuationId,
          source: "DVF",
          sourceReference: t.id,
          address: t.address,
          city: t.city,
          postalCode: t.postalCode,
          saleDate: new Date(t.saleDate),
          salePrice: t.salePrice,
          builtArea: t.builtArea,
          landArea: t.landArea,
          pricePerSqm: t.pricePerSqm,
          propertyType: t.propertyType,
          distanceKm: t.distanceKm,
        })),
      });
    }

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "ComparableSale",
      entityId: valuationId,
      details: { count: toInsert.length, radiusKm: parsed.data.radiusKm },
    });

    revalidatePath(`/patrimoine/immeubles/${valuation.buildingId}/valorisation`);
    return { success: true, data: { count: toInsert.length } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[searchComparables]", error);
    return { success: false, error: "Erreur lors de la recherche de comparables" };
  }
}

// ============================================================
// Mise à jour des résultats synthétiques
// ============================================================

export async function updateValuationResults(
  societyId: string,
  valuationId: string,
  input: UpdateValuationResultsInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateValuationResultsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const valuation = await prisma.propertyValuation.findFirst({
      where: { id: valuationId, societyId },
    });
    if (!valuation) return { success: false, error: "Évaluation introuvable" };

    await prisma.propertyValuation.update({
      where: { id: valuationId },
      data: parsed.data,
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "PropertyValuation",
      entityId: valuationId,
      details: { updatedFields: Object.keys(parsed.data) },
    });

    revalidatePath(`/patrimoine/immeubles/${valuation.buildingId}/valorisation`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateValuationResults]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

// ============================================================
// Lecture
// ============================================================

export async function getValuation(societyId: string, valuationId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.propertyValuation.findFirst({
    where: { id: valuationId, societyId },
    include: {
      building: { select: { id: true, name: true, addressLine1: true, city: true, postalCode: true, buildingType: true, totalArea: true } },
      aiAnalyses: { orderBy: { executedAt: "desc" } },
      expertReports: { orderBy: { reportDate: "desc" } },
      comparableSales: { orderBy: { saleDate: "desc" } },
      consolidatedReport: true,
    },
  });
}

export async function getValuations(societyId: string, buildingId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.propertyValuation.findMany({
    where: { societyId, buildingId },
    include: {
      _count: { select: { aiAnalyses: true, expertReports: true, comparableSales: true } },
    },
    orderBy: { valuationDate: "desc" },
  });
}

// ============================================================
// Suppression
// ============================================================

export async function deleteValuation(
  societyId: string,
  valuationId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const valuation = await prisma.propertyValuation.findFirst({
      where: { id: valuationId, societyId },
    });
    if (!valuation) return { success: false, error: "Évaluation introuvable" };

    await prisma.propertyValuation.delete({ where: { id: valuationId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "PropertyValuation",
      entityId: valuationId,
    });

    revalidatePath(`/patrimoine/immeubles/${valuation.buildingId}/valorisation`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteValuation]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

// ============================================================
// Helpers
// ============================================================

function average(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
