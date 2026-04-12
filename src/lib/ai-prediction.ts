import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { jsonrepair } from "jsonrepair";
import { prisma } from "@/lib/prisma";

/* ─── Types ─────────────────────────────────────────────────────── */

export interface TenantPaymentProfile {
  tenantId: string;
  tenantName: string;
  leaseId: string;
  lotLabel: string;
  monthlyRent: number;
  /** Payment history: last 12 months */
  paymentHistory: Array<{
    month: string;
    dueDate: string;
    paidDate: string | null;
    amount: number;
    daysLate: number;
    status: "on_time" | "late" | "unpaid";
  }>;
  /** Current outstanding balance */
  currentDebt: number;
  /** Lease start date */
  leaseStartDate: string;
  /** Number of late payments in last 12 months */
  latePaymentCount: number;
  /** Average days late when payment is late */
  avgDaysLate: number;
}

export interface PredictionResult {
  tenantId: string;
  tenantName: string;
  lotLabel: string;
  /** Risk score 0-100 (100 = highest risk) */
  riskScore: number;
  /** Risk level */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** Probability of default next month (0-1) */
  defaultProbability: number;
  /** Predicted days late if payment is late */
  predictedDaysLate: number;
  /** Key risk factors */
  riskFactors: string[];
  /** Recommended actions */
  recommendations: string[];
}

export interface PredictionSummary {
  predictions: PredictionResult[];
  generatedAt: string;
  totalTenants: number;
  highRiskCount: number;
  totalExposure: number;
}

/* ─── Data collection ───────────────────────────────────────────── */

export async function collectTenantPaymentData(
  societyId: string
): Promise<TenantPaymentProfile[]> {
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const leases = await prisma.lease.findMany({
    where: {
      societyId,
      status: "EN_COURS",
    },
    include: {
      tenant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          companyName: true,
          entityType: true,
        },
      },
      lot: {
        select: {
          id: true,
          number: true,
          description: true,
        },
      },
      invoices: {
        where: {
          issueDate: { gte: twelveMonthsAgo },
        },
        include: {
          payments: true,
        },
        orderBy: { issueDate: "asc" },
      },
    },
  });

  return leases.map((lease) => {
    const tenantName = lease.tenant.entityType === "PERSONNE_MORALE"
      ? (lease.tenant.companyName ?? "Société")
      : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim();

    const lotLabel = lease.lot.description || lease.lot.number;

    const paymentHistory = lease.invoices.map((inv) => {
      const totalPaid = inv.payments.reduce((sum, p) => sum + p.amount, 0);
      const lastPayment = inv.payments.length > 0
        ? inv.payments.sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())[0]
        : null;

      const dueDate = inv.dueDate;
      const paidDate = lastPayment?.paidAt ?? null;
      const daysLate = paidDate && dueDate
        ? Math.max(0, Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : (totalPaid < inv.totalTTC ? 999 : 0);

      let status: "on_time" | "late" | "unpaid" = "on_time";
      if (totalPaid < inv.totalTTC && !paidDate) {
        status = "unpaid";
      } else if (daysLate > 5) {
        status = "late";
      }

      return {
        month: inv.issueDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        dueDate: dueDate.toISOString().split("T")[0],
        paidDate: paidDate?.toISOString().split("T")[0] ?? null,
        amount: inv.totalTTC,
        daysLate,
        status,
      };
    });

    const latePayments = paymentHistory.filter((p) => p.status === "late" || p.status === "unpaid");
    const currentDebt = lease.invoices
      .filter((inv) => {
        const totalPaid = inv.payments.reduce((sum, p) => sum + p.amount, 0);
        return totalPaid < inv.totalTTC;
      })
      .reduce((sum, inv) => {
        const totalPaid = inv.payments.reduce((s, p) => s + p.amount, 0);
        return sum + (inv.totalTTC - totalPaid);
      }, 0);

    return {
      tenantId: lease.tenant.id,
      tenantName,
      leaseId: lease.id,
      lotLabel,
      monthlyRent: lease.currentRentHT ?? lease.baseRentHT,
      paymentHistory,
      currentDebt: Math.round(currentDebt * 100) / 100,
      leaseStartDate: lease.startDate.toISOString().split("T")[0],
      latePaymentCount: latePayments.length,
      avgDaysLate: latePayments.length > 0
        ? Math.round(latePayments.reduce((s, p) => s + p.daysLate, 0) / latePayments.length)
        : 0,
    };
  });
}

