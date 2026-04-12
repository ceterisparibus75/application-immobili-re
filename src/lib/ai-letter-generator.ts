import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { jsonrepair } from "jsonrepair";

/* ─── Types ─────────────────────────────────────────────────────── */

export interface LetterGenerationInput {
  /** Type of letter to generate */
  letterType: string;
  /** Free-text description of what the letter should cover */
  description: string;
  /** Context data for the letter */
  context: {
    bailleurNom: string;
    bailleurAdresse: string;
    locataireNom?: string;
    locataireAdresse?: string;
    bienAdresse?: string;
    loyerMontant?: number;
    chargesMontant?: number;
    dateDebutBail?: string;
    dateFinBail?: string;
    montantImpayes?: number;
    periodesImpayees?: string;
    /** Any additional context the user provides */
    extra?: string;
  };
}

export interface GeneratedLetter {
  subject: string;
  bodyHtml: string;
  legalReferences: string[];
  tone: "amiable" | "ferme" | "formel" | "urgent";
  summary: string;
}

/* ─── Prompt ────────────────────────────────────────────────────── */

function buildLetterPrompt(input: LetterGenerationInput): string {
  const ctx = input.context;
  const parts: string[] = [
    `Génère un courrier professionnel de type "${input.letterType}" pour la gestion immobilière.`,
    ``,
    `Description de la demande : ${input.description}`,
    ``,
    `Informations disponibles :`,
    `- Bailleur : ${ctx.bailleurNom}, ${ctx.bailleurAdresse}`,
  ];

  if (ctx.locataireNom) parts.push(`- Locataire : ${ctx.locataireNom}${ctx.locataireAdresse ? `, ${ctx.locataireAdresse}` : ""}`);
  if (ctx.bienAdresse) parts.push(`- Adresse du bien : ${ctx.bienAdresse}`);
  if (ctx.loyerMontant) parts.push(`- Loyer mensuel : ${ctx.loyerMontant} €`);
  if (ctx.chargesMontant) parts.push(`- Charges mensuelles : ${ctx.chargesMontant} €`);
  if (ctx.dateDebutBail) parts.push(`- Début du bail : ${ctx.dateDebutBail}`);
  if (ctx.dateFinBail) parts.push(`- Fin du bail : ${ctx.dateFinBail}`);
  if (ctx.montantImpayes) parts.push(`- Montant impayé : ${ctx.montantImpayes} €`);
  if (ctx.periodesImpayees) parts.push(`- Périodes impayées : ${ctx.periodesImpayees}`);
  if (ctx.extra) parts.push(`- Informations complémentaires : ${ctx.extra}`);

  parts.push(
    ``,
    `Réponds UNIQUEMENT avec un JSON valide dans ce format exact :`,
    `{`,
    `  "subject": "Objet du courrier",`,
    `  "bodyHtml": "<p>Corps du courrier en HTML avec balises <p>, <ul>, <li>, <strong>. Inclure les formules de politesse d'usage.</p>",`,
    `  "legalReferences": ["Article X de la loi Y"],`,
    `  "tone": "amiable|ferme|formel|urgent",`,
    `  "summary": "Résumé en une phrase du courrier généré"`,
    `}`,
    ``,
    `Règles :`,
    `- Le courrier doit être conforme au droit immobilier français.`,
    `- Utilise un français soutenu et professionnel.`,
    `- Cite les articles de loi pertinents.`,
    `- Inclus la date du jour (${new Date().toLocaleDateString("fr-FR")}).`,
    `- Si des informations manquent, utilise des placeholders entre crochets [information manquante].`,
    `- Le bodyHtml doit être du HTML valide prêt à être rendu.`,
  );

  return parts.join("\n");
}

/* ─── Generation function ───────────────────────────────────────── */

export async function generateLetter(input: LetterGenerationInput): Promise<GeneratedLetter> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY non configurée. La génération de courriers IA n'est pas disponible.");
  }

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: "Tu es un expert en rédaction de courriers juridiques pour la gestion immobilière en France. Tu connais parfaitement la loi du 6 juillet 1989, la loi ALUR, et toute la réglementation locative française. Réponds uniquement en JSON valide.",
    messages: [
      { role: "user", content: buildLetterPrompt(input) },
    ],
  });

  const raw = response.content.find((b) => b.type === "text")?.text ?? "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonrepair(jsonMatch?.[0] ?? "{}")) as Partial<GeneratedLetter>;

  return {
    subject: parsed.subject ?? "Courrier",
    bodyHtml: parsed.bodyHtml ?? "<p>Le courrier n'a pas pu être généré.</p>",
    legalReferences: Array.isArray(parsed.legalReferences) ? parsed.legalReferences : [],
    tone: (["amiable", "ferme", "formel", "urgent"].includes(parsed.tone ?? "") ? parsed.tone : "formel") as GeneratedLetter["tone"],
    summary: parsed.summary ?? "",
  };
}
