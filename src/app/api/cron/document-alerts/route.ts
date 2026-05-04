import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/email";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

  // Fetch documents expiring in next 30 days or already expired since < 7 days
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const docs = await prisma.document.findMany({
    where: {
      deletedAt: null,
      versionOf: null,
      expiresAt: { gte: sevenDaysAgo, lte: in30days },
    },
    include: {
      society: { select: { id: true, name: true } },
      building: { select: { name: true } },
    },
    orderBy: { expiresAt: "asc" },
  });

  if (docs.length === 0) return NextResponse.json({ sent: 0 });

  // Group by society, then find admin emails
  const bySociety = new Map<string, typeof docs>();
  for (const doc of docs) {
    const list = bySociety.get(doc.societyId) ?? [];
    list.push(doc);
    bySociety.set(doc.societyId, list);
  }

  let sent = 0;
  for (const [societyId, societyDocs] of bySociety) {
    // Get admin users for this society
    const memberships = await prisma.userSociety.findMany({
      where: { societyId, role: { in: ["ADMIN_SOCIETE", "GESTIONNAIRE"] } },
      include: { user: { select: { email: true, firstName: true } } },
    });
    if (memberships.length === 0) continue;

    const expired = societyDocs.filter((d) => d.expiresAt && d.expiresAt < now);
    const expiringSoon = societyDocs.filter((d) => d.expiresAt && d.expiresAt >= now);
    const society = societyDocs[0]?.society;

    const rows = (list: typeof docs, label: string) =>
      list.map((d) => `<tr><td style="padding:4px 8px">${d.fileName}</td><td style="padding:4px 8px">${d.building?.name ?? "—"}</td><td style="padding:4px 8px">${d.expiresAt ? new Date(d.expiresAt).toLocaleDateString("fr-FR") : "—"}</td><td style="padding:4px 8px;color:${label === "Expiré" ? "#C8302E" : "#D97706"}">${label}</td></tr>`).join("");

    const html = `
<div style="font-family:sans-serif;max-width:600px">
  <h2 style="color:#0C2340">Documents à renouveler — ${society?.name ?? societyId}</h2>
  ${expired.length > 0 ? `<h3 style="color:#C8302E">Documents expirés (${expired.length})</h3>` : ""}
  ${expiringSoon.length > 0 ? `<h3 style="color:#D97706">Documents expirant dans 30 jours (${expiringSoon.length})</h3>` : ""}
  <table style="border-collapse:collapse;width:100%">
    <thead><tr style="background:#F1F5F9">
      <th style="padding:6px 8px;text-align:left">Document</th>
      <th style="padding:6px 8px;text-align:left">Immeuble</th>
      <th style="padding:6px 8px;text-align:left">Expiration</th>
      <th style="padding:6px 8px;text-align:left">Statut</th>
    </tr></thead>
    <tbody>
      ${rows(expired, "Expiré")}
      ${rows(expiringSoon, "Bientôt")}
    </tbody>
  </table>
  <p style="margin-top:16px"><a href="${env.AUTH_URL}/documents" style="color:#1D6FA8">Gérer les documents →</a></p>
</div>`;

    for (const m of memberships) {
      if (!m.user.email) continue;
      await sendMail(
        m.user.email,
        `[MyGestia] ${societyDocs.length} document${societyDocs.length > 1 ? "s" : ""} à renouveler — ${society?.name ?? ""}`,
        html,
      ).catch(() => null);
      sent++;
    }
  }

  return NextResponse.json({ sent, documentsFound: docs.length });
}