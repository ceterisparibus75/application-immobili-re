 
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import type { ReportOptions, ReportResult } from "../types";

export async function generateSuiviTravaux(opts: ReportOptions): Promise<ReportResult> {
  const { societyId, buildingId } = opts;
  const year = opts.year ?? new Date().getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);

  const maintenances = await prisma.maintenance.findMany({
    where: {
      building: { societyId },
      ...(buildingId ? { buildingId } : {}),
      OR: [
        { scheduledAt: { gte: from, lte: to } },
        { completedAt: { gte: from, lte: to } },
        { createdAt: { gte: from, lte: to } },
      ],
    },
    include: { building: { select: { name: true } } },
    orderBy: [{ building: { name: "asc" } }, { scheduledAt: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "MyGestia";
  wb.created = new Date();
  const ws = wb.addWorksheet("Suivi travaux");
  const hF: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C2340" } };
  const hFn: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };

  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = opts.society?.name
    ? `${opts.society.name} - Suivi des travaux - ${year}`
    : `Suivi des travaux - ${year}`;
  ws.getCell("A1").font = { bold: true, size: 13, color: { argb: "FF0C2340" } };
  ws.getCell("A1").alignment = { horizontal: "center" };
  ws.getRow(1).height = 28;
  const hdrs = ["Immeuble", "Titre", "Description", "Coût", "Payé", "Planifié le", "Réalisé le"];
  ws.addRow(hdrs).eachCell((c) => { c.fill = hF; c.font = hFn; c.alignment = { horizontal: "center" }; });
  ws.getRow(2).height = 22;
  [22, 25, 35, 14, 10, 14, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  let totCost = 0;
  const byBuilding: Record<string, { cost: number; count: number }> = {};

  for (const m of maintenances) {
    const cost = m.cost ?? 0;
    totCost += cost;
    if (!byBuilding[m.building.name]) byBuilding[m.building.name] = { cost: 0, count: 0 };
    byBuilding[m.building.name].cost += cost;
    byBuilding[m.building.name].count++;
    const row = ws.addRow([
      m.building.name, m.title, m.description ?? "",
      cost || null, m.isPaid ? "Oui" : "Non",
      m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString("fr-FR") : "",
      m.completedAt ? new Date(m.completedAt).toLocaleDateString("fr-FR") : "",
    ]);
    row.getCell(4).numFmt = '#,##0.00 "€"';
    const bg = m.completedAt ? "FFD6F5E3" : m.scheduledAt ? "FFFFF4CE" : "FFE0F7FA";
    row.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }; });
  }

  const tRow = ws.addRow(["TOTAL", "", "", totCost, "", "", ""]);
  tRow.getCell(4).numFmt = '#,##0.00 "€"';
  tRow.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F7FA" } }; c.font = { bold: true }; });

  // Summary sheet
  const ws2 = wb.addWorksheet("Synthèse par immeuble");
  [30, 18, 18].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });
  ws2.addRow(["Immeuble", "Coût total", "Nb interventions"]).eachCell((c) => { c.fill = hF; c.font = hFn; });
  for (const [name, { cost, count }] of Object.entries(byBuilding)) {
    const r = ws2.addRow([name, cost, count]);
    r.getCell(2).numFmt = '#,##0.00 "€"';
  }
  const sr = ws2.addRow(["TOTAL", totCost, maintenances.length]);
  sr.eachCell((c) => { c.font = { bold: true }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F7FA" } }; });
  sr.getCell(2).numFmt = '#,##0.00 "€"';

  const buf = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  return {
    buffer: buf,
    filename: `suivi-travaux-${year}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
