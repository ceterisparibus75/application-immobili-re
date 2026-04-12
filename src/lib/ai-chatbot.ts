import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/* ─── Types ─────────────────────────────────────────────────────── */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  societyName: string;
  userName: string;
  /** Optional tenant/building/lease context for scoped questions */
  scope?: {
    buildings?: Array<{ name: string; address: string; lotsCount: number }>;
    tenants?: Array<{ name: string; unpaidAmount: number }>;
    leases?: Array<{ tenant: string; lot: string; rent: number; status: string }>;
    recentActivity?: string[];
  };
}

/* ─── System prompt ─────────────────────────────────────────────── */

function buildSystemPrompt(ctx: ChatContext): string {
  const parts: string[] = [
    `Tu es l'assistant IA de MyGestia, un logiciel de gestion immobilière SaaS français.`,
    `Tu assistes ${ctx.userName} de la société "${ctx.societyName}".`,
    `Réponds toujours en français, de façon concise et professionnelle.`,
    ``,
    `Tu peux aider sur :`,
    `- Questions sur la gestion locative (baux, loyers, charges, régularisation)`,
    `- Réglementation immobilière française (loi du 6 juillet 1989, loi ALUR, etc.)`,
    `- Conseils sur les procédures (mise en demeure, congé, renouvellement)`,
    `- Explication des indices (IRL, ILC, ILAT, ICC)`,
    `- Fiscalité immobilière (revenus fonciers, LMNP, SCI)`,
    `- Diagnostics obligatoires (DPE, amiante, plomb, etc.)`,
    `- Copropriété (charges, assemblées générales, tantièmes)`,
    ``,
    `Règles :`,
    `- Ne donne jamais de conseils juridiques définitifs — recommande de consulter un professionnel pour les cas complexes.`,
    `- Si tu ne sais pas, dis-le clairement.`,
    `- Utilise des montants en euros et des dates au format français.`,
    `- Cite les articles de loi quand c'est pertinent.`,
  ];

  if (ctx.scope) {
    parts.push("", "--- Contexte de la société ---");
    if (ctx.scope.buildings?.length) {
      parts.push(`Immeubles : ${ctx.scope.buildings.map((b) => `${b.name} (${b.address}, ${b.lotsCount} lots)`).join("; ")}`);
    }
    if (ctx.scope.tenants?.length) {
      parts.push(`Locataires avec impayés : ${ctx.scope.tenants.map((t) => `${t.name}: ${t.unpaidAmount} €`).join("; ")}`);
    }
    if (ctx.scope.leases?.length) {
      parts.push(`Baux actifs : ${ctx.scope.leases.map((l) => `${l.tenant} — ${l.lot} — ${l.rent} €/mois (${l.status})`).join("; ")}`);
    }
    if (ctx.scope.recentActivity?.length) {
      parts.push(`Activité récente : ${ctx.scope.recentActivity.join("; ")}`);
    }
  }

  return parts.join("\n");
}

/* ─── Chat function ─────────────────────────────────────────────── */

export async function chatWithAssistant(
  messages: ChatMessage[],
  context: ChatContext
): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY non configurée. L'assistant IA n'est pas disponible.");
  }

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: buildSystemPrompt(context),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  return response.content.find((b) => b.type === "text")?.text
    ?? "Désolé, je n'ai pas pu traiter votre demande.";
}
