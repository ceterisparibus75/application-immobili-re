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
