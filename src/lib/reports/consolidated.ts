import { PDFDocument } from "pdf-lib";
import { generateReport } from "./index";
import type { ReportType, ReportResult } from "./types";

/** Labels pour les types de rapports */
const REPORT_LABELS: Record<string, string> = {
  SITUATION_LOCATIVE: "Situation locative",
  COMPTE_RENDU_GESTION: "Compte-rendu de gestion",
  ETAT_IMPAYES: "État des impayés",
  BALANCE_AGEE: "Balance âgée",
  SUIVI_MENSUEL: "Suivi mensuel",
  VACANCE_LOCATIVE: "Vacance locative",
};

export function getReportLabel(type: string): string {
  return REPORT_LABELS[type] ?? type;
}

/** Labels pour les fréquences */
const FREQUENCY_LABELS: Record<string, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};

export function getFrequencyLabel(frequency: string): string {
  return FREQUENCY_LABELS[frequency] ?? frequency;
}

/**
 * Génère un rapport consolidé en fusionnant plusieurs rapports PDF en un seul document.
 * Les rapports XLSX sont ignorés (seuls les PDF sont fusionnables).
 */
export async function generateConsolidatedReport(
  societyId: string,
  reportTypes: string[],
  year?: number
): Promise<ReportResult> {
  const mergedPdf = await PDFDocument.create();

  for (const type of reportTypes) {
    try {
      const result = await generateReport({
        societyId,
        type: type as ReportType,
        year,
        format: "pdf",
      });

      // Fusionner les pages du rapport dans le document consolidé
      const sourcePdf = await PDFDocument.load(result.buffer);
      const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    } catch (error) {
      console.error(`[consolidated] Erreur génération ${type}:`, error);
      // Continue avec les autres rapports même si l'un échoue
    }
  }

  if (mergedPdf.getPageCount() === 0) {
    throw new Error("Aucun rapport n'a pu être généré");
  }

  const ds = new Date().toISOString().slice(0, 10);
  const buffer = Buffer.from(await mergedPdf.save());

  return {
    buffer,
    filename: `rapport-consolide-${ds}.pdf`,
    contentType: "application/pdf",
  };
}

/**
 * Calcule la prochaine date d'exécution selon la fréquence.
 */
export function computeNextRunAt(frequency: string, fromDate?: Date): Date {
  const now = fromDate ?? new Date();
  const next = new Date(now);

  switch (frequency) {
    case "MENSUEL":
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      break;
    case "TRIMESTRIEL":
      // Prochain début de trimestre (jan, avr, jul, oct)
      next.setMonth(next.getMonth() + 3 - (next.getMonth() % 3));
      next.setDate(1);
      break;
    case "SEMESTRIEL":
      // Prochain début de semestre (jan, jul)
      next.setMonth(next.getMonth() + 6 - (next.getMonth() % 6));
      next.setDate(1);
      break;
    case "ANNUEL":
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth(0);
      next.setDate(1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
  }

  // Envoi à 8h00 UTC
  next.setHours(8, 0, 0, 0);
  return next;
}

/**
 * Détermine l'année du rapport à générer selon la fréquence et la date d'exécution.
 * Pour les rapports mensuels/trimestriels, c'est l'année en cours.
 * Pour les annuels, c'est l'année précédente (bilan de l'exercice écoulé).
 */
export function computeReportYear(frequency: string): number {
  const now = new Date();
  if (frequency === "ANNUEL" && now.getMonth() === 0) {
    return now.getFullYear() - 1;
  }
  return now.getFullYear();
}
