/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import type { ReportOptions, ReportResult, ColAlign } from "../types";
import { CW, CORAL, CHART_COLORS } from "../constants";
import { initPdf, drawCoverPage, pdfCur, contentStartY, minY } from "../pdf-core";
import {
  drawSectionHeader,
  drawTableHeader,
  drawTableRow,
  drawTotalsRow,
  drawKpiRow,
} from "../pdf-helpers";
import { drawPieChart } from "../pdf-charts";

const BUCKETS = ["+120j", "91-120j", "61-90j", "31-60j", "0-30j"] as const;

function ageBucket(dueDate: Date, today: Date): typeof BUCKETS[number] {
  const days = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
  if (days > 120) return "+120j";
  if (days > 90) return "91-120j";
  if (days > 60) return "61-90j";
  if (days > 30) return "31-60j";
  return "0-30j";
}

export async function generateBalanceAgee(opts: ReportOptions): Promise<ReportResult> {
  const { societyId } = opts;
  const today = new Date();

  const invoices = await prisma.invoice.findMany({
    where: {
      societyId,
      invoiceType: { not: "AVOIR" },
      dueDate: { lt: today },
      status: { notIn: ["PAYE"] },
    },
    include: {
      tenant: true,
      lease: { include: { lot: { include: { building: { select: { name: true } } } } } },
    },
    orderBy: { dueDate: "asc" },
  });

  const ctx = await initPdf("Balance agee", `Creances au ${today.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`, opts.society);

  drawCoverPage(ctx, "Balance Agee", "Analyse de l'anciennete des creances", [
    `Societe : ${opts.society?.name ?? ""}`,
    `Au ${today.toLocaleDateString("fr-FR")}`,
  ]);

  let p = ctx.np();
  let y = contentStartY();
  const total = invoices.reduce((s, i) => s + i.totalTTC, 0);

  // KPIs
  y = drawSectionHeader(p, ctx.bold, y, "Synthese");
  y -= 4;
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Nombre de factures impayees", String(invoices.length));
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Montant total des creances", pdfCur(total), CORAL);
  y -= 12;

  // Bucket totals
  const bucketTotals: Record<string, number> = {};
  for (const b of BUCKETS) bucketTotals[b] = 0;
  for (const inv of invoices) {
    bucketTotals[ageBucket(new Date(inv.dueDate), today)] += inv.totalTTC;
  }

  // Pie chart
  y = drawSectionHeader(p, ctx.bold, y, "Repartition par tranche");
  y -= 8;
  const slices = BUCKETS.map((b, i) => ({ value: bucketTotals[b], label: b, color: CHART_COLORS[i] }));
  y = drawPieChart(p, 150, y - 60, 55, slices, ctx.reg, ctx.bold);
  y -= 16;

  // Table
  const WS = [90, 85, 52, 52, 52, 52, CW - 383];
  const WA: ColAlign[] = ["left", "left", "right", "right", "right", "right", "right"];
  const hdr = ["Locataire", "Immeuble/Lot", ...BUCKETS.map(String), "Total"];

  // Group by building
  const byBuilding = new Map<string, { name: string; loc: string; buckets: Record<string, number>; total: number }[]>();
  for (const inv of invoices) {
    const bName = inv.lease?.lot?.building?.name ?? "Autre";
    if (!byBuilding.has(bName)) byBuilding.set(bName, []);
    const arr = byBuilding.get(bName)!;
    const tn = inv.tenant.entityType === "PERSONNE_MORALE"
      ? (inv.tenant.companyName ?? "-")
      : `${inv.tenant.firstName ?? ""} ${inv.tenant.lastName ?? ""}`.trim() || "-";
    let entry = arr.find((e) => e.name === tn);
    if (!entry) {
      entry = { name: tn, loc: inv.lease?.lot ? `${bName}/${inv.lease.lot.number}` : "-", buckets: Object.fromEntries(BUCKETS.map((b) => [b, 0])), total: 0 };
      arr.push(entry);
    }
    const bucket = ageBucket(new Date(inv.dueDate), today);
    entry.buckets[bucket] += inv.totalTTC;
    entry.total += inv.totalTTC;
  }

  for (const [bName, tenants] of byBuilding) {
    if (y < 120) { p = ctx.np(); y = contentStartY(); }
    y = drawSectionHeader(p, ctx.bold, y, bName);
    y = drawTableHeader(p, ctx.bold, y, hdr, WS, WA);

    let ri = 0;
    let subTotal = 0;
    for (const t of tenants) {
      if (y < minY()) { p = ctx.np(); y = contentStartY(); y = drawTableHeader(p, ctx.bold, y, hdr, WS, WA); }
      subTotal += t.total;
      y = drawTableRow(p, ctx.reg, y, [
        t.name, t.loc,
        ...BUCKETS.map((b) => t.buckets[b] > 0 ? pdfCur(t.buckets[b]) : "-"),
        pdfCur(t.total),
      ], WS, WA, { rowIndex: ri++ });
    }
    y = drawTotalsRow(p, ctx.bold, y, [
      "SOUS-TOTAL", "",
      ...BUCKETS.map((b) => { const v = tenants.reduce((s, t) => s + t.buckets[b], 0); return v > 0 ? pdfCur(v) : "-"; }),
      pdfCur(subTotal),
    ], WS, WA);
    y -= 8;
  }

  // Grand total
  if (y < minY()) { p = ctx.np(); y = contentStartY(); }
  y = drawTotalsRow(p, ctx.bold, y, [
    "TOTAL GENERAL", "",
    ...BUCKETS.map((b) => bucketTotals[b] > 0 ? pdfCur(bucketTotals[b]) : "-"),
    pdfCur(total),
  ], WS, WA);

  return {
    buffer: await ctx.save(),
    filename: `balance-agee-${today.toISOString().slice(0, 10)}.pdf`,
    contentType: "application/pdf",
  };
}
