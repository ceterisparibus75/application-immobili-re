/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import type { PaymentFrequency } from "@/generated/prisma/client";
import type { ReportOptions, ReportResult, ColAlign } from "../types";
import { CW, CORAL, GREEN, CHART_COLORS } from "../constants";
import { initPdf, drawCoverPage, pdfCur, contentStartY, minY } from "../pdf-core";
import {
  drawSectionHeader,
  drawTableHeader,
  drawTableRow,
  drawTotalsRow,
  drawMoyennesRow,
  drawSubText,
  drawEmptyMessage,
} from "../pdf-helpers";

import { getActiveLeaseWhere } from "../lease-scope";

function periodsPerYear(freq: PaymentFrequency): number {
  switch (freq) {
    case "ANNUEL": return 1;
    case "SEMESTRIEL": return 2;
    case "TRIMESTRIEL": return 4;
    case "MENSUEL":
    default: return 12;
  }
}

// Colonnes du tableau principal (11 colonnes)
const HEADERS = ["Étage", "Lot", "Type", "m2", "Locataire", "Effet", "Loyer an. HT", "Évol.%", "Loyer/m2", "Valeur marché", "Prov. mens."];
const WIDTHS  = [28, 32, 45, 30, 90, 48, 60, 36, 42, 56, CW - 467];
const ALIGNS: ColAlign[] = ["left", "left", "left", "right", "left", "left", "right", "right", "right", "right", "right"];

