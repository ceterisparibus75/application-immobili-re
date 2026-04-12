import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import { collectTenantPaymentData, predictWithAI, calculateRiskScore, type PredictionSummary } from "@/lib/ai-prediction";
import { env } from "@/lib/env";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) {
      return NextResponse.json({ error: "Aucune société sélectionnée" }, { status: 400 });
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    // Collect payment data
    const profiles = await collectTenantPaymentData(societyId);

    // Use AI if available, otherwise rule-based
    const predictions = env.ANTHROPIC_API_KEY
      ? await predictWithAI(profiles)
      : profiles.map(calculateRiskScore);

    // Sort by risk score descending
    predictions.sort((a, b) => b.riskScore - a.riskScore);

    const summary: PredictionSummary = {
      predictions,
      generatedAt: new Date().toISOString(),
      totalTenants: predictions.length,
      highRiskCount: predictions.filter((p) => p.riskLevel === "high" || p.riskLevel === "critical").length,
      totalExposure: profiles.reduce((sum, p) => sum + p.currentDebt, 0),
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[AI Prediction]", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
