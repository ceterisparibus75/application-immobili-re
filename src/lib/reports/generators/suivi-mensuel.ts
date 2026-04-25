/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import type { ReportOptions, ReportResult, ColAlign } from "../types";
import { LCW, CORAL, GREEN } from "../constants";
import { initPdf, drawCoverPage, pdfCur, contentStartY } from "../pdf-core";
import {
  drawSectionHeader,
  drawTableHeader,
  drawTableRow,
  drawTotalsRow,
} from "../pdf-helpers";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export async function generateSuiviMensuel(opts: ReportOptions): Promise<ReportResult> {
  const { societyId } = opts;
  const year = opts.year ?? new Date().getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);

  const [buildings, invoices, charges] = await Promise.all([
    prisma.building.findMany({ where: { societyId }, orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      where: { societyId, issueDate: { gte: from, lte: to }, invoiceType: { not: "AVOIR" } },
      include: {
        lease: { include: { lot: { select: { buildingId: true } } } },
        payments: true,
      },
    }),
    prisma.charge.findMany({
      where: { societyId, date: { gte: from, lte: to } },
    }),
  ]);

  const ctx = await initPdf(`Suivi mensuel ${year}`, "Tableau de suivi par immeuble", opts.society);

  drawCoverPage(ctx, "Tableau de Suivi Mensuel", `Exercice ${year}`, [
    `Société : ${opts.society?.name ?? ""}`,
    `Période : 01/01/${year} au 31/12/${year}`,
  ]);

  // Landscape pages for 14 columns
  const colW = 38;
  const labelW = LCW - 12 * colW - colW; // remaining for label + annee
  const WIDTHS = [labelW, ...Array(12).fill(colW), colW];
  const ALIGNS: ColAlign[] = ["left", ...Array(13).fill("right") as ColAlign[]];
  const HDR = ["", ...MONTHS, "Année"];

  for (const building of buildings) {
    const p = ctx.np(true);
    let y = contentStartY(true);

    y = drawSectionHeader(p, ctx.serifBold, y, building.name, 841.89);

    // Compute monthly data
    const bInvoices = invoices.filter((i) => i.lease?.lot?.buildingId === building.id);
    const bCharges = charges.filter((c) => (c as any).buildingId === building.id);

    const monthlyFact: number[] = Array(12).fill(0);
    const monthlyEnc: number[] = Array(12).fill(0);
    const monthlyChg: number[] = Array(12).fill(0);

    for (const inv of bInvoices) {
      const m = new Date(inv.issueDate).getMonth();
      monthlyFact[m] += inv.totalTTC;
      if (inv.status === "PAYE") monthlyEnc[m] += inv.totalTTC;
      else {
        const paidAmt = (inv.payments ?? []).reduce((s: number, pay: any) => s + (pay.amount ?? 0), 0);
        monthlyEnc[m] += paidAmt;
      }
    }
    for (const ch of bCharges) {
      const m = new Date(ch.date).getMonth();
      monthlyChg[m] += ch.amount;
    }

    const annFact = monthlyFact.reduce((a, b) => a + b, 0);
    const annEnc = monthlyEnc.reduce((a, b) => a + b, 0);
    const annChg = monthlyChg.reduce((a, b) => a + b, 0);

    y = drawTableHeader(p, ctx.bold, y, HDR, WIDTHS, ALIGNS, 841.89);

    // Loyers facturés
    y = drawTableRow(p, ctx.reg, y, [
      "Loyers facturés",
      ...monthlyFact.map((v) => v > 0 ? pdfCur(v) : "-"),
      pdfCur(annFact),
    ], WIDTHS, ALIGNS, { rowIndex: 0 }, 841.89);

    // Loyers encaissés
    y = drawTableRow(p, ctx.reg, y, [
      "Loyers encaissés",
      ...monthlyEnc.map((v) => v > 0 ? pdfCur(v) : "-"),
      pdfCur(annEnc),
    ], WIDTHS, ALIGNS, { rowIndex: 1 }, 841.89);

    // Charges
    y = drawTableRow(p, ctx.reg, y, [
      "Charges",
      ...monthlyChg.map((v) => v > 0 ? pdfCur(v) : "-"),
      pdfCur(annChg),
    ], WIDTHS, ALIGNS, { rowIndex: 2 }, 841.89);

    // Taux de recouvrement
    const monthlyRec = monthlyFact.map((f, i) => f > 0 ? (monthlyEnc[i] / f) * 100 : 0);
    const annRec = annFact > 0 ? (annEnc / annFact) * 100 : 0;
    y = drawTableRow(p, ctx.reg, y, [
      "Taux recouvrement",
      ...monthlyRec.map((v) => v > 0 ? v.toFixed(1) + "%" : "-"),
      annRec > 0 ? annRec.toFixed(1) + "%" : "-",
    ], WIDTHS, ALIGNS, {
      rowIndex: 3,
      cellColors: [null, ...monthlyRec.map((v) => v < 80 ? CORAL : v >= 95 ? GREEN : null), annRec < 80 ? CORAL : annRec >= 95 ? GREEN : null],
    }, 841.89);

    // Net result
    const monthlyNet = monthlyEnc.map((e, i) => e - monthlyChg[i]);
    const annNet = annEnc - annChg;
    y = drawTotalsRow(p, ctx.bold, y, [
      "Résultat net",
      ...monthlyNet.map((v) => pdfCur(v)),
      pdfCur(annNet),
    ], WIDTHS, ALIGNS, 841.89);
  }

  return {
    buffer: await ctx.save(),
    filename: `suivi-mensuel-${year}.pdf`,
    contentType: "application/pdf",
  };
}
