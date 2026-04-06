"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

// Séries INSEE BDM (endpoint public, sans authentification)
// IDBANK vérifiés en avril 2026 — séries de base (valeur absolue, pas variation)
const INSEE_SERIES: Record<string, string> = {
  IRL: "001515333",   // Indice de Référence des Loyers
  ILC: "001532540",   // Indice des Loyers Commerciaux (base 100 T1 2008)
  ILAT: "001617112",  // Indice des Loyers des Activités Tertiaires (base 100 T1 2010)
  ICC: "000008630",   // Indice du Coût de la Construction
};

/**
 * Extrait les observations depuis une réponse SDMX-ML XML de l'INSEE.
 * Supporte 2 formats :
 *  - StructureSpecific : <Obs TIME_PERIOD="2025-Q4" OBS_VALUE="145.78" />
 *  - Generic : <generic:Obs>...<generic:ObsValue value="..."/>...</generic:Obs>
 */
function parseSDMXObservations(
  xml: string
): Array<{ period: string; value: string }> {
  const results: Array<{ period: string; value: string }> = [];

  // Format StructureSpecific (format actuel de l'API BDM)
  // <Obs TIME_PERIOD="2025-Q4" OBS_VALUE="145.78" ... />
  const ssRegex = /<Obs\s[^>]*TIME_PERIOD="([^"]+)"[^>]*OBS_VALUE="([^"]+)"[^>]*\/?\s*>/g;
  let match;
  while ((match = ssRegex.exec(xml)) !== null) {
    results.push({ period: match[1], value: match[2] });
  }

  // Si aucun résultat, essayer le format Generic (ancien format)
  if (results.length === 0) {
    const genRegex = /<(?:generic:)?Obs>([\s\S]*?)<\/(?:generic:)?Obs>/g;
    while ((match = genRegex.exec(xml)) !== null) {
      const block = match[1];
      const periodMatch = block.match(/id="TIME_PERIOD"\s+value="([^"]+)"/);
      const valueMatch = block.match(
        /<(?:generic:)?ObsValue\s+value="([^"]+)"/
      );
      if (periodMatch && valueMatch) {
        results.push({ period: periodMatch[1], value: valueMatch[1] });
      }
    }
  }

  return results;
}

/** Période INSEE "AAAA-TN" → { year, quarter } */
function parsePeriod(
  period: string
): { year: number; quarter: number } | null {
  const m =
    period.match(/^(\d{4})-T(\d)$/i) ??
    period.match(/^(\d{4})-Q(\d)$/i) ??
    period.match(/^(\d{4})-(\d)$/);
  if (m) return { year: parseInt(m[1]), quarter: parseInt(m[2]) };
  return null;
}

/**
 * Synchronise les indices INSEE depuis l'API BDM publique.
 * Récupère les 20 dernières observations par série.
 * Peut être appelée depuis l'UI (bouton Synchroniser) ou le cron.
 */
export async function syncInseeIndices(
  societyId: string,
  indexTypes?: string[]
): Promise<
  ActionResult<{ synced: Record<string, number>; errors: string[] }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const typesToSync = indexTypes?.length
      ? Object.entries(INSEE_SERIES).filter(([type]) =>
          indexTypes.includes(type)
        )
      : Object.entries(INSEE_SERIES);

    const synced: Record<string, number> = {};
    const errors: string[] = [];

    for (const [indexType, seriesId] of typesToSync) {
      try {
        const url = `https://api.insee.fr/series/BDM/data/SERIES_BDM/${seriesId}?lastNObservations=20`;
        const response = await fetch(url, {
          headers: { Accept: "application/xml, text/xml, */*" },
          // Pas de cache pour avoir les données les plus récentes
          cache: "no-store",
        });

        if (!response.ok) {
          errors.push(`${indexType} : erreur INSEE (HTTP ${response.status})`);
          continue;
        }

        const xml = await response.text();
        const observations = parseSDMXObservations(xml);
        let count = 0;

        for (const obs of observations) {
          const value = parseFloat(obs.value);
          if (isNaN(value)) continue;

          const parsed = parsePeriod(obs.period);
          if (!parsed) continue;

          await prisma.inseeIndex.upsert({
            where: {
              indexType_year_quarter: {
                indexType: indexType as "IRL" | "ILC" | "ILAT" | "ICC",
                year: parsed.year,
                quarter: parsed.quarter,
              },
            },
            update: { value },
            create: {
              indexType: indexType as "IRL" | "ILC" | "ILAT" | "ICC",
              year: parsed.year,
              quarter: parsed.quarter,
              value,
              publishedAt: new Date(),
            },
          });
          count++;
        }

        synced[indexType] = count;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        errors.push(`${indexType} : ${msg}`);
      }
    }

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "InseeIndex",
      entityId: "sync",
      details: { synced, errors },
    });

    revalidatePath("/indices");

    return { success: true, data: { synced, errors } };
  } catch (error) {
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[syncInseeIndices]", error);
    return {
      success: false,
      error: "Erreur lors de la synchronisation des indices INSEE",
    };
  }
}
