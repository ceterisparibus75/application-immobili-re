import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Route CRON : synchronise les indices ILC, ILAT et ICC depuis l'API INSEE.
 *
 * API BDM (Base de données macroéconomiques) INSEE :
 * - ILC  : 010768073 (Indice des Loyers Commerciaux)
 * - ILAT : 010768080 (Indice des Loyers des Activités Tertiaires)
 * - ICC  : 010768204 (Indice du Coût de la Construction)
 *
 * À planifier via Vercel Cron (vercel.json) :
 * { "path": "/api/cron/sync-indices", "schedule": "0 7 1 * *" }  (1er de chaque mois)
 *
 * Protégée par le header Authorization: Bearer CRON_SECRET
 */

// Identifiants des séries dans la BDM INSEE
const INSEE_SERIES: Record<string, string> = {
  ILC: "010768073",
  ILAT: "010768080",
  ICC: "010768204",
};

interface InseeObservation {
  value: string;
  period: string; // ex: "2024-T3" ou "2024-Q3" ou "2024-3"
}

interface InseeSeriesResponse {
  observations?: Array<{
    value: string;
    period: string;
  }>;
}

/**
 * Appelle l'API BDM INSEE pour récupérer les dernières valeurs d'une série.
 * Utilise l'API REST JSON de la BDM.
 */
async function fetchInseeSeriesLastN(
  seriesId: string,
  apiKey: string,
  apiSecret: string,
  lastNObs = 8
): Promise<InseeObservation[]> {
  // Obtenir un token OAuth2 INSEE
  const tokenResponse = await fetch(
    "https://api.insee.fr/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    }
  );

  if (!tokenResponse.ok) {
    throw new Error(`INSEE token error: ${tokenResponse.status}`);
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };
  const accessToken = tokenData.access_token;

  // Appel API BDM INSEE pour la série
  const url = `https://api.insee.fr/series/BDM/V1/data/SERIES_BDM/${seriesId}?lastNObservations=${lastNObs}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`INSEE API error ${response.status} for series ${seriesId}`);
  }

  const data = (await response.json()) as InseeSeriesResponse;

  // L'API BDM renvoie les observations dans un format GenericData JSON
  const observations = data.observations ?? [];
  return observations.map((obs) => ({
    value: obs.value,
    period: obs.period,
  }));
}

/**
 * Parse une période INSEE au format "AAAA-TN" ou "AAAA-QN" ou "AAAA-N"
 * et retourne { year, quarter }.
 */
function parsePeriod(period: string): { year: number; quarter: number } | null {
  // Formats possibles: "2024-T3", "2024-Q3", "2024-3", "2024S12" (semestriel - ignoré)
  const matchT = period.match(/^(\d{4})-T(\d)$/i);
  if (matchT) return { year: parseInt(matchT[1]), quarter: parseInt(matchT[2]) };

  const matchQ = period.match(/^(\d{4})-Q(\d)$/i);
  if (matchQ) return { year: parseInt(matchQ[1]), quarter: parseInt(matchQ[2]) };

  const matchN = period.match(/^(\d{4})-(\d)$/);
  if (matchN) return { year: parseInt(matchN[1]), quarter: parseInt(matchN[2]) };

  return null;
}

export async function POST(req: NextRequest) {
  // Vérification du secret CRON
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const apiKey = process.env.INSEE_API_KEY;
  const apiSecret = process.env.INSEE_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Variables INSEE_API_KEY et INSEE_API_SECRET non configurées" },
      { status: 500 }
    );
  }

  const results: Record<string, { synced: number; error?: string }> = {};

  for (const [indexType, seriesId] of Object.entries(INSEE_SERIES)) {
    try {
      const observations = await fetchInseeSeriesLastN(seriesId, apiKey, apiSecret);
      let synced = 0;

      for (const obs of observations) {
        const value = parseFloat(obs.value);
        if (isNaN(value)) continue;

        const parsed = parsePeriod(obs.period);
        if (!parsed) continue;

        await prisma.inseeIndex.upsert({
          where: {
            indexType_year_quarter: {
              indexType: indexType as "ILC" | "ILAT" | "ICC",
              year: parsed.year,
              quarter: parsed.quarter,
            },
          },
          update: { value },
          create: {
            indexType: indexType as "ILC" | "ILAT" | "ICC",
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
