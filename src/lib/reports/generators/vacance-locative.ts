import { prisma } from "@/lib/prisma";
import type { ReportOptions, ReportResult, ColAlign } from "../types";
import { CW, CORAL, GREEN, CHART_COLORS } from "../constants";
import { initPdf, drawCoverPage, pdfCur, contentStartY, minY } from "../pdf-core";
import {
  drawSectionHeader,
  drawTableHeader,
  drawTableRow,
  drawTotalsRow,
  drawKpiRow,
} from "../pdf-helpers";
import { drawPieChart, drawBarChart } from "../pdf-charts";

export async function generateVacanceLocative(opts: ReportOptions): Promise<ReportResult> {
  const { societyId, buildingId } = opts;

  const buildings = await prisma.building.findMany({
    where: { societyId, ...(buildingId ? { id: buildingId } : {}) },
    include: {
      lots: {
        include: {
          leases: {
            where: { status: { in: ["EN_COURS", "RENOUVELE"] } },
            take: 1,
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const ctx = await initPdf("Vacance locative", "Taux d'occupation et de vacance", opts.society);

  drawCoverPage(ctx, "Vacance Locative", "Analyse de l'occupation du patrimoine", [
    `Société : ${opts.society?.name ?? ""}`,
    `Date : ${new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`,
  ]);

  // Aggregate stats
  let totalLots = 0, totalOcc = 0, totalVac = 0;
  let totalSurface = 0, occSurface = 0, vacSurface = 0;
  const buildingStats: { name: string; lots: number; occ: number; vac: number; vacRate: number; surface: number; vacSurface: number }[] = [];

  for (const b of buildings) {
    const occ = b.lots.filter((l) => l.leases.length > 0).length;
    const vac = b.lots.length - occ;
    const bSurface = b.lots.reduce((s, l) => s + ((l as any).area ?? 0), 0);
    const bVacSurface = b.lots.filter((l) => l.leases.length === 0).reduce((s, l) => s + ((l as any).area ?? 0), 0);
    totalLots += b.lots.length;
    totalOcc += occ;
    totalVac += vac;
    totalSurface += bSurface;
    occSurface += bSurface - bVacSurface;
    vacSurface += bVacSurface;
    buildingStats.push({
      name: b.name,
      lots: b.lots.length,
      occ,
      vac,
      vacRate: b.lots.length > 0 ? (vac / b.lots.length) * 100 : 0,
      surface: bSurface,
      vacSurface: bVacSurface,
    });
  }

  let p = ctx.np();
  let y = contentStartY();

  // KPIs
  y = drawSectionHeader(p, ctx.serifBold, y, "Synthèse globale");
  y -= 4;
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Total lots", String(totalLots));
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Lots occupés", String(totalOcc), GREEN);
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Lots vacants", String(totalVac), totalVac > 0 ? CORAL : GREEN);
  const globalVacRate = totalLots > 0 ? (totalVac / totalLots) * 100 : 0;
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Taux de vacance", globalVacRate.toFixed(1) + "%", globalVacRate > 10 ? CORAL : GREEN);
  if (totalSurface > 0) {
    y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Surface totale", totalSurface.toFixed(0) + " m2");
    y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Surface vacante", vacSurface.toFixed(0) + " m2", vacSurface > 0 ? CORAL : GREEN);
  }
  y -= 16;

  // Pie chart: occupation by lot count
  y = drawSectionHeader(p, ctx.serifBold, y, "Répartition par nombre de lots");
  y -= 8;
  y = drawPieChart(p, 150, y - 60, 55, [
    { value: totalOcc, label: "Occupés", color: CHART_COLORS[0] },
    { value: totalVac, label: "Vacants", color: CHART_COLORS[2] },
  ], ctx.reg, ctx.bold);
  y -= 16;

  // Pie chart: occupation by surface (if data available)
  if (totalSurface > 0) {
    if (y < 200) { p = ctx.np(); y = contentStartY(); }
    y = drawSectionHeader(p, ctx.serifBold, y, "Répartition par surface");
    y -= 8;
    y = drawPieChart(p, 150, y - 60, 55, [
      { value: occSurface, label: "Occupée", color: CHART_COLORS[0] },
      { value: vacSurface, label: "Vacante", color: CHART_COLORS[2] },
    ], ctx.reg, ctx.bold);
    y -= 16;
  }

  // Per-building table
  if (y < 160) { p = ctx.np(); y = contentStartY(); }
  y = drawSectionHeader(p, ctx.serifBold, y, "Détail par immeuble");
  const WS = [120, 50, 55, 55, 60, 60, CW - 400];
  const WA: ColAlign[] = ["left", "right", "right", "right", "right", "right", "right"];
  y = drawTableHeader(p, ctx.bold, y, ["Immeuble", "Lots", "Occupés", "Vacants", "Taux vac.", "Surface", "Surf. vac."], WS, WA);

  let ri = 0;
  for (const bs of buildingStats) {
    if (y < minY()) {
      p = ctx.np();
      y = contentStartY();
      y = drawTableHeader(p, ctx.bold, y, ["Immeuble", "Lots", "Occupés", "Vacants", "Taux vac.", "Surface", "Surf. vac."], WS, WA);
    }
    y = drawTableRow(p, ctx.reg, y, [
      bs.name,
      String(bs.lots),
      String(bs.occ),
      String(bs.vac),
      bs.vacRate.toFixed(1) + "%",
      bs.surface > 0 ? bs.surface.toFixed(0) + " m2" : "-",
      bs.vacSurface > 0 ? bs.vacSurface.toFixed(0) + " m2" : "-",
    ], WS, WA, {
      rowIndex: ri++,
      cellColors: [null, null, null, bs.vac > 0 ? CORAL : null, bs.vacRate > 10 ? CORAL : GREEN, null, bs.vacSurface > 0 ? CORAL : null],
    });
  }
  y = drawTotalsRow(p, ctx.bold, y, [
    "TOTAL",
    String(totalLots),
    String(totalOcc),
    String(totalVac),
    globalVacRate.toFixed(1) + "%",
    totalSurface > 0 ? totalSurface.toFixed(0) + " m2" : "-",
    vacSurface > 0 ? vacSurface.toFixed(0) + " m2" : "-",
  ], WS, WA);

  // Bar chart: vacancy rate per building
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
    filename: `vacance-locative-${new Date().toISOString().slice(0, 10)}.pdf`,
    contentType: "application/pdf",
  };
}
