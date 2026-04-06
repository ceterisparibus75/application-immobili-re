export type ReportType =
  | "SITUATION_LOCATIVE"
  | "COMPTE_RENDU_GESTION"
  | "RENTABILITE_LOT"
  | "ETAT_IMPAYES"
  | "RECAP_CHARGES_LOCATAIRE"
  | "SUIVI_TRAVAUX"
  | "BALANCE_AGEE"
  | "SUIVI_MENSUEL"
  | "VACANCE_LOCATIVE";

export interface ReportSociety {
  name: string;
  logoBase64?: string | null;
  siret?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ReportOptions {
  societyId: string;
  type: ReportType;
  year?: number;
  buildingId?: string;
  tenantId?: string;
  format?: "pdf" | "xlsx";
  society?: ReportSociety | null;
}

export interface ReportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export type ColAlign = "left" | "right" | "center";
