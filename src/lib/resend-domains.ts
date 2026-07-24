import { Resend } from "resend";
import { env } from "@/lib/env";

/**
 * Wrapper minimal autour de l'API Resend Domains.
 *
 * Chaque société peut vérifier son propre domaine d'envoi (SPF/DKIM)
 * pour que `from` = `contact@masociete.fr` au lieu du fallback global
 * `noreply@mygestia.immo`. La vérification passe par des enregistrements
 * DNS que le client doit ajouter chez son registrar.
 */

export type ResendDomainRecord = {
  record: string; // "SPF" | "DKIM" | "Tracking" | "DMARC"
  name: string; // Nom d'hôte à créer (relatif au domaine)
  type: "MX" | "TXT" | "CNAME";
  value: string;
  ttl?: string | number;
  priority?: number;
  status?: string;
};

export type ResendDomainDetails = {
  id: string;
  name: string;
  status: string; // "not_started" | "pending" | "verified" | "failed" | "temporary_failure"
  createdAt?: string;
  region?: string;
  records: ResendDomainRecord[];
};

function client(): Resend {
  return new Resend(env.RESEND_API_KEY ?? "");
}

export function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

function normalizeRecords(raw: unknown): ResendDomainRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      record: typeof r.record === "string" ? r.record : "Unknown",
      name: typeof r.name === "string" ? r.name : "",
      type:
        r.type === "MX" || r.type === "TXT" || r.type === "CNAME"
          ? r.type
          : "TXT",
      value: typeof r.value === "string" ? r.value : "",
      ttl: typeof r.ttl === "string" || typeof r.ttl === "number" ? r.ttl : "Auto",
      ...(typeof r.priority === "number" ? { priority: r.priority } : {}),
      ...(typeof r.status === "string" ? { status: r.status } : {}),
    }));
}

function normalizeDomain(raw: unknown): ResendDomainDetails | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || typeof obj.name !== "string") return null;
  return {
    id: obj.id,
    name: obj.name,
    status: typeof obj.status === "string" ? obj.status : "not_started",
    createdAt: typeof obj.created_at === "string" ? obj.created_at : undefined,
    region: typeof obj.region === "string" ? obj.region : undefined,
    records: normalizeRecords(obj.records),
  };
}

export async function createResendDomain(domain: string): Promise<ResendDomainDetails> {
  if (!isResendConfigured()) throw new Error("RESEND_API_KEY manquant");
  const { data, error } = await client().domains.create({ name: domain });
  if (error) throw new Error(`Resend: ${error.message}`);
  const normalized = normalizeDomain(data);
  if (!normalized) throw new Error("Réponse Resend inattendue lors de la création du domaine");
  return normalized;
}

export async function getResendDomain(domainId: string): Promise<ResendDomainDetails> {
  if (!isResendConfigured()) throw new Error("RESEND_API_KEY manquant");
  const { data, error } = await client().domains.get(domainId);
  if (error) throw new Error(`Resend: ${error.message}`);
  const normalized = normalizeDomain(data);
  if (!normalized) throw new Error("Réponse Resend inattendue lors de la récupération du domaine");
  return normalized;
}

export async function verifyResendDomain(domainId: string): Promise<{ id: string }> {
  if (!isResendConfigured()) throw new Error("RESEND_API_KEY manquant");
  const { data, error } = await client().domains.verify(domainId);
  if (error) throw new Error(`Resend: ${error.message}`);
  const obj = (data ?? {}) as Record<string, unknown>;
  return { id: typeof obj.id === "string" ? obj.id : domainId };
}

export async function deleteResendDomain(domainId: string): Promise<void> {
  if (!isResendConfigured()) throw new Error("RESEND_API_KEY manquant");
  const { error } = await client().domains.remove(domainId);
  if (error) throw new Error(`Resend: ${error.message}`);
}

/** Extrait le domaine (right side of @) d'une adresse email. */
export function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}
