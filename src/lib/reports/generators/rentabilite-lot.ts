import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import type { ReportOptions, ReportResult } from "../types";
import {
  REPORT_ACTIVE_INVOICE_STATUSES,
  REPORT_REVENUE_INVOICE_TYPES,
} from "../invoice-metrics";
import { getLeaseOverlapWhere } from "../lease-scope";
const FREQ_PERIODS: Record<string, number> = {
  MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1,
};
const LOT_TYPE_LABELS: Record<string, string> = {
  LOCAL_COMMERCIAL: "Local commercial", BUREAUX: "Bureaux", LOCAL_ACTIVITE: "Local d'activité",
  APPARTEMENT: "Appartement", RESERVE: "Réserve", PARKING: "Parking",
  CAVE: "Cave", TERRASSE: "Terrasse", ENTREPOT: "Entrepôt",
};
const LOT_STATUS_LABELS: Record<string, string> = {
  VACANT: "Vacant", OCCUPE: "Occupé", EN_TRAVAUX: "En travaux", RESERVE: "Réservé",
};

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
        where: getLeaseOverlapWhere(from, to),
        include: {
          invoices: {
            where: {
              issueDate: { gte: from, lte: to },
              invoiceType: { in: [...REPORT_REVENUE_INVOICE_TYPES] },
              status: { in: [...REPORT_ACTIVE_INVOICE_STATUSES] },
            },
          },
        },
        orderBy: { startDate: "desc" },
      },
    },
    orderBy: [{ building: { name: "asc" } }, { number: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "MyGestia";
  wb.created = new Date();
  const ws = wb.addWorksheet("Rentabilité par lot");
  const hFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C2340" } };
  const hFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  const tFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F7FA" } };

  ws.mergeCells("A1:H1");
  const tc = ws.getCell("A1");
  tc.value = opts.society?.name
    ? `${opts.society.name} - Tableau de rentabilité par lot - ${year}`
    : `Tableau de rentabilité par lot - ${year}`;
  tc.font = { bold: true, size: 13, color: { argb: "FF0C2340" } };
  tc.alignment = { horizontal: "center" };
  ws.getRow(1).height = 28;

  const hdrs = ["Immeuble", "Lot", "Type", "Statut", "Loyer mensuel HC", "Revenus annuels", "Valeur locative marché", "Occupation"];
  const cw = [25, 12, 18, 12, 18, 18, 22, 12];
  const hr = ws.addRow(hdrs);
  hr.eachCell((c) => { c.fill = hFill; c.font = hFont; c.alignment = { horizontal: "center", vertical: "middle" }; c.border = { bottom: { style: "thin", color: { argb: "FF0C2340" } } }; });
  ws.getRow(2).height = 22;
  hdrs.forEach((_, i) => { ws.getColumn(i + 1).width = cw[i]; });
  const EUR = '#,##0.00 "€"';

  let totRev = 0;
  for (const lot of lots) {
    const lease = lot.leases[0];
    const rev = lot.leases.reduce(
      (sum, leaseItem) => sum + leaseItem.invoices.reduce((s, inv) => s + inv.totalHT, 0),
      0
    );
    totRev += rev;
    const monthlyRent = lease
      ? (lease.currentRentHT * (FREQ_PERIODS[lease.paymentFrequency] ?? 12)) / 12
      : 0;
    const row = ws.addRow([
      lot.building.name,
      lot.number,
      LOT_TYPE_LABELS[lot.lotType] ?? lot.lotType,
      lease ? "Occupé" : "Vacant",
      monthlyRent,
      rev,
      lot.marketRentValue ?? null,
      LOT_STATUS_LABELS[lot.status] ?? lot.status,
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
