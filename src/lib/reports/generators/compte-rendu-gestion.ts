import { prisma } from "@/lib/prisma";
import type { ReportOptions, ReportResult, ColAlign } from "../types";
import { CW } from "../constants";
import { initPdf, drawCoverPage, pdfCur, contentStartY, minY } from "../pdf-core";
import {
  drawSectionHeader,
  drawTableHeader,
  drawTableRow,
  drawTotalsRow,
  drawKpiRow,
  drawEmptyMessage,
} from "../pdf-helpers";
import { CORAL, GREEN } from "../constants";
import {
  getOutstandingAmount,
  REPORT_ACTIVE_INVOICE_STATUSES,
  REPORT_REVENUE_INVOICE_TYPES,
} from "../invoice-metrics";

export async function generateCompteRenduGestion(opts: ReportOptions): Promise<ReportResult> {
  const { societyId } = opts;
  const year = opts.year ?? new Date().getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);

  const [society, invoices, payments, charges, balanceAdjustments, buildings] = await Promise.all([
    prisma.society.findUnique({ where: { id: societyId } }),
    prisma.invoice.findMany({
      where: {
        societyId,
        issueDate: { gte: from, lte: to },
        invoiceType: { in: [...REPORT_REVENUE_INVOICE_TYPES] },
        status: { in: [...REPORT_ACTIVE_INVOICE_STATUSES] },
      },
      include: {
        tenant: true,
        lease: { include: { lot: { select: { buildingId: true, number: true } } } },
        payments: { select: { amount: true, paidAt: true } },
      },
    }),
    prisma.payment.findMany({
      where: {
        paidAt: { gte: from, lte: to },
        invoice: {
          societyId,
          invoiceType: { in: [...REPORT_REVENUE_INVOICE_TYPES] },
          status: { in: [...REPORT_ACTIVE_INVOICE_STATUSES] },
        },
      },
      select: {
        amount: true,
        invoice: {
          select: {
            buildingId: true,
            tenantId: true,
            tenant: true,
            lease: { select: { lot: { select: { buildingId: true, number: true } } } },
          },
        },
      },
    }),
    prisma.charge.findMany({
      where: { societyId, date: { gte: from, lte: to } },
    }),
    prisma.tenantBalanceAdjustment.findMany({
      where: { societyId, dueDate: { lte: to } },
      include: {
        tenant: true,
        lease: { include: { lot: { select: { buildingId: true, number: true } } } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.building.findMany({
      where: { societyId },
      include: { lots: { select: { id: true } } },
    }),
  ]);

  if (!society) throw new Error("Société introuvable");

  const getInvoiceBuildingId = (invoice: { buildingId?: string | null; lease?: { lot?: { buildingId: string | null } | null } | null }) =>
    invoice.lease?.lot?.buildingId ?? invoice.buildingId ?? null;
  const getPaymentBuildingId = (payment: typeof payments[number]) =>
    payment.invoice.lease?.lot?.buildingId ?? payment.invoice.buildingId ?? null;
  const getAdjustmentBuildingId = (adjustment: typeof balanceAdjustments[number]) =>
    adjustment.lease?.lot?.buildingId ?? null;

  const paid = payments.reduce((s, p) => s + (p.amount ?? 0), 0);
  const adjustmentBalance = balanceAdjustments.reduce((s, adjustment) => s + adjustment.amount, 0);
  const pend = invoices.reduce((s, i) => s + getOutstandingAmount(i), 0) + adjustmentBalance;
  const totalInv = invoices.reduce((s, i) => s + i.totalTTC, 0);
  const tchg = charges.reduce((s, c) => s + c.amount, 0);

  const ctx = await initPdf(`Compte-rendu de gestion ${year}`, society.name, opts.society);

  // Cover page
  drawCoverPage(ctx, "Compte Rendu de Gestion", `Exercice ${year}`, [
    `Société : ${society.name}`,
    `Période : 01/01/${year} au 31/12/${year}`,
  ]);

  // Page 1: Summary KPIs
  let p = ctx.np();
  let y = contentStartY();

  if (invoices.length === 0 && charges.length === 0 && balanceAdjustments.length === 0) {
    drawEmptyMessage(p, ctx.reg, y, `Aucune donnée financière trouvée pour l'année ${year}.`);
  }

  y = drawSectionHeader(p, ctx.serifBold, y, `Synthèse ${year}`);
  y -= 4;
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Total facturé", pdfCur(totalInv));
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Loyers encaissés (payés)", pdfCur(paid), GREEN);
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Loyers en attente / retard", pdfCur(pend), pend > 0 ? CORAL : undefined);
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Total des charges", pdfCur(tchg));
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Résultat net (encaissé - charges)", pdfCur(paid - tchg));
  const recov = totalInv > 0 ? ((paid / totalInv) * 100).toFixed(1) + "%" : "N/A";
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Taux de recouvrement", recov);
  y -= 16;

  // Per-building summary
  y = drawSectionHeader(p, ctx.serifBold, y, "Détail par immeuble");
  const BW = [110, 40, 75, 75, 75, CW - 375];
  const BA: ColAlign[] = ["left", "right", "right", "right", "right", "right"];
  y = drawTableHeader(p, ctx.bold, y, ["Immeuble", "Lots", "Facturé", "Encaissé", "Charges", "En attente"], BW, BA);

  let ri = 0;
  for (const b of buildings) {
    if (y < minY()) {
      p = ctx.np();
      y = contentStartY();
      y = drawTableHeader(p, ctx.bold, y, ["Immeuble", "Lots", "Facturé", "Encaissé", "Charges", "En attente"], BW, BA);
    }
    const bi = invoices.filter((i) => getInvoiceBuildingId(i) === b.id);
    const bp = payments.filter((payment) => getPaymentBuildingId(payment) === b.id);
    const bc = charges.filter((c) => c.buildingId === b.id);
    const ba = balanceAdjustments.filter((adjustment) => getAdjustmentBuildingId(adjustment) === b.id);
    const bF = bi.reduce((s, i) => s + i.totalTTC, 0);
    const bP = bp.reduce((s, payment) => s + (payment.amount ?? 0), 0);
    const bC = bc.reduce((s, c) => s + c.amount, 0);
    const bOutstanding = bi.reduce((s, i) => s + getOutstandingAmount(i), 0)
      + ba.reduce((s, adjustment) => s + adjustment.amount, 0);
    y = drawTableRow(p, ctx.reg, y, [
      b.name, String(b.lots.length), pdfCur(bF), pdfCur(bP), pdfCur(bC), pdfCur(bOutstanding),
    ], BW, BA, { rowIndex: ri++ });
  }
  y = drawTotalsRow(p, ctx.bold, y, [
    "TOTAL", "", pdfCur(totalInv), pdfCur(paid), pdfCur(tchg), pdfCur(pend),
  ], BW, BA);

  // Page 2+: Per-building per-tenant detail
  for (const b of buildings) {
    const bi = invoices.filter((i) => getInvoiceBuildingId(i) === b.id);
    const bp = payments.filter((payment) => getPaymentBuildingId(payment) === b.id);
    const ba = balanceAdjustments.filter((adjustment) => getAdjustmentBuildingId(adjustment) === b.id);
    if (bi.length === 0 && bp.length === 0 && ba.length === 0) continue;

    if (y < 160) { p = ctx.np(); y = contentStartY(); }
    y = drawSectionHeader(p, ctx.serifBold, y, b.name);

    const DW = [100, 50, 80, 80, 80, CW - 390];
    const DA: ColAlign[] = ["left", "left", "right", "right", "right", "right"];
    y = drawTableHeader(p, ctx.bold, y, ["Locataire", "Lot", "Quittance", "Réglé", "Solde", "Statut"], DW, DA);

    // Group by tenant/building so yearly invoicing and cash receipts can differ cleanly.
    const byTenant = new Map<string, { invoices: typeof bi; payments: typeof bp; adjustments: typeof ba }>();
    for (const inv of bi) {
      const tid = inv.tenantId;
      if (!byTenant.has(tid)) byTenant.set(tid, { invoices: [], payments: [], adjustments: [] });
      byTenant.get(tid)!.invoices.push(inv);
    }
    for (const payment of bp) {
      const tid = payment.invoice.tenantId;
      if (!byTenant.has(tid)) byTenant.set(tid, { invoices: [], payments: [], adjustments: [] });
      byTenant.get(tid)!.payments.push(payment);
    }
    for (const adjustment of ba) {
      const tid = adjustment.tenantId;
      if (!byTenant.has(tid)) byTenant.set(tid, { invoices: [], payments: [], adjustments: [] });
      byTenant.get(tid)!.adjustments.push(adjustment);
    }

    let dri = 0;
    let bTotal = 0, bPaid = 0, bOutstanding = 0;
    for (const [, tenantActivity] of byTenant) {
      const tInvoices = tenantActivity.invoices;
      const tPayments = tenantActivity.payments;
      const tAdjustments = tenantActivity.adjustments;
      const firstInvoice = tInvoices[0];
      const firstPayment = tPayments[0];
      const firstAdjustment = tAdjustments[0];
      const tenant = firstInvoice?.tenant ?? firstPayment?.invoice.tenant ?? firstAdjustment?.tenant;
      const tn = tenant.entityType === "PERSONNE_MORALE"
        ? (tenant.companyName ?? "-")
        : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "-";
      const lotNum = firstInvoice?.lease?.lot?.number ?? firstPayment?.invoice.lease?.lot?.number ?? firstAdjustment?.lease?.lot?.number ?? "-";
      // Une reprise réconciliée (adjustment.isReconciled) est soldée par un
      // virement bancaire hors Payment ; il ne faut plus la compter dans le
      // solde restant. Sans ce filtre, une reprise soldée apparaissait à la
      // fois en dette et en encaissée fantôme (incident APRIS 62 : solde
      // affiché 7 971,50 € au lieu de 3 696,21 €).
      const quittance = tInvoices.reduce((s, i) => s + i.totalTTC, 0);
      const regle = tPayments.reduce((s, payment) => s + (payment.amount ?? 0), 0);
      const solde = tInvoices.reduce((s, i) => s + getOutstandingAmount(i), 0)
        + tAdjustments
          .filter((a) => !a.isReconciled)
          .reduce((s, a) => s + a.amount, 0);
      bTotal += quittance;
      bPaid += regle;
      bOutstanding += solde;

      if (y < minY()) {
        p = ctx.np();
        y = contentStartY();
        y = drawTableHeader(p, ctx.bold, y, ["Locataire", "Lot", "Quittance", "Réglé", "Solde", "Statut"], DW, DA);
      }

      y = drawTableRow(p, ctx.reg, y, [
        tn, lotNum, pdfCur(quittance), pdfCur(regle), pdfCur(solde),
        solde > 0 ? "Impayé" : "Soldé",
      ], DW, DA, {
        rowIndex: dri++,
        cellColors: [null, null, null, null, solde > 0 ? CORAL : GREEN, solde > 0 ? CORAL : GREEN],
      });
    }
    y = drawTotalsRow(p, ctx.bold, y, [
      "SOUS-TOTAL", "", pdfCur(bTotal), pdfCur(bPaid), pdfCur(bOutstanding), "",
    ], DW, DA);
    y -= 10;
  }

  return {
    buffer: await ctx.save(),
    filename: `compte-rendu-gestion-${year}.pdf`,
    contentType: "application/pdf",
  };
}
