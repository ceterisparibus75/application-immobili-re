/**
 * Cron job — Relance l'analyse IA pour les documents en erreur.
 * À appeler périodiquement (ex: toutes les heures) via Vercel Cron ou un scheduler externe.
 * Authentification : Bearer {CRON_SECRET}
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300; // 5 minutes max

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: { code: "CRON_NOT_CONFIGURED", message: "CRON_SECRET non configuré" } },
      { status: 500 }
    );
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Non autorisé" } },
      { status: 401 }
    );
  }

  try {
    // Récupérer les documents en erreur avec un storagePath valide (PDF ou image)
    const failedDocs = await prisma.document.findMany({
      where: {
        aiStatus: "error",
        storagePath: { not: null },
        mimeType: { in: ["application/pdf", "image/jpeg", "image/png", "image/webp"] },
      },
      select: { id: true },
      take: 20, // Limiter par batch
    });

    if (failedDocs.length === 0) {
      return NextResponse.json({ success: true, retried: 0, message: "Aucun document à retraiter" });
    }

    const appUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
    let retried = 0;
    let failed = 0;

    for (const doc of failedDocs) {
      try {
        const res = await fetch(`${appUrl}/api/documents/${doc.id}/analyze`, {
          method: "POST",
          headers: {
            "x-cron-secret": process.env.CRON_SECRET,
          },
        });

        if (res.ok) {
          retried++;
        } else {
          failed++;
          console.error(`[cron/ai-retry] Doc ${doc.id} failed:`, res.status);
        }
      } catch (err) {
        failed++;
        console.error(`[cron/ai-retry] Doc ${doc.id} exception:`, err);
      }

      // Petite pause pour ne pas surcharger l'API IA
      await new Promise((r) => setTimeout(r, 1000));
    }

    return NextResponse.json({
      success: true,
      total: failedDocs.length,
      retried,
      failed,
    });
  } catch (error) {
    console.error("[cron/ai-retry]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
