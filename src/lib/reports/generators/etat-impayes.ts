import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import type { ReportOptions, ReportResult, ColAlign } from "../types";
import { CW, CORAL, GREEN, CHART_COLORS } from "../constants";
import { initPdf, drawCoverPage, pdfCur, contentStartY, minY } from "../pdf-core";
import {
  drawSectionHeader,
  drawTableHeader,
  drawTableRow,
  drawTotalsRow,
  drawEmptyMessage,
} from "../pdf-helpers";
import { drawPieChart } from "../pdf-charts";

function ageBucket(dueDate: Date, today: Date): string {
  const days = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
  if (days <= 30) return "0-30j";
  if (days <= 60) return "31-60j";
  if (days <= 90) return "61-90j";
  if (days <= 120) return "91-120j";
  return "+120j";
}

const BUCKETS = ["0-30j", "31-60j", "61-90j", "91-120j", "+120j"] as const;

export async function generateEtatImpayes(opts: ReportOptions): Promise<ReportResult> {
  const { societyId, format = "pdf" } = opts;
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

  const EUR = '#,##0.00 "€"';
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "MyGestia";
    const ws = wb.addWorksheet("Impayés");
    const hF: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8302E" } };
    const hFn: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    ws.mergeCells("A1:H1");
    ws.getCell("A1").value = opts.society?.name
      ? `${opts.society.name} - État des impayés - ${today.toLocaleDateString("fr-FR")}`
      : `État des impayés - ${today.toLocaleDateString("fr-FR")}`;
    ws.getCell("A1").font = { bold: true, size: 13, color: { argb: "FFC8302E" } };
    ws.getCell("A1").alignment = { horizontal: "center" };
    ws.getRow(1).height = 28;
    const hdr = ["N° facture", "Locataire", "Immeuble / Lot", "Échéance", "Montant TTC", "Retard (j)", "Tranche", "Statut"];
    ws.addRow(hdr).eachCell((c) => { c.fill = hF; c.font = hFn; c.alignment = { horizontal: "center" }; });
    ws.getRow(2).height = 22;
    [16, 25, 28, 14, 16, 14, 14, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    let total = 0;
    for (const inv of invoices) {
      const tn = inv.tenant.entityType === "PERSONNE_MORALE"
        ? (inv.tenant.companyName ?? "-")
        : `${inv.tenant.firstName ?? ""} ${inv.tenant.lastName ?? ""}`.trim() || "-";
      const loc = inv.lease?.lot ? `${inv.lease.lot.building.name} / ${inv.lease.lot.number}` : "-";
      const days = Math.max(0, Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000));
      total += inv.totalTTC;
      const row = ws.addRow([inv.invoiceNumber, tn, loc, new Date(inv.dueDate).toLocaleDateString("fr-FR"), inv.totalTTC, days, ageBucket(new Date(inv.dueDate), today), inv.status]);
      row.getCell(5).numFmt = EUR;
      if (days > 30) row.getCell(6).font = { color: { argb: "FFC8302E" }, bold: true };
    }
    const tRow = ws.addRow(["TOTAL", "", "", "", total, "", "", ""]);
    tRow.getCell(5).numFmt = EUR;
    tRow.eachCell((c) => { c.font = { bold: true }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE8E8" } }; });
    const buf = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
    return { buffer: buf, filename: `impayes-${today.toISOString().slice(0, 10)}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }

  // PDF with aging columns
  const ctx = await initPdf(
    "État des impayés",
    `Factures impayées au ${today.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`,
    opts.society
  );

  drawCoverPage(ctx, "État des Impayés", "Balance âgée des créances", [
    `Société : ${opts.society?.name ?? ""}`,
    `Au ${today.toLocaleDateString("fr-FR")}`,
    `${invoices.length} facture(s) impayée(s)`,
  ]);

  let p = ctx.np();
  let y = contentStartY();

  if (invoices.length === 0) {
    p.drawText("Aucune facture impayée", { x: 41, y, size: 10, font: ctx.bold, color: GREEN });
    y -= 16;
    p.drawText("Toutes les factures sont à jour.", { x: 41, y, size: 9, font: ctx.reg, color: GREEN });
    return { buffer: await ctx.save(), filename: `impayes-${today.toISOString().slice(0, 10)}.pdf`, contentType: "application/pdf" };
  }

  // Pie chart: debt by age bucket
  const bucketTotals: Record<string, number> = {};
  for (const b of BUCKETS) bucketTotals[b] = 0;
  for (const inv of invoices) {
    bucketTotals[ageBucket(new Date(inv.dueDate), today)] += inv.totalTTC;
  }

  y = drawSectionHeader(p, ctx.serifBold, y, "Répartition par ancienneté");
  y -= 8;
  const pieSlices = BUCKETS.map((b, i) => ({ value: bucketTotals[b], label: b, color: CHART_COLORS[i] }));
  y = drawPieChart(p, 150, y - 60, 55, pieSlices, ctx.reg, ctx.bold);
  y -= 16;

  // Table grouped by building → tenant
  const total = invoices.reduce((s, i) => s + i.totalTTC, 0);
  y = drawSectionHeader(p, ctx.serifBold, y, `Détail - Total : ${pdfCur(total)}`);

  const WS = [90, 85, 52, 52, 52, 52, 52, CW - 435];
  const WA: ColAlign[] = ["left", "left", "right", "right", "right", "right", "right", "right"];
  y = drawTableHeader(p, ctx.bold, y, ["Locataire", "Immeuble/Lot", "0-30j", "31-60j", "61-90j", "91-120j", "+120j", "Total"], WS, WA);

  // Group by building→tenant
  const grouped = new Map<string, Map<string, { name: string; loc: string; buckets: Record<string, number> }>>();
  for (const inv of invoices) {
    const bName = inv.lease?.lot?.building?.name ?? "Autre";
    const tn = inv.tenant.entityType === "PERSONNE_MORALE"
      ? (inv.tenant.companyName ?? "-")
      : `${inv.tenant.firstName ?? ""} ${inv.tenant.lastName ?? ""}`.trim() || "-";
    const tid = inv.tenantId;
    if (!grouped.has(bName)) grouped.set(bName, new Map());
    const bMap = grouped.get(bName)!;
    if (!bMap.has(tid)) {
      bMap.set(tid, { name: tn, loc: inv.lease?.lot ? `${bName} / ${inv.lease.lot.number}` : "-", buckets: Object.fromEntries(BUCKETS.map((b) => [b, 0])) });
    }
    bMap.get(tid)!.buckets[ageBucket(new Date(inv.dueDate), today)] += inv.totalTTC;
  }

  let ri = 0;
  for (const [, tenants] of grouped) {
    for (const [, t] of tenants) {
      if (y < minY()) {
        p = ctx.np();
        y = contentStartY();
        y = drawTableHeader(p, ctx.bold, y, ["Locataire", "Immeuble/Lot", "0-30j", "31-60j", "61-90j", "91-120j", "+120j", "Total"], WS, WA);
      }
      const rowTotal = BUCKETS.reduce((s, b) => s + t.buckets[b], 0);
      y = drawTableRow(p, ctx.reg, y, [
        t.name, t.loc,
        ...BUCKETS.map((b) => t.buckets[b] > 0 ? pdfCur(t.buckets[b]) : "-"),
        pdfCur(rowTotal),
      ], WS, WA, { rowIndex: ri++, cellColors: [null, null, null, null, null, null, rowTotal > 0 ? CORAL : null, null] });
    }
  }
  y = drawTotalsRow(p, ctx.bold, y, [
    "TOTAL", "",
    ...BUCKETS.map((b) => bucketTotals[b] > 0 ? pdfCur(bucketTotals[b]) : "-"),
    pdfCur(total),
  ], WS, WA);

  return { buffer: await ctx.save(), filename: `impayes-${today.toISOString().slice(0, 10)}.pdf`, contentType: "application/pdf" };
}
