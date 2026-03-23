import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Route de migration one-shot — protégée par CRON_SECRET
// À supprimer après usage
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const results: string[] = [];

  const migrations = [
    `ALTER TYPE "IndexType" ADD VALUE IF NOT EXISTS 'IRL'`,
    `ALTER TABLE "Society" ADD COLUMN IF NOT EXISTS "invoiceNumberYear" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Society" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
    `ALTER TABLE "Society" ADD COLUMN IF NOT EXISTS "shareCapital" DOUBLE PRECISION`,
    `ALTER TABLE "Society" ADD COLUMN IF NOT EXISTS "signatoryName" TEXT`,
  ];

  for (const sql of migrations) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push(`OK: ${sql.substring(0, 60)}…`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // "already exists" n'est pas une erreur bloquante
      if (msg.includes("already exists") || msg.includes("duplicate")) {
        results.push(`SKIP (déjà appliqué): ${sql.substring(0, 60)}…`);
      } else {
        results.push(`ERR: ${msg}`);
      }
    }
  }

  return NextResponse.json({ results });
}
