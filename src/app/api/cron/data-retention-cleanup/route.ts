import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!verifyCronSecret(authHeader)) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  try {
    const results = await runDataRetentionCleanup();
    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("[cron/data-retention-cleanup]", error);
    return NextResponse.json({ error: "Erreur lors de la purge RGPD" }, { status: 500 });
  }
}

async function runDataRetentionCleanup() {
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 1 * YEAR_MS);
  const threeYearsAgo = new Date(now.getTime() - 3 * YEAR_MS);
  const fiveYearsAgo = new Date(now.getTime() - 5 * YEAR_MS);

  // 1. AuditLog > 1 an — suppression définitive (RGPD : durée 1 an)
  const { count: auditDeleted } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: oneYearAgo } },
  });

  // 2. GdprRequest complétées > 3 ans — suppression définitive
  const { count: gdprDeleted } = await prisma.gdprRequest.deleteMany({
    where: {
      status: { in: ["completed", "refused"] },
      processedAt: { lt: threeYearsAgo },
    },
  });

  // 3. Anonymisation des locataires archivés > 5 ans après fin de dernier bail
  //    Condition : isActive = false ET tous les baux terminés il y a > 5 ans
  const tenantsToAnonymize = await prisma.tenant.findMany({
    where: {
      isActive: false,
      leases: {
        every: {
          endDate: { lt: fiveYearsAgo },
        },
      },
      // Exclure ceux déjà anonymisés (email remplacé par placeholder)
      NOT: { email: { startsWith: "anonymized_" } },
    },
    select: {
      id: true,
      societyId: true,
      leases: { select: { endDate: true } },
    },
    take: 100, // traiter par batch pour éviter les timeouts
  });

  // Ne traiter que les locataires qui ont au moins un bail (sinon pas de date de fin)
  const eligibleTenants = tenantsToAnonymize.filter(
    (t) => t.leases.length > 0 && t.leases.every((l) => l.endDate && l.endDate < fiveYearsAgo)
  );

  let anonymized = 0;
  for (const tenant of eligibleTenants) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        // Données personnelles identifiantes — effacées
        firstName: null,
        lastName: null,
        birthDate: null,
        birthPlace: null,
        personalAddress: null,
        idDocumentUrl: null,
        idExpiresAt: null,
        // Email : remplacé par un placeholder non-réidentifiant
        email: `anonymized_${tenant.id}@purge.rgpd`,
        billingEmail: null,
        phone: null,
        mobile: null,
        notes: null,
        // Données bancaires — effacées (obligation de conservation 10 ans via factures)
        // Les factures elles-mêmes sont conservées pour l'obligation comptable
      },
    });
    anonymized++;
  }

  return { auditDeleted, gdprDeleted, anonymized };
}
