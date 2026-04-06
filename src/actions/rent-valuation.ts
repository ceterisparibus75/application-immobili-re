"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { checkSubscriptionActive } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  createRentValuationSchema,
  runRentAiAnalysisSchema,
  searchComparableRentsSchema,
  type CreateRentValuationInput,
  type RunRentAiAnalysisInput,
  type SearchComparableRentsInput,
} from "@/validations/valuation";
import { collectLeaseData } from "@/lib/valuation/data-collector";
import { searchDvfTransactions } from "@/lib/valuation/dvf-service";
import { callClaudeRentValuation, callGeminiRentValuation } from "@/lib/valuation/ai-service";
import type { AiRentValuationResult } from "@/lib/valuation/types";

// ============================================================
// Création d'une évaluation de loyer
// ============================================================

export async function createRentValuation(
  societyId: string,
  input: CreateRentValuationInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };

    const parsed = createRentValuationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const lease = await prisma.lease.findFirst({
      where: { id: parsed.data.leaseId, societyId },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };

    const valuation = await prisma.rentValuation.create({
      data: {
        leaseId: parsed.data.leaseId,
        societyId,
        createdBy: session.user.id,
        status: "DRAFT",
        currentRent: lease.currentRentHT,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "RentValuation",
      entityId: valuation.id,
      details: { leaseId: lease.id },
    });

    revalidatePath(`/baux/${lease.id}`);
    return { success: true, data: { id: valuation.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createRentValuation]", error);
    return { success: false, error: "Erreur lors de la création de l'évaluation de loyer" };
  }
}

// ============================================================
// Lancer les analyses IA de loyer
// ============================================================

export async function runRentAiAnalysis(
  societyId: string,
  rentValuationId: string,
  input: RunRentAiAnalysisInput
): Promise<ActionResult<{ analysisCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = runRentAiAnalysisSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const valuation = await prisma.rentValuation.findFirst({
      where: { id: rentValuationId, societyId },
    });
    if (!valuation) return { success: false, error: "Évaluation introuvable" };

    await prisma.rentValuation.update({
      where: { id: rentValuationId },
      data: { status: "IN_PROGRESS" },
    });

    const leaseData = await collectLeaseData(societyId, valuation.leaseId);

    // Lancer les analyses en parallèle
    const providers = parsed.data.providers;
    const promises: Promise<{ provider: "CLAUDE" | "GEMINI"; result: AiRentValuationResult; rawResponse: string; durationMs: number; tokenCount: number }>[] = [];

    if (providers.includes("CLAUDE")) {
      promises.push(
        callClaudeRentValuation(leaseData).then((r) => ({ provider: "CLAUDE" as const, ...r }))
      );
    }
    if (providers.includes("GEMINI")) {
      promises.push(
        callGeminiRentValuation(leaseData).then((r) => ({ provider: "GEMINI" as const, ...r }))
      );
    }

    const results = await Promise.allSettled(promises);
    let analysisCount = 0;

    for (const settled of results) {
      if (settled.status === "fulfilled") {
        const { provider, result, rawResponse, durationMs, tokenCount } = settled.value;
        await prisma.rentAiAnalysis.create({
          data: {
            rentValuationId,
            provider,
            modelVersion: provider === "CLAUDE" ? "claude-sonnet-4-20250514" : "gemini-2.5-flash",
            inputPayload: leaseData as object,
            rawResponse,
            structuredResult: result as object,
            estimatedRent: result.summary.estimatedMarketRent,
            rentPerSqm: result.summary.rentPerSqm,
            methodology: result.methodology.comparisonMethod.applied
              ? "Comparaison"
              : result.methodology.incomeMethod.applied
                ? "Rendement"
                : null,
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
        console.error("[runRentAiAnalysis] Provider failed:", settled.reason);
      }
    }

    // Mettre à jour les valeurs synthétiques
    if (analysisCount > 0) {
      const analyses = await prisma.rentAiAnalysis.findMany({
        where: { rentValuationId },
        select: { estimatedRent: true, rentPerSqm: true },
      });

      const rents = analyses.filter((a) => a.estimatedRent != null).map((a) => a.estimatedRent!);
      if (rents.length > 0) {
        const avgRent = rents.reduce((a, b) => a + b, 0) / rents.length;
        const currentRent = valuation.currentRent ?? 0;
        const deviation = currentRent > 0 ? ((avgRent - currentRent) / currentRent) * 100 : 0;

        await prisma.rentValuation.update({
          where: { id: rentValuationId },
          data: {
            status: "COMPLETED",
            estimatedMarketRent: avgRent,
            estimatedRentLow: Math.min(...rents),
            estimatedRentHigh: Math.max(...rents),
            rentPerSqm: average(analyses.map((a) => a.rentPerSqm)),
            deviationPercent: Math.round(deviation * 100) / 100,
          },
        });
      }
    }

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "RentAiAnalysis",
      entityId: rentValuationId,
      details: { providers: parsed.data.providers, analysisCount },
    });

    revalidatePath(`/baux/${valuation.leaseId}`);
    return { success: true, data: { analysisCount } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[runRentAiAnalysis]", error);
    return { success: false, error: "Erreur lors de l'analyse IA des loyers" };
  }
}

// ============================================================
// Recherche de loyers comparables
// ============================================================

export async function searchComparableRents(
  societyId: string,
  rentValuationId: string,
  input: SearchComparableRentsInput
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = searchComparableRentsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const valuation = await prisma.rentValuation.findFirst({
      where: { id: rentValuationId, societyId },
      include: {
        lease: {
          include: {
            lot: {
              include: {
                building: { select: { latitude: true, longitude: true } },
              },
            },
          },
        },
      },
    });
    if (!valuation) return { success: false, error: "Évaluation introuvable" };

    const lat = valuation.lease.lot.building.latitude;
    const lng = valuation.lease.lot.building.longitude;

    if (!lat || !lng) {
      return { success: false, error: "Coordonnées GPS de l'immeuble manquantes." };
    }

    // Supprimer les anciens comparables DVF
    await prisma.comparableRent.deleteMany({
      where: { rentValuationId, source: "DVF" },
    });

    // Utiliser les transactions DVF comme proxy pour les loyers comparables
    const transactions = await searchDvfTransactions({
      latitude: lat,
      longitude: lng,
      radiusKm: parsed.data.radiusKm,
      periodYears: parsed.data.periodYears,
      propertyTypes: parsed.data.propertyTypes,
    });

    // Estimer un loyer annuel à partir du prix de vente (taux de rendement moyen 5-7%)
    const ESTIMATED_YIELD = 0.06;
    const toInsert = transactions.slice(0, 30);

    if (toInsert.length > 0) {
      await prisma.comparableRent.createMany({
        data: toInsert.map((t) => ({
          rentValuationId,
          source: "DVF",
          sourceReference: t.id,
          address: t.address,
          city: t.city,
          postalCode: t.postalCode,
          rentDate: new Date(t.saleDate),
          annualRent: t.salePrice * ESTIMATED_YIELD,
          area: t.builtArea,
          rentPerSqm: t.builtArea && t.builtArea > 0
            ? (t.salePrice * ESTIMATED_YIELD) / t.builtArea
            : null,
          propertyType: t.propertyType,
          distanceKm: t.distanceKm,
        })),
      });
    }

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "ComparableRent",
      entityId: rentValuationId,
      details: { count: toInsert.length },
    });

    revalidatePath(`/baux/${valuation.leaseId}`);
    return { success: true, data: { count: toInsert.length } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[searchComparableRents]", error);
    return { success: false, error: "Erreur lors de la recherche de comparables" };
  }
}

