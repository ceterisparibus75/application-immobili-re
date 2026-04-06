import { prisma } from "@/lib/prisma";
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
    // Fetch society data for white-label branding
    if (!options.society) {
      const societyData = await prisma.society.findUnique({
        where: { id: options.societyId },
        select: { name: true, siret: true, addressLine1: true, city: true, postalCode: true },
      });
      if (societyData) {
        options.society = societyData;
      }
    }

    switch (options.type) {
      case "SITUATION_LOCATIVE":      return await generateSituationLocative(options);
      case "COMPTE_RENDU_GESTION":    return await generateCompteRenduGestion(options);
      case "RENTABILITE_LOT":         return await generateRentabiliteLot(options);
      case "ETAT_IMPAYES":            return await generateEtatImpayes(options);
      case "RECAP_CHARGES_LOCATAIRE": return await generateRecapChargesLocataire(options);
      case "SUIVI_TRAVAUX":           return await generateSuiviTravaux(options);
      case "BALANCE_AGEE":            return await generateBalanceAgee(options);
      case "SUIVI_MENSUEL":           return await generateSuiviMensuel(options);
      case "VACANCE_LOCATIVE":        return await generateVacanceLocative(options);
      default: throw new Error("Type de rapport inconnu");
    }
  } catch (error) {
    console.error(`[generateReport] Erreur lors de la generation du rapport ${options.type}:`, error);
    throw new Error("Erreur lors de la generation du rapport. Veuillez reessayer.");
  }
}
