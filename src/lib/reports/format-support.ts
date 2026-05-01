import type { ReportType } from "./types";

export const PDF_ONLY_REPORT_TYPES = [
  "SITUATION_LOCATIVE",
  "COMPTE_RENDU_GESTION",
  "RECAP_CHARGES_LOCATAIRE",
  "BALANCE_AGEE",
  "SUIVI_MENSUEL",
  "VACANCE_LOCATIVE",
] as const satisfies readonly ReportType[];

export const XLSX_ONLY_REPORT_TYPES = [
  "RENTABILITE_LOT",
  "SUIVI_TRAVAUX",
] as const satisfies readonly ReportType[];

export const BOTH_FORMAT_REPORT_TYPES = [
  "ETAT_IMPAYES",
] as const satisfies readonly ReportType[];

export const PDF_COMPATIBLE_REPORT_TYPES = [
  ...PDF_ONLY_REPORT_TYPES,
  ...BOTH_FORMAT_REPORT_TYPES,
] as const satisfies readonly ReportType[];

export function isPdfCompatibleReportType(type: string): type is ReportType {
  return (PDF_COMPATIBLE_REPORT_TYPES as readonly string[]).includes(type);
}
