import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORY_HINTS: Record<string, string> = {
  bail: "Extrais : loyer mensuel (nombre), charges (nombre), date debut bail, date fin bail, type bail (meuble/non meuble), surface (m2), depot garantie.",
  avenant: "Extrais : type modification, nouvelle valeur, date effet.",
  quittance: "Extrais : periode (mois/annee), montant loyer, montant charges, total, nom locataire.",
  facture: "Extrais : montant HT, TVA, montant TTC, fournisseur, date, numero facture.",
  diagnostic: "Extrais : type diagnostic (DPE/amiante/plomb/etc), classe ou resultat, date realisation, date expiration.",
  assurance: "Extrais : compagnie, numero police, date debut, date fin, montant garantie, bien assure.",
  titre_propriete: "Extrais : adresse bien, surface, prix acquisition, date acte, notaire.",
  contrat: "Extrais : type contrat, prestataire, montant, date debut, date fin, objet.",
  etat_des_lieux: "Extrais : type (entree/sortie), date, adresse, nom locataire, observations principales.",
};

function mediaType(mime: string): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" {
  if (mime === "application/pdf") return "application/pdf";
  if (mime === "image/png") return "image/png";
  if (mime === "image/webp") return "image/webp";
  return "image/jpeg";
}

function buildContentBlock(fileBuffer: Buffer, mime: string) {
  const b64 = fileBuffer.toString("base64");
  const mt = mediaType(mime);
  if (mt === "application/pdf") {
    return { type: "document" as const, source: { type: "base64" as const, media_type: mt, data: b64 } };
  }
  return { type: "image" as const, source: { type: "base64" as const, media_type: mt, data: b64 } };
}

// Analyse complete d un document
export async function analyzeDocument(
  fileBuffer: Buffer,
  mimeType: string,
  category: string | null
): Promise<{ summary: string; tags: string[]; metadata: Record<string, unknown> }> {
  const categoryHint = category ? (CATEGORY_HINTS[category] ?? "") : "";

  const prompt = `Tu es un expert en gestion immobiliere francaise. Analyse ce document et reponds en JSON valide uniquement.

${categoryHint ? `Ce document est de categorie "${category}". ${categoryHint}` : "Identifie le type de document."}

Reponds avec ce JSON (et rien d autre) :
{
  "summary": "Resume concis du document en 2-3 phrases maximum",
  "tags": ["tag1", "tag2", "tag3"],
  "metadata": {
    "cle": "valeur"
  }
}

Pour les tags : utilise des mots cles courts et pertinents (categorie, type, annee, entite concernee).
Pour metadata : inclus uniquement les informations cles extraites du document (dates, montants, noms importants).
Si une information n est pas dans le document, ne l inclus pas.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          buildContentBlock(fileBuffer, mimeType),
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const raw = response.content.find((b) => b.type === "text")?.text ?? "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonrepair(jsonMatch?.[0] ?? "{}")) as {
    summary?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  };

  return {
    summary: parsed.summary ?? "Analyse non disponible",
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10) : [],
    metadata: parsed.metadata ?? {},
  };
}

// Chat avec un document
export async function chatWithDocument(
  fileBuffer: Buffer,
  mimeType: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const apiMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.role === "user" && messages.indexOf(m) === 0
      ? [
          buildContentBlock(fileBuffer, mimeType),
          { type: "text" as const, text: m.content },
        ]
      : m.content,
  }));

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: "Tu es un assistant specialise en gestion immobiliere francaise. Reponds en francais, de facon concise et precise, en te basant uniquement sur le contenu du document fourni.",
    messages: apiMessages,
  });

  return response.content.find((b) => b.type === "text")?.text ?? "Je n'ai pas pu analyser ce document.";
}
