import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un montant en euros.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Formate une date en format français.
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Formate une date avec l'heure.
 */
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Convertit une logoUrl (chemin de stockage ou URL Supabase complète)
 * en URL proxy qui génère une URL signée fraîche à chaque affichage.
 * Gère les cas : chemin seul, URL signée Supabase, URL publique Supabase.
 */
/**
 * Regroupe des noms de prêteurs qui désignent le même établissement.
 * Ex : "LCL - Crédit Lyonnais", "Crédit Lyonnais (LCL)", "LCL" → même groupe.
 * Retourne un Map : nom original → nom canonique (le plus complet).
 */
export function buildLenderMapping(names: string[]): Map<string, string> {
  const tokenize = (name: string): Set<string> => {
    const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const tokens = n.replace(/[^a-z0-9]/g, " ").split(/\s+/).filter((t) => t.length > 1);
    const noise = new Set(["de", "du", "la", "le", "les", "des", "et"]);
    return new Set(tokens.filter((t) => !noise.has(t)));
  };

  const unique = [...new Set(names)];
  const entries = unique.map((name) => ({ name, tokens: tokenize(name) }));
  entries.sort((a, b) => b.tokens.size - a.tokens.size);

  const groups: { canonical: string; tokens: Set<string>; names: Set<string> }[] = [];

  for (const entry of entries) {
    let matched = false;
    for (const group of groups) {
      const entryInGroup = [...entry.tokens].every((t) => group.tokens.has(t));
      const groupInEntry = [...group.tokens].every((t) => entry.tokens.has(t));
      if (entryInGroup || groupInEntry) {
        group.names.add(entry.name);
        for (const t of entry.tokens) group.tokens.add(t);
        matched = true;
        break;
      }
    }
    if (!matched) {
      groups.push({ canonical: entry.name, tokens: new Set(entry.tokens), names: new Set([entry.name]) });
    }
  }

  const mapping = new Map<string, string>();
  for (const group of groups) {
    for (const name of group.names) {
      mapping.set(name, group.canonical);
    }
  }
  return mapping;
}

export function getLogoProxyUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  // Chemin relatif → proxifier directement
  if (!logoUrl.startsWith("http")) {
    return `/api/storage/view?path=${encodeURIComponent(logoUrl)}`;
  }
  // URL Supabase (signée upload, signée download, ou publique) → extraire le chemin et proxifier
  const match = logoUrl.match(/\/storage\/v1\/object\/(?:upload\/sign\/|sign\/|public\/)[^/]+\/(.+?)(?:\?|$)/);
  if (match) {
    return `/api/storage/view?path=${encodeURIComponent(match[1])}`;
  }
  return logoUrl;
}
