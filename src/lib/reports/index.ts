import { prisma } from "@/lib/prisma";
import { generateReportSchema } from "@/validations/report";
import type { ReportOptions, ReportResult } from "./types";
export type { ReportType, ReportOptions, ReportResult, ReportSociety } from "./types";

import { generateSituationLocative } from "./generators/situation-locative";
import { generateCompteRenduGestion } from "./generators/compte-rendu-gestion";
import { generateRentabiliteLot } from "./generators/rentabilite-lot";
import { generateEtatImpayes } from "./generators/etat-impayes";
import { generateRecapChargesLocataire } from "./generators/recap-charges-locataire";
import { generateSuiviTravaux } from "./generators/suivi-travaux";
import { generateBalanceAgee } from "./generators/balance-agee";
import { generateSuiviMensuel } from "./generators/suivi-mensuel";
import { generateVacanceLocative } from "./generators/vacance-locative";

export async function generateReport(options: ReportOptions): Promise<ReportResult> {
  try {
    const parsed = generateReportSchema.safeParse({
      type: options.type,
      year: options.year,
      buildingId: options.buildingId,
      tenantId: options.tenantId,
      format: options.format ?? "pdf",
    });
    if (!parsed.success) {
      throw new Error(parsed.error.errors.map((issue) => issue.message).join(", "));
    }

    const reportOptions: ReportOptions = {
      ...options,
      ...parsed.data,
    };

    // Fetch society data for white-label branding
    if (!reportOptions.society) {
      const societyData = await prisma.society.findUnique({
        where: { id: reportOptions.societyId },
        select: { name: true, siret: true, addressLine1: true, city: true, postalCode: true },
      });
      if (societyData) {
        reportOptions.society = societyData;
      }
    }

    switch (reportOptions.type) {
      case "SITUATION_LOCATIVE":      return await generateSituationLocative(reportOptions);
      case "COMPTE_RENDU_GESTION":    return await generateCompteRenduGestion(reportOptions);
      case "RENTABILITE_LOT":         return await generateRentabiliteLot(reportOptions);
      case "ETAT_IMPAYES":            return await generateEtatImpayes(reportOptions);
      case "RECAP_CHARGES_LOCATAIRE": return await generateRecapChargesLocataire(reportOptions);
      case "SUIVI_TRAVAUX":           return await generateSuiviTravaux(reportOptions);
      case "BALANCE_AGEE":            return await generateBalanceAgee(reportOptions);
      case "SUIVI_MENSUEL":           return await generateSuiviMensuel(reportOptions);
      case "VACANCE_LOCATIVE":        return await generateVacanceLocative(reportOptions);
      default: throw new Error("Type de rapport inconnu");
    }
  } catch (error) {
    if (error instanceof Error && /introuvable|requis|invalide|format|PDF|Excel|année/i.test(error.message)) {
      throw error;
    }
    console.error(`[generateReport] Erreur lors de la generation du rapport ${options.type}:`, error);
    throw new Error("Erreur lors de la generation du rapport. Veuillez reessayer.");
  }
}
