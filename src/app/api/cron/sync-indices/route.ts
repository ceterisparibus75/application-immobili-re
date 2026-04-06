import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Route CRON : synchronise les indices IRL, ILC, ILAT et ICC depuis l'API INSEE publique.
 *
 * API BDM (Base de données macroéconomiques) INSEE — endpoint public, sans authentification :
 *   https://api.insee.fr/series/BDM/data/SERIES_BDM/{IDBANK}?lastNObservations=8
 *
 * Séries :
 *   IRL  : 001515333 (Indice de Référence des Loyers)
 *   ILC  : 001517765 (Indice des Loyers Commerciaux)
 *   ILAT : 001517754 (Indice des Loyers des Activités Tertiaires)
 *   ICC  : 001517761 (Indice du Coût de la Construction)
 *
 * À planifier via Vercel Cron (vercel.json) :
 *   { "path": "/api/cron/sync-indices", "schedule": "0 7 1 * *" }
 *
 * Protégée par le header Authorization: Bearer CRON_SECRET
 */

// IDBANK vérifiés en avril 2026 — séries de base (valeur absolue, pas variation)
const INSEE_SERIES: Record<string, string> = {
  IRL: "001515333",   // Indice de Référence des Loyers
  ILC: "001532540",   // Indice des Loyers Commerciaux (base 100 T1 2008)
  ILAT: "001617112",  // Indice des Loyers des Activités Tertiaires (base 100 T1 2010)
  ICC: "000008630",   // Indice du Coût de la Construction
};

/**
 * Extrait les observations depuis une réponse SDMX-ML XML retournée par l'API BDM INSEE.
 * Supporte 2 formats :
 *  - StructureSpecific : <Obs TIME_PERIOD="2025-Q4" OBS_VALUE="145.78" />
 *  - Generic : <generic:Obs>...<generic:ObsValue value="..."/>...</generic:Obs>
 */
function parseSDMXObservations(xml: string): Array<{ period: string; value: string }> {
  const results: Array<{ period: string; value: string }> = [];

  // Format StructureSpecific (format actuel de l'API BDM)
  const ssRegex = /<Obs\s[^>]*TIME_PERIOD="([^"]+)"[^>]*OBS_VALUE="([^"]+)"[^>]*\/?\s*>/g;
  let match;
  while ((match = ssRegex.exec(xml)) !== null) {
    results.push({ period: match[1], value: match[2] });
  }

  // Fallback : format Generic (ancien format)
  if (results.length === 0) {
    const genRegex = /<(?:generic:)?Obs>([\s\S]*?)<\/(?:generic:)?Obs>/g;
    while ((match = genRegex.exec(xml)) !== null) {
      const block = match[1];
      const periodMatch = block.match(/id="TIME_PERIOD"\s+value="([^"]+)"/);
      const valueMatch = block.match(/<(?:generic:)?ObsValue\s+value="([^"]+)"/);
      if (periodMatch && valueMatch) {
        results.push({ period: periodMatch[1], value: valueMatch[1] });
      }
    }
  }

  return results;
}

/**
 * Période INSEE au format "AAAA-TN" (ex: "2024-T3") → { year, quarter }
 */
function parsePeriod(period: string): { year: number; quarter: number } | null {
  const m = period.match(/^(\d{4})-T(\d)$/i) ?? period.match(/^(\d{4})-Q(\d)$/i) ?? period.match(/^(\d{4})-(\d)$/);
  if (m) return { year: parseInt(m[1]), quarter: parseInt(m[2]) };
  return null;
}

async function fetchInseeSeriesLastN(seriesId: string, lastN = 20): Promise<Array<{ period: string; value: string }>> {
  const url = `https://api.insee.fr/series/BDM/data/SERIES_BDM/${seriesId}?lastNObservations=${lastN}`;
  const response = await fetch(url, {
    headers: { Accept: "application/xml, text/xml, */*" },
  });

  if (!response.ok) {
    throw new Error(`INSEE API ${response.status} pour la série ${seriesId}`);
  }

  const xml = await response.text();
  return parseSDMXObservations(xml);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const results: Record<string, { synced: number; error?: string }> = {};

  for (const [indexType, seriesId] of Object.entries(INSEE_SERIES)) {
    try {
      const observations = await fetchInseeSeriesLastN(seriesId);
      let synced = 0;

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
        synced++;
      }

      results[indexType] = { synced };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur inconnue";
      console.error(`[cron/sync-indices] ${indexType}:`, msg);
      results[indexType] = { synced: 0, error: msg };
    }
  }

  return NextResponse.json({ success: true, results });
}