// ============================================================
// Lecture
// ============================================================

export async function getRentValuation(societyId: string, rentValuationId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.rentValuation.findFirst({
    where: { id: rentValuationId, societyId },
    include: {
      lease: {
        include: {
          lot: {
            include: {
              building: { select: { id: true, name: true, addressLine1: true, city: true } },
            },
          },
          tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
        },
      },
      aiAnalyses: { orderBy: { executedAt: "desc" } },
      comparableRents: { orderBy: { rentDate: "desc" } },
      consolidatedReport: true,
    },
  });
}

export async function getRentValuations(societyId: string, leaseId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.rentValuation.findMany({
    where: { societyId, leaseId },
    include: {
      _count: { select: { aiAnalyses: true, comparableRents: true } },
    },
    orderBy: { valuationDate: "desc" },
  });
}

// ============================================================
// Suppression
// ============================================================

export async function deleteRentValuation(
  societyId: string,
  rentValuationId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const valuation = await prisma.rentValuation.findFirst({
      where: { id: rentValuationId, societyId },
    });
    if (!valuation) return { success: false, error: "Évaluation introuvable" };

    await prisma.rentValuation.delete({ where: { id: rentValuationId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "RentValuation",
      entityId: rentValuationId,
    });

    revalidatePath(`/baux/${valuation.leaseId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteRentValuation]", error);
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