/* ─── Rule-based scoring (works without AI) ─────────────────────── */

export function calculateRiskScore(profile: TenantPaymentProfile): PredictionResult {
  let score = 0;
  const riskFactors: string[] = [];
  const recommendations: string[] = [];

  // Factor 1: Current debt (0-30 points)
  if (profile.currentDebt > 0) {
    const debtRatio = profile.currentDebt / Math.max(profile.monthlyRent, 1);
    if (debtRatio >= 3) {
      score += 30;
      riskFactors.push(`Dette actuelle élevée : ${profile.currentDebt.toFixed(2)} € (${debtRatio.toFixed(1)} mois de loyer)`);
      recommendations.push("Engager une procédure de mise en demeure");
    } else if (debtRatio >= 1) {
      score += 20;
      riskFactors.push(`Dette en cours : ${profile.currentDebt.toFixed(2)} € (${debtRatio.toFixed(1)} mois de loyer)`);
      recommendations.push("Envoyer une relance formelle");
    } else {
      score += 10;
      riskFactors.push(`Retard partiel : ${profile.currentDebt.toFixed(2)} €`);
      recommendations.push("Envoyer une relance amiable");
    }
  }

  // Factor 2: Late payment frequency (0-25 points)
  const totalInvoices = profile.paymentHistory.length || 1;
  const lateRatio = profile.latePaymentCount / totalInvoices;
  if (lateRatio > 0.5) {
    score += 25;
    riskFactors.push(`Retards fréquents : ${profile.latePaymentCount}/${totalInvoices} paiements en retard`);
  } else if (lateRatio > 0.25) {
    score += 15;
    riskFactors.push(`Retards occasionnels : ${profile.latePaymentCount}/${totalInvoices} paiements en retard`);
  } else if (lateRatio > 0) {
    score += 5;
    riskFactors.push(`Rares retards : ${profile.latePaymentCount} paiement(s) en retard`);
  }

  // Factor 3: Average days late (0-20 points)
  if (profile.avgDaysLate > 30) {
    score += 20;
    riskFactors.push(`Retard moyen élevé : ${profile.avgDaysLate} jours`);
  } else if (profile.avgDaysLate > 15) {
    score += 12;
    riskFactors.push(`Retard moyen modéré : ${profile.avgDaysLate} jours`);
  } else if (profile.avgDaysLate > 5) {
    score += 5;
    riskFactors.push(`Retard moyen faible : ${profile.avgDaysLate} jours`);
  }

  // Factor 4: Recent trend (0-15 points)
  const recentPayments = profile.paymentHistory.slice(-3);
  const recentLate = recentPayments.filter((p) => p.status === "late" || p.status === "unpaid").length;
  if (recentLate >= 3) {
    score += 15;
    riskFactors.push("Tendance récente : 3 retards consécutifs");
    recommendations.push("Contacter le locataire pour un plan d'apurement");
  } else if (recentLate >= 2) {
    score += 10;
    riskFactors.push("Tendance récente : retards répétés sur les 3 derniers mois");
  }

  // Factor 5: Unpaid invoices (0-10 points)
  const unpaidCount = profile.paymentHistory.filter((p) => p.status === "unpaid").length;
  if (unpaidCount > 0) {
    score += Math.min(10, unpaidCount * 5);
    riskFactors.push(`${unpaidCount} facture(s) totalement impayée(s)`);
    if (unpaidCount >= 2) {
      recommendations.push("Signaler à la CAF / Action Logement si applicable");
    }
  }

  // Clamp score
  score = Math.min(100, Math.max(0, score));

  // Determine risk level
  let riskLevel: PredictionResult["riskLevel"] = "low";
  if (score >= 70) riskLevel = "critical";
  else if (score >= 45) riskLevel = "high";
  else if (score >= 20) riskLevel = "medium";

  // Default probability based on score
  const defaultProbability = Math.min(0.95, score / 100);

  // Add general recommendations
  if (riskLevel === "low" && recommendations.length === 0) {
    recommendations.push("Aucune action nécessaire — locataire en règle");
  }

  return {
    tenantId: profile.tenantId,
    tenantName: profile.tenantName,
    lotLabel: profile.lotLabel,
    riskScore: score,
    riskLevel,
    defaultProbability: Math.round(defaultProbability * 100) / 100,
    predictedDaysLate: profile.avgDaysLate > 0 ? profile.avgDaysLate : 0,
    riskFactors,
    recommendations,
  };
}

