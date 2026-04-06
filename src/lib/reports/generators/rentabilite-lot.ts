/* eslint-disable @typescript-eslint/no-explicit-any */
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import type { ReportOptions, ReportResult } from "../types";

export async function generateRentabiliteLot(opts: ReportOptions): Promise<ReportResult> {
  const { societyId, buildingId } = opts;
  const year = opts.year ?? new Date().getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);

  const lots = await prisma.lot.findMany({
    where: { building: { societyId }, ...(buildingId ? { buildingId } : {}) },
    include: {
      building: true,
      leases: {
        where: { status: { in: ["EN_COURS", "RENOUVELE"] } },
        include: {
          invoices: {
            where: { issueDate: { gte: from, lte: to }, invoiceType: { not: "AVOIR" } },
          },
        },
        take: 1,
      },
    },
    orderBy: [{ building: { name: "asc" } }, { number: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "MyGestia";
  wb.created = new Date();
  const ws = wb.addWorksheet("Rentabilite par lot");
  const hFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C2340" } };
  const hFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  const tFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F7FA" } };

  ws.mergeCells("A1:H1");
  const tc = ws.getCell("A1");
  tc.value = opts.society?.name
    ? `${opts.society.name} - Tableau de rentabilite par lot - ${year}`
    : `Tableau de rentabilite par lot - ${year}`;
  tc.font = { bold: true, size: 13, color: { argb: "FF0C2340" } };
  tc.alignment = { horizontal: "center" };
  ws.getRow(1).height = 28;

  const hdrs = ["Immeuble", "Lot", "Type", "Statut", "Loyer mensuel HC", "Revenus annuels", "Valeur locative marche", "Occupation"];
  const cw = [25, 12, 18, 12, 18, 18, 22, 12];
  const hr = ws.addRow(hdrs);
  hr.eachCell((c) => { c.fill = hFill; c.font = hFont; c.alignment = { horizontal: "center", vertical: "middle" }; c.border = { bottom: { style: "thin", color: { argb: "FF0C2340" } } }; });
  ws.getRow(2).height = 22;
  hdrs.forEach((_, i) => { ws.getColumn(i + 1).width = cw[i]; });
  const EUR = '#,##0.00 "€"';

  let totRev = 0;
  for (const lot of lots) {
    const lease = lot.leases[0];
    const rev = lease?.invoices.reduce((s, inv) => s + inv.totalTTC, 0) ?? 0;
    totRev += rev;
    const row = ws.addRow([
      lot.building.name, lot.number, lot.lotType.replace(/_/g, " "),
      lease ? "Occupe" : "Vacant",
      lease?.currentRentHT ?? 0,
      rev,
      (lot as any).marketRentValue ?? null,
      lot.status.replace(/_/g, " "),
    ]);
    [5, 6, 7].forEach((ci) => { row.getCell(ci).numFmt = EUR; });
    row.getCell(4).font = { color: { argb: lease ? "FF187B46" : "FFC8302E" } };
  }

  const tRow = ws.addRow(["TOTAL", "", "", "", "", totRev, null, ""]);
  tRow.eachCell((c, ci) => { c.fill = tFill; c.font = { bold: true }; if (ci === 6) c.numFmt = EUR; });

  if (lots.length > 0) {
    ws.addConditionalFormatting({
      ref: `D3:D${lots.length + 2}`,
      rules: [{
        type: "containsText",
        operator: "containsText",
        text: "Vacant",
        priority: 1,
        style: { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE8E8" } } },
      }],
    });
  }

  const buf = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  return {
    buffer: buf,
    filename: `rentabilite-lots-${year}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