export async function generateSituationLocative(opts: ReportOptions): Promise<ReportResult> {
  const { societyId, buildingId } = opts;
  const asOf = new Date();

  const buildings = await prisma.building.findMany({
    where: { societyId, ...(buildingId ? { id: buildingId } : {}) },
    include: {
      lots: {
        include: {
          leases: {
            where: getActiveLeaseWhere(asOf),
            include: {
              tenant: true,
              chargeProvisions: {
                where: {
                  isActive: true,
                  startDate: { lte: asOf },
                  OR: [{ endDate: null }, { endDate: { gte: asOf } }],
                },
              },
            },
            take: 1,
            orderBy: { startDate: "desc" },
          },
        },
        orderBy: { number: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const ctx = await initPdf("Situation locative", "État des lots et baux actifs", opts.society);

  drawCoverPage(ctx, "Situation Locative", "État des lots et baux actifs", [
    `Société : ${opts.society?.name ?? ""}`,
    `Date : ${new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`,
    buildingId ? `Immeuble filtré` : `Tous les immeubles`,
  ]);

  let p = ctx.np();
  let y = contentStartY();

  if (buildings.length === 0) {
    drawEmptyMessage(p, ctx.reg, y, "Aucun immeuble trouvé pour cette société.");
    return { buffer: await ctx.save(), filename: `situation-locative-${new Date().toISOString().slice(0, 10)}.pdf`, contentType: "application/pdf" };
  }

  // Synthèse globale par immeuble
  for (const b of buildings) {
    if (y < 160) { p = ctx.np(); y = contentStartY(); }

    y = drawSectionHeader(p, ctx.serifBold, y, `${b.name} — ${b.lots.length} lot(s)`);
    y -= 4;

    let totalLoyer = 0;
    let totalSurface = 0;
    let totalProvMonthly = 0;
    let totalMarket = 0;
    let lotCount = 0;
    let occupiedLotCount = 0;
    let loyerM2Sum = 0;
    let loyerM2Count = 0;
    let evolSum = 0;
    let evolCount = 0;

    // Pré-calcul occupation/loyer pour le sous-texte
    const occLots = b.lots.filter((lot: any) => (lot.leases?.length ?? 0) > 0);
    for (const lot of occLots) {
      const lease = lot.leases[0];
      totalLoyer += lease.currentRentHT * periodsPerYear(lease.paymentFrequency);
    }
    y = drawSubText(p, ctx.reg, y, `Occupation : ${occLots.length}/${b.lots.length} | Loyers annuels HC : ${pdfCur(totalLoyer)}`);

    // Reset accumulateurs pour parcourir et afficher
    totalLoyer = 0;

    y = drawTableHeader(p, ctx.bold, y, HEADERS, WIDTHS, ALIGNS);

    for (const lot of b.lots) {
      if (y < minY()) {
        p = ctx.np();
        y = contentStartY();
        y = drawTableHeader(p, ctx.bold, y, HEADERS, WIDTHS, ALIGNS);
      }

      const lease = lot.leases[0];
      const tenantName = lease?.tenant
        ? lease.tenant.entityType === "PERSONNE_MORALE"
          ? (lease.tenant.companyName ?? "-")
          : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim() || "-"
        : "Vacant";

      const area = (lot as any).area ?? 0;
      const freq = lease?.paymentFrequency ?? "MENSUEL";
      const periods = periodsPerYear(freq);
      const loyerAnnuel = (lease?.currentRentHT ?? 0) * periods;
      const loyerMensuel = lease ? lease.currentRentHT * periods / 12 : 0;
      const loyerM2 = area > 0 && lease ? loyerMensuel / area : 0;
      const provMonthly = lease?.chargeProvisions?.reduce((s: number, cp: any) => s + cp.monthlyAmount, 0) ?? 0;
      const marketRent = (lot as any).marketRentValue ?? 0;
      const baseRent = (lease as any)?.baseRentHT ?? 0;
      const evolPct = lease && baseRent > 0
        ? ((lease.currentRentHT / baseRent) - 1) * 100
        : null;

      totalLoyer += loyerAnnuel;
      totalSurface += area;
      totalProvMonthly += provMonthly;
      totalMarket += marketRent;
      lotCount++;
      if (lease) {
        occupiedLotCount++;
      }
      if (loyerM2 > 0) { loyerM2Sum += loyerM2; loyerM2Count++; }
      if (evolPct !== null) { evolSum += evolPct; evolCount++; }

      y = drawTableRow(p, ctx.reg, y, [
        (lot as any).floor ?? "-",
        lot.number,
        lot.lotType.replace(/_/g, " "),
        area > 0 ? area.toFixed(0) : "-",
        tenantName,
        lease?.startDate ? formatDate(new Date(lease.startDate)) : "-",
        lease ? pdfCur(loyerAnnuel) : "-",
        evolPct !== null ? evolPct.toFixed(1) + "%" : "-",
        loyerM2 > 0 ? pdfCur(loyerM2) : "-",
        marketRent > 0 ? pdfCur(marketRent) : "-",
        provMonthly > 0 ? pdfCur(provMonthly) : "-",
      ], WIDTHS, ALIGNS, { rowIndex: lotCount - 1 });
    }

    if (y < minY() + 24) { p = ctx.np(); y = contentStartY(); }
    y = drawTotalsRow(p, ctx.bold, y, [
      "TOTAUX", "", "",
      totalSurface > 0 ? totalSurface.toFixed(0) : "",
      "", "",
      pdfCur(totalLoyer),
      "",
      "",
      totalMarket > 0 ? pdfCur(totalMarket) : "",
      totalProvMonthly > 0 ? pdfCur(totalProvMonthly) : "",
    ], WIDTHS, ALIGNS);

    if (y < minY() + 24) { p = ctx.np(); y = contentStartY(); }
    y = drawMoyennesRow(p, ctx.bold, y, [
      "MOYENNES", "", "", "", "", "",
      occupiedLotCount > 0 ? pdfCur(totalLoyer / occupiedLotCount) : "",
      evolCount > 0 ? (evolSum / evolCount).toFixed(1) + "%" : "-",
      loyerM2Count > 0 ? pdfCur(loyerM2Sum / loyerM2Count) : "-",
      "",
      "",
    ], WIDTHS, ALIGNS);

    y -= 14;
  }

  // Compute aggregate metrics (silently used for the (silenced) markers below)
  void GREEN; void CORAL; void CHART_COLORS;

  return {
    buffer: await ctx.save(),
    filename: `situation-locative-${new Date().toISOString().slice(0, 10)}.pdf`,
    contentType: "application/pdf",
  };
}