/* ─── AI-enhanced prediction (optional) ─────────────────────────── */

export async function predictWithAI(
  profiles: TenantPaymentProfile[]
): Promise<PredictionResult[]> {
  if (!env.ANTHROPIC_API_KEY || profiles.length === 0) {
    return profiles.map(calculateRiskScore);
  }

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // Batch profiles into a single prompt (up to 20 tenants)
  const batch = profiles.slice(0, 20);
  const profilesSummary = batch.map((p, i) => {
    const history = p.paymentHistory.map((h) =>
      `  ${h.month}: ${h.status === "on_time" ? "OK" : h.status === "late" ? `retard ${h.daysLate}j` : "impayé"}`
    ).join("\n");

    return `[${i + 1}] ${p.tenantName} — ${p.lotLabel}
  Loyer: ${p.monthlyRent} €/mois | Dette: ${p.currentDebt} € | Bail depuis: ${p.leaseStartDate}
  Retards: ${p.latePaymentCount}/${p.paymentHistory.length} | Retard moyen: ${p.avgDaysLate}j
  Historique:
${history}`;
  }).join("\n\n");

  const prompt = `Analyse les profils de paiement suivants et prédit le risque d'impayé pour le mois prochain.

${profilesSummary}

Réponds avec un JSON valide : un tableau d'objets, un par locataire dans le même ordre.
Chaque objet :
{
  "riskScore": 0-100,
  "riskLevel": "low|medium|high|critical",
  "defaultProbability": 0.0-1.0,
  "predictedDaysLate": nombre,
  "riskFactors": ["facteur 1", "facteur 2"],
  "recommendations": ["recommandation 1"]
}

Règles :
- Base ton analyse sur les tendances de paiement, pas seulement l'historique récent.
- Considère les patterns saisonniers si visibles.
- Les recommandations doivent être concrètes et adaptées au droit français.
- Réponds UNIQUEMENT avec le tableau JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: "Tu es un analyste financier spécialisé en gestion locative française. Tu analyses les historiques de paiement pour prédire les risques d'impayés. Réponds uniquement en JSON valide.",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content.find((b) => b.type === "text")?.text ?? "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonrepair(jsonMatch?.[0] ?? "[]")) as Array<Partial<PredictionResult>>;

    return batch.map((profile, i) => {
      const aiResult = parsed[i];
      const fallback = calculateRiskScore(profile);

      if (!aiResult) return fallback;

      return {
        tenantId: profile.tenantId,
        tenantName: profile.tenantName,
        lotLabel: profile.lotLabel,
        riskScore: typeof aiResult.riskScore === "number" ? aiResult.riskScore : fallback.riskScore,
        riskLevel: (["low", "medium", "high", "critical"].includes(aiResult.riskLevel ?? "")
          ? aiResult.riskLevel
          : fallback.riskLevel) as PredictionResult["riskLevel"],
        defaultProbability: typeof aiResult.defaultProbability === "number"
          ? aiResult.defaultProbability
          : fallback.defaultProbability,
        predictedDaysLate: typeof aiResult.predictedDaysLate === "number"
          ? aiResult.predictedDaysLate
          : fallback.predictedDaysLate,
        riskFactors: Array.isArray(aiResult.riskFactors) ? aiResult.riskFactors : fallback.riskFactors,
        recommendations: Array.isArray(aiResult.recommendations) ? aiResult.recommendations : fallback.recommendations,
      };
    });
  } catch (error) {
    console.error("[AI Prediction] Falling back to rule-based scoring:", error);
    return profiles.map(calculateRiskScore);
  }
}
