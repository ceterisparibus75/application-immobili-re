/* eslint-disable @typescript-eslint/no-explicit-any */
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

export async function generateCompteRenduGestion(opts: ReportOptions): Promise<ReportResult> {
  const { societyId } = opts;
  const year = opts.year ?? new Date().getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);

  const [society, invoices, charges, buildings] = await Promise.all([
    prisma.society.findUnique({ where: { id: societyId } }),
    prisma.invoice.findMany({
      where: { societyId, issueDate: { gte: from, lte: to }, invoiceType: { not: "AVOIR" } },
      include: {
        tenant: true,
        lease: { include: { lot: { select: { buildingId: true, number: true } } } },
        payments: true,
      },
    }),
    prisma.charge.findMany({
      where: { societyId, date: { gte: from, lte: to } },
    }),
    prisma.building.findMany({
      where: { societyId },
      include: { lots: { select: { id: true } } },
    }),
  ]);

  if (!society) throw new Error("Societe introuvable");

  const paid = invoices.filter((i) => i.status === "PAYE").reduce((s, i) => s + i.totalTTC, 0);
  const pend = invoices.filter((i) => i.status !== "PAYE").reduce((s, i) => s + i.totalTTC, 0);
  const totalInv = invoices.reduce((s, i) => s + i.totalTTC, 0);
  const tchg = charges.reduce((s, c) => s + c.amount, 0);

  const ctx = await initPdf(`Compte-rendu de gestion ${year}`, society.name, opts.society);

  // Cover page
  drawCoverPage(ctx, "Compte Rendu de Gestion", `Exercice ${year}`, [
    `Societe : ${society.name}`,
    `Periode : 01/01/${year} au 31/12/${year}`,
  ]);

  // Page 1: Summary KPIs
  let p = ctx.np();
  let y = contentStartY();

  if (invoices.length === 0 && charges.length === 0) {
    drawEmptyMessage(p, ctx.reg, y, `Aucune donnee financiere trouvee pour l'annee ${year}.`);
  }

  y = drawSectionHeader(p, ctx.bold, y, `Synthese ${year}`);
  y -= 4;
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Total facture", pdfCur(totalInv));
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Loyers encaisses (payes)", pdfCur(paid), GREEN);
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Loyers en attente / retard", pdfCur(pend), pend > 0 ? CORAL : undefined);
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Total des charges", pdfCur(tchg));
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Resultat net (encaisse - charges)", pdfCur(paid - tchg));
  const recov = totalInv > 0 ? ((paid / totalInv) * 100).toFixed(1) + "%" : "N/A";
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Taux de recouvrement", recov);
  y -= 16;

  // Per-building summary
  y = drawSectionHeader(p, ctx.bold, y, "Detail par immeuble");
  const BW = [110, 40, 75, 75, 75, CW - 375];
  const BA: ColAlign[] = ["left", "right", "right", "right", "right", "right"];
  y = drawTableHeader(p, ctx.bold, y, ["Immeuble", "Lots", "Facture", "Encaisse", "Charges", "En attente"], BW, BA);

  let ri = 0;
  for (const b of buildings) {
    if (y < minY()) {
      p = ctx.np();
      y = contentStartY();
      y = drawTableHeader(p, ctx.bold, y, ["Immeuble", "Lots", "Facture", "Encaisse", "Charges", "En attente"], BW, BA);
    }
    const bi = invoices.filter((i) => i.lease?.lot?.buildingId === b.id);
    const bc = charges.filter((c) => (c as any).buildingId === b.id);
    const bF = bi.reduce((s, i) => s + i.totalTTC, 0);
    const bP = bi.filter((i) => i.status === "PAYE").reduce((s, i) => s + i.totalTTC, 0);
    const bC = bc.reduce((s, c) => s + c.amount, 0);
    y = drawTableRow(p, ctx.reg, y, [
      b.name, String(b.lots.length), pdfCur(bF), pdfCur(bP), pdfCur(bC), pdfCur(bF - bP),
    ], BW, BA, { rowIndex: ri++ });
  }
  y = drawTotalsRow(p, ctx.bold, y, [
    "TOTAL", "", pdfCur(totalInv), pdfCur(paid), pdfCur(tchg), pdfCur(pend),
  ], BW, BA);

  // Page 2+: Per-building per-tenant detail
  for (const b of buildings) {
    const bi = invoices.filter((i) => i.lease?.lot?.buildingId === b.id);
    if (bi.length === 0) continue;

    if (y < 160) { p = ctx.np(); y = contentStartY(); }
    y = drawSectionHeader(p, ctx.bold, y, b.name);

    const DW = [100, 50, 80, 80, 80, CW - 390];
    const DA: ColAlign[] = ["left", "left", "right", "right", "right", "right"];
    y = drawTableHeader(p, ctx.bold, y, ["Locataire", "Lot", "Quittance", "Regle", "Solde", "Statut"], DW, DA);

    // Group by tenant
    const byTenant = new Map<string, typeof bi>();
    for (const inv of bi) {
      const tid = inv.tenantId;
      if (!byTenant.has(tid)) byTenant.set(tid, []);
      byTenant.get(tid)!.push(inv);
    }

    let dri = 0;
    let bTotal = 0, bPaid = 0;
    for (const [, tInvoices] of byTenant) {
      const tenant = tInvoices[0].tenant;
      const tn = tenant.entityType === "PERSONNE_MORALE"
        ? (tenant.companyName ?? "-")
        : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "-";
      const lotNum = tInvoices[0].lease?.lot?.number ?? "-";
      const quittance = tInvoices.reduce((s, i) => s + i.totalTTC, 0);
      const regle = tInvoices
        .flatMap((i) => (i as any).payments ?? [])
        .reduce((s: number, pay: any) => s + (pay.amount ?? 0), 0);
      const solde = quittance - regle;
      bTotal += quittance;
      bPaid += regle;

      if (y < minY()) {
        p = ctx.np();
        y = contentStartY();
        y = drawTableHeader(p, ctx.bold, y, ["Locataire", "Lot", "Quittance", "Regle", "Solde", "Statut"], DW, DA);
      }

      y = drawTableRow(p, ctx.reg, y, [
        tn, lotNum, pdfCur(quittance), pdfCur(regle), pdfCur(solde),
        solde > 0 ? "Impaye" : "Solde",
      ], DW, DA, {
        rowIndex: dri++,
        cellColors: [null, null, null, null, solde > 0 ? CORAL : GREEN, solde > 0 ? CORAL : GREEN],
      });
    }
    y = drawTotalsRow(p, ctx.bold, y, [
      "SOUS-TOTAL", "", pdfCur(bTotal), pdfCur(bPaid), pdfCur(bTotal - bPaid), "",
    ], DW, DA);
    y -= 10;
  }

  return {
    buffer: await ctx.save(),
    filename: `compte-rendu-gestion-${year}.pdf`,
    contentType: "application/pdf",
  };
}
