/**
 * GET /api/chorus-pro/test-connection
 *
 * Vérifie que les credentials PISTE (Chorus Pro) sont valides et que
 * l'authentification OAuth2 fonctionne. Utilisé par le bouton
 * "Tester la connexion" sur la page Paramètres > Facturation.
 *
 * Réservé aux utilisateurs authentifiés (révèle si PISTE est configuré +
 * statut des credentials — pas exploitable publiquement).
 */

import { NextResponse } from "next/server";
import { requireAuthenticatedRouteContext } from "@/lib/api-auth";
import { getPisteToken, isPisteConfigured } from "@/lib/piste";
import { env } from "@/lib/env";

export async function GET() {
  const ctx = await requireAuthenticatedRouteContext();
  if (ctx instanceof NextResponse) return ctx;

  if (!isPisteConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message: "PISTE_CLIENT_ID et/ou PISTE_CLIENT_SECRET non configurés",
        env: {
          PISTE_CLIENT_ID: env.PISTE_CLIENT_ID ? "présent" : "manquant",
          PISTE_CLIENT_SECRET: env.PISTE_CLIENT_SECRET ? "présent" : "manquant",
          PISTE_ENV: env.PISTE_ENV ?? "sandbox (défaut)",
        },
      },
      { status: 400 },
    );
  }

  try {
    const token = await getPisteToken();
    return NextResponse.json({
      ok: true,
      message: "Authentification PISTE réussie",
      env: { PISTE_ENV: env.PISTE_ENV ?? "sandbox" },
      tokenLength: token.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: "Échec de l'authentification PISTE",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
