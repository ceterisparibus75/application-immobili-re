/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import type { PaymentFrequency } from "@/generated/prisma/client";
import type { ReportOptions, ReportResult, ColAlign } from "../types";
import { CW, MRG, BLACK, GRAY, CORAL, GREEN, CHART_COLORS } from "../constants";
import { initPdf, drawCoverPage, pdfCur, contentStartY, minY } from "../pdf-core";
import {
  drawSectionHeader,
  drawTableHeader,
  drawTableRow,
  drawTotalsRow,
  drawKpiRow,
  drawEmptyMessage,
} from "../pdf-helpers";
import { drawPieChart, drawBarChart } from "../pdf-charts";
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

function hhi(shares: number[]): number {
  const total = shares.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  return shares.reduce((s, v) => s + Math.pow((v / total) * 100, 2), 0);
}
function hhiLabel(score: number): string {
  if (score >= 2500) return "Risque élevé";
  if (score >= 1500) return "Risque modéré";
  return "Risque faible";
}

// Partie 1 : colonnes tableau principal (Part % remplace Évol.%)
const HEADERS = ["Étage", "Lot", "Type", "m2", "Locataire", "Effet", "Loyer an. HT", "% imm.", "Loyer/m2", "Prov. ann."];
const WIDTHS  = [28, 32, 45, 30, 90, 48, 60, 36, 42, CW - 411];
const ALIGNS: ColAlign[] = ["left", "left", "left", "right", "left", "left", "right", "right", "right", "right"];

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

  const ctx = await initPdf("Situation locative", "État des lots, baux actifs et vacance", opts.society);

  drawCoverPage(ctx, "Situation locative", "État des lots, baux actifs et vacance du patrimoine", [
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

  // ══════════════════════════════════════════════════════════════
  // PARTIE 1 — Situation locative
  // ══════════════════════════════════════════════════════════════
  y = drawSectionHeader(p, ctx.serifBold, y, "PARTIE 1 — Situation locative");
  y -= 10;

  type TenantEntry = { name: string; buildingName: string; loyer: number };
  const globalTenants: TenantEntry[] = [];

  for (const b of buildings) {
    if (y < 160) { p = ctx.np(); y = contentStartY(); }

    // Pre-compute building total loyer to show % per row
    const bTotalLoyer = b.lots.reduce((s, lot) => {
      const lease = lot.leases[0];
      if (!lease) return s;
      return s + lease.currentRentHT * periodsPerYear(lease.paymentFrequency);
    }, 0);

    y = drawSectionHeader(p, ctx.serifBold, y, `${b.name} — ${b.lots.length} lot(s)`);
    y -= 8;
    y = drawTableHeader(p, ctx.bold, y, HEADERS, WIDTHS, ALIGNS);

    let totalLoyer = 0;
    let totalSurface = 0;
    let totalProv = 0;
    let lotCount = 0;
    let occupiedLotCount = 0;
    let loyerM2Sum = 0;
    let loyerM2Count = 0;

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
      const provChargesMonthly = lease?.chargeProvisions?.reduce((s: number, cp: any) => s + cp.monthlyAmount, 0) ?? 0;
      const provCharges = provChargesMonthly * 12;
      const partPct = bTotalLoyer > 0 && lease ? (loyerAnnuel / bTotalLoyer * 100).toFixed(1) + "%" : "-";

      totalLoyer += loyerAnnuel;
      totalSurface += area;
      totalProv += provCharges;
      lotCount++;
      if (lease) {
        occupiedLotCount++;
        globalTenants.push({ name: tenantName, buildingName: b.name, loyer: loyerAnnuel });
      }
      if (loyerM2 > 0) { loyerM2Sum += loyerM2; loyerM2Count++; }

      y = drawTableRow(p, ctx.reg, y, [
        (lot as any).floor ?? "-",
        lot.number,
        lot.lotType.replace(/_/g, " "),
        area > 0 ? area.toFixed(0) : "-",
        tenantName,
        lease?.startDate ? formatDate(new Date(lease.startDate)) : "-",
        lease ? pdfCur(loyerAnnuel) : "-",
        partPct,
        loyerM2 > 0 ? pdfCur(loyerM2) : "-",
        provCharges > 0 ? pdfCur(provCharges) : "-",
      ], WIDTHS, ALIGNS, { rowIndex: lotCount - 1 });
    }

    if (y < minY() + 24) { p = ctx.np(); y = contentStartY(); }
    y = drawTotalsRow(p, ctx.bold, y, [
      "TOTAUX", "", "", totalSurface > 0 ? totalSurface.toFixed(0) : "", "",
      "", pdfCur(totalLoyer), "100%", loyerM2Count > 0 ? pdfCur(loyerM2Sum / loyerM2Count) + " (moy.)" : "", totalProv > 0 ? pdfCur(totalProv) : "",
    ], WIDTHS, ALIGNS);

    y -= 14;
  }

  // Synthèse risque — concentration locative
  if (globalTenants.length > 0) {
    if (y < 200) { p = ctx.np(); y = contentStartY(); }
    const GLOB_HEADERS = ["Locataire", "Immeuble", "Loyer an. HT", "Part société"];
    const GLOB_WIDTHS: number[] = [140, 160, 70, CW - 370];
    const GLOB_ALIGNS: ColAlign[] = ["left", "left", "right", "right"];
    y = drawSectionHeader(p, ctx.serifBold, y, "Synthèse — Concentration du risque locatif");
    y -= 6;
    y = drawTableHeader(p, ctx.bold, y, GLOB_HEADERS, GLOB_WIDTHS, GLOB_ALIGNS);
    const totalGlobal = globalTenants.reduce((s, t) => s + t.loyer, 0);
    [...globalTenants].sort((a, b) => b.loyer - a.loyer).forEach((t, idx) => {
      if (y < minY()) { p = ctx.np(); y = contentStartY(); y = drawTableHeader(p, ctx.bold, y, GLOB_HEADERS, GLOB_WIDTHS, GLOB_ALIGNS); }
      y = drawTableRow(p, ctx.reg, y, [t.name, t.buildingName, pdfCur(t.loyer), (t.loyer / totalGlobal * 100).toFixed(1) + "%"], GLOB_WIDTHS, GLOB_ALIGNS, { rowIndex: idx });
    });
    y = drawTotalsRow(p, ctx.bold, y, ["TOTAL", "", pdfCur(totalGlobal), "100%"], GLOB_WIDTHS, GLOB_ALIGNS);
    const globalHhi = hhi(globalTenants.map((t) => t.loyer));
    y -= 8;
    const hhiColor = globalHhi >= 2500 ? CORAL : globalHhi >= 1500 ? BLACK : GRAY;
    p.drawText(`Indice HHI : ${Math.round(globalHhi)} — ${hhiLabel(globalHhi)}`, { x: MRG + 6, y, size: 9, font: ctx.bold, color: hhiColor });
    y -= 14;
    const top = [...globalTenants].sort((a, b) => b.loyer - a.loyer)[0];
    p.drawText(`1er locataire : ${top.name} — ${(top.loyer / totalGlobal * 100).toFixed(1)}% du loyer total`, { x: MRG + 6, y, size: 8, font: ctx.reg, color: BLACK });
    y -= 20;
  }

  // ══════════════════════════════════════════════════════════════
  // PARTIE 2 — Vacance locative et financière
  // ══════════════════════════════════════════════════════════════
  if (y < 200) { p = ctx.np(); y = contentStartY(); }
  else y -= 10;

  y = drawSectionHeader(p, ctx.serifBold, y, "PARTIE 2 — Vacance locative et financière");
  y -= 10;

  let totalLots = 0, totalOcc = 0, totalVac = 0;
  let totalSurface2 = 0, occSurface = 0, vacSurface = 0;
  const buildingStats: { name: string; lots: number; occ: number; vac: number; vacRate: number; surface: number; vacSurface: number }[] = [];

  for (const b of buildings) {
    const occ = b.lots.filter((l) => l.leases.length > 0).length;
    const vac = b.lots.length - occ;
    const bSurface = b.lots.reduce((s, l) => s + ((l as any).area ?? 0), 0);
    const bVacSurface = b.lots.filter((l) => l.leases.length === 0).reduce((s, l) => s + ((l as any).area ?? 0), 0);
    totalLots += b.lots.length;
    totalOcc += occ;
    totalVac += vac;
    totalSurface2 += bSurface;
    occSurface += bSurface - bVacSurface;
    vacSurface += bVacSurface;
    buildingStats.push({ name: b.name, lots: b.lots.length, occ, vac, vacRate: b.lots.length > 0 ? (vac / b.lots.length) * 100 : 0, surface: bSurface, vacSurface: bVacSurface });
  }

  y = drawSectionHeader(p, ctx.serifBold, y, "Synthèse globale");
  y -= 4;
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Total lots", String(totalLots));
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Lots occupés", String(totalOcc), GREEN);
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Lots vacants", String(totalVac), totalVac > 0 ? CORAL : GREEN);
  const globalVacRate = totalLots > 0 ? (totalVac / totalLots) * 100 : 0;
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Taux de vacance", globalVacRate.toFixed(1) + "%", globalVacRate > 10 ? CORAL : GREEN);
  if (totalSurface2 > 0) {
    y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Surface totale", totalSurface2.toFixed(0) + " m2");
    y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Surface vacante", vacSurface.toFixed(0) + " m2", vacSurface > 0 ? CORAL : GREEN);
  }
  y -= 16;

  y = drawSectionHeader(p, ctx.serifBold, y, "Répartition occupation / vacance");
  y -= 8;
  y = drawPieChart(p, 150, y - 60, 55, [
    { value: totalOcc, label: "Occupés", color: CHART_COLORS[0] },
    { value: totalVac, label: "Vacants", color: CHART_COLORS[2] },
  ], ctx.reg, ctx.bold);
  y -= 16;

  if (totalSurface2 > 0) {
    if (y < 200) { p = ctx.np(); y = contentStartY(); }
    y = drawSectionHeader(p, ctx.serifBold, y, "Répartition par surface");
    y -= 8;
    y = drawPieChart(p, 150, y - 60, 55, [
      { value: occSurface, label: "Occupée", color: CHART_COLORS[0] },
      { value: vacSurface, label: "Vacante", color: CHART_COLORS[2] },
    ], ctx.reg, ctx.bold);
    y -= 16;
  }

  if (y < 160) { p = ctx.np(); y = contentStartY(); }
  y = drawSectionHeader(p, ctx.serifBold, y, "Détail par immeuble");
  const WS: number[] = [120, 50, 55, 55, 60, 60, CW - 400];
  const WA: ColAlign[] = ["left", "right", "right", "right", "right", "right", "right"];
  y = drawTableHeader(p, ctx.bold, y, ["Immeuble", "Lots", "Occupés", "Vacants", "Taux vac.", "Surface", "Surf. vac."], WS, WA);
  let ri = 0;
  for (const bs of buildingStats) {
    if (y < minY()) { p = ctx.np(); y = contentStartY(); y = drawTableHeader(p, ctx.bold, y, ["Immeuble", "Lots", "Occupés", "Vacants", "Taux vac.", "Surface", "Surf. vac."], WS, WA); }
    y = drawTableRow(p, ctx.reg, y, [
      bs.name, String(bs.lots), String(bs.occ), String(bs.vac),
      bs.vacRate.toFixed(1) + "%",
      bs.surface > 0 ? bs.surface.toFixed(0) + " m2" : "-",
      bs.vacSurface > 0 ? bs.vacSurface.toFixed(0) + " m2" : "-",
    ], WS, WA, { rowIndex: ri++, cellColors: [null, null, null, bs.vac > 0 ? CORAL : null, bs.vacRate > 10 ? CORAL : GREEN, null, bs.vacSurface > 0 ? CORAL : null] });
  }
  y = drawTotalsRow(p, ctx.bold, y, [
    "TOTAL", String(totalLots), String(totalOcc), String(totalVac),
    globalVacRate.toFixed(1) + "%",
    totalSurface2 > 0 ? totalSurface2.toFixed(0) + " m2" : "-",
    vacSurface > 0 ? vacSurface.toFixed(0) + " m2" : "-",
  ], WS, WA);

  if (buildingStats.length > 1) {
    if (y < 200) { p = ctx.np(); y = contentStartY(); }
    y = drawSectionHeader(p, ctx.serifBold, y, "Taux de vacance par immeuble");
    y -= 8;
    y = drawBarChart(p, 50, y, 300, buildingStats.map((bs) => ({
      label: bs.name,
      value: bs.vacRate,
      color: bs.vacRate > 10 ? CORAL : GREEN,
    })), ctx.reg, ctx.bold);
  }

  return {
    buffer: await ctx.save(),
    filename: `situation-locative-${new Date().toISOString().slice(0, 10)}.pdf`,
    contentType: "application/pdf",
  };
}
