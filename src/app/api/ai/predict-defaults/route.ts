import { NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { collectTenantPaymentData, predictWithAI, calculateRiskScore, type PredictionSummary } from "@/lib/ai-prediction";
import { env } from "@/lib/env";

export async function GET() {
  try {
    const context = await requireActiveSocietyRouteContext({ minRole: "GESTIONNAIRE" });
    if (context instanceof NextResponse) return context;

    // Collect payment data
    const profiles = await collectTenantPaymentData(context.societyId);

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
    return NextResponse.json({ error: "Erreur lors de l'analyse prédictive" }, { status: 500 });
  }
}
