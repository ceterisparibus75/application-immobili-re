/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import type { PaymentFrequency } from "@/generated/prisma/client";
import type { ReportOptions, ReportResult, ColAlign } from "../types";
import { CW, MRG, ROW_HEIGHT, BRAND_DEEP, BRAND_LIGHT, WHITE, BLACK, GRAY, CORAL } from "../constants";
import { initPdf, drawCoverPage, pdfCur, contentStartY, minY } from "../pdf-core";
import {
  drawSectionHeader,
  drawTableHeader,
  drawTableRow,
  drawTotalsRow,
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

const HEADERS = ["Étage", "Lot", "Type", "m2", "Locataire", "Effet", "Loyer an. HT", "Évol.%", "Loyer/m2", "Prov.ch."];
const WIDTHS  = [28, 32, 45, 30, 90, 48, 60, 36, 42, CW - 411];
const ALIGNS: ColAlign[] = ["left", "left", "left", "right", "left", "left", "right", "right", "right", "right"];

const PCT_HEADERS = ["Locataire", "Loyer an. HT", "Part immeuble"];
const PCT_WIDTHS: number[] = [160, 70, CW - 230];
const PCT_ALIGNS: ColAlign[] = ["left", "right", "right"];

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

  const ctx = await initPdf("Situation locative", "État des lots et baux actifs par immeuble", opts.society);

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

  // Global data for end-of-report synthesis
  type TenantEntry = { name: string; buildingName: string; loyer: number };
  const globalTenants: TenantEntry[] = [];

  for (const b of buildings) {
    if (y < 160) { p = ctx.np(); y = contentStartY(); }

    y = drawSectionHeader(p, ctx.serifBold, y, `${b.name} - ${b.lots.length} lot(s)`);
    y -= 8;
    y = drawTableHeader(p, ctx.bold, y, HEADERS, WIDTHS, ALIGNS);

    let totalLoyer = 0;
    let totalSurface = 0;
    let totalProv = 0;
    let lotCount = 0;
    let occupiedLotCount = 0;
    let evolSum = 0;
    let evolCount = 0;
    let loyerM2Sum = 0;
    let loyerM2Count = 0;
    const buildingTenants: { name: string; loyer: number }[] = [];

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
      const baseRent = (lease as any)?.baseRentHT ?? lease?.currentRentHT ?? 0;
      const evol = baseRent > 0 ? ((lease!.currentRentHT - baseRent) / baseRent) * 100 : 0;
      const loyerMensuel = lease ? lease.currentRentHT * periods / 12 : 0;
      const loyerM2 = area > 0 && lease ? loyerMensuel / area : 0;
      const provCharges = lease?.chargeProvisions?.reduce((s: number, cp: any) => s + cp.monthlyAmount, 0) ?? 0;

      totalLoyer += loyerAnnuel;
      totalSurface += area;
      totalProv += provCharges;
      lotCount++;
      if (lease) {
        occupiedLotCount++;
        buildingTenants.push({ name: tenantName, loyer: loyerAnnuel });
        globalTenants.push({ name: tenantName, buildingName: b.name, loyer: loyerAnnuel });
      }
      if (evol !== 0) { evolSum += evol; evolCount++; }
      if (loyerM2 > 0) { loyerM2Sum += loyerM2; loyerM2Count++; }

      y = drawTableRow(p, ctx.reg, y, [
        (lot as any).floor ?? "-",
        lot.number,
        lot.lotType.replace(/_/g, " "),
        area > 0 ? area.toFixed(0) : "-",
        tenantName,
        lease?.startDate ? formatDate(new Date(lease.startDate)) : "-",
        lease ? pdfCur(loyerAnnuel) : "-",
        lease && evol !== 0 ? evol.toFixed(1) + "%" : "-",
        loyerM2 > 0 ? pdfCur(loyerM2) : "-",
        provCharges > 0 ? pdfCur(provCharges) : "-",
      ], WIDTHS, ALIGNS, { rowIndex: lotCount - 1 });
    }

    if (y < minY() + 40) { p = ctx.np(); y = contentStartY(); }
    y = drawTotalsRow(p, ctx.bold, y, [
      "TOTAUX", "", "", totalSurface > 0 ? totalSurface.toFixed(0) : "", "",
      "", pdfCur(totalLoyer), "", loyerM2Count > 0 ? pdfCur(loyerM2Sum / loyerM2Count) + " (moy.)" : "", totalProv > 0 ? pdfCur(totalProv) : "",
    ], WIDTHS, ALIGNS);

    // Per-building tenant % breakdown
    if (totalLoyer > 0 && buildingTenants.length > 0) {
      y -= 6;
      if (y < minY() + buildingTenants.length * ROW_HEIGHT + 20) { p = ctx.np(); y = contentStartY(); }
      y = drawTableHeader(p, ctx.bold, y, PCT_HEADERS, PCT_WIDTHS, PCT_ALIGNS);
      buildingTenants
        .sort((a, bv) => bv.loyer - a.loyer)
        .forEach((t, idx) => {
          const pct = (t.loyer / totalLoyer * 100).toFixed(1) + "%";
          y = drawTableRow(p, ctx.reg, y, [t.name, pdfCur(t.loyer), pct], PCT_WIDTHS, PCT_ALIGNS, { rowIndex: idx });
        });
      const hhiScore = hhi(buildingTenants.map((t) => t.loyer));
      const hhiText = `Concentration : ${hhiLabel(hhiScore)} (HHI ${Math.round(hhiScore)})`;
      y -= 4;
      p.drawText(hhiText, { x: MRG + 6, y, size: 8, font: ctx.reg, color: hhiScore >= 2500 ? CORAL : hhiScore >= 1500 ? BRAND_DEEP : GRAY });
      y -= 14;
    }

    y -= 12;
  }

  // ── Global synthesis ────────────────────────────────────────────────
  if (globalTenants.length > 0) {
    if (y < 200) { p = ctx.np(); y = contentStartY(); }
    y = drawSectionHeader(p, ctx.serifBold, y, "Synthèse société — Concentration du risque locatif");
    y -= 6;

    const GLOB_HEADERS = ["Locataire", "Immeuble", "Loyer an. HT", "Part société"];
    const GLOB_WIDTHS: number[] = [140, 160, 70, CW - 370];
    const GLOB_ALIGNS: ColAlign[] = ["left", "left", "right", "right"];
    y = drawTableHeader(p, ctx.bold, y, GLOB_HEADERS, GLOB_WIDTHS, GLOB_ALIGNS);

    const totalGlobal = globalTenants.reduce((s, t) => s + t.loyer, 0);
    globalTenants
      .sort((a, bv) => bv.loyer - a.loyer)
      .forEach((t, idx) => {
        if (y < minY()) { p = ctx.np(); y = contentStartY(); y = drawTableHeader(p, ctx.bold, y, GLOB_HEADERS, GLOB_WIDTHS, GLOB_ALIGNS); }
        const pct = (t.loyer / totalGlobal * 100).toFixed(1) + "%";
        y = drawTableRow(p, ctx.reg, y, [t.name, t.buildingName, pdfCur(t.loyer), pct], GLOB_WIDTHS, GLOB_ALIGNS, { rowIndex: idx });
      });

    y = drawTotalsRow(p, ctx.bold, y, ["TOTAL", "", pdfCur(totalGlobal), "100%"], GLOB_WIDTHS, GLOB_ALIGNS);

    const globalHhi = hhi(globalTenants.map((t) => t.loyer));
    y -= 8;
    const hhiColor = globalHhi >= 2500 ? CORAL : globalHhi >= 1500 ? BRAND_DEEP : GRAY;
    p.drawText(`Indice de concentration HHI : ${Math.round(globalHhi)} — ${hhiLabel(globalHhi)}`, { x: MRG + 6, y, size: 9, font: ctx.bold, color: hhiColor });
    y -= 14;

    const topTenant = globalTenants[0];
    const topPct = (topTenant.loyer / totalGlobal * 100).toFixed(1);
    p.drawText(`1er locataire : ${topTenant.name} — ${topPct}% du loyer total`, { x: MRG + 6, y, size: 8, font: ctx.reg, color: BLACK });
  }

  return {
    buffer: await ctx.save(),
    filename: `situation-locative-${new Date().toISOString().slice(0, 10)}.pdf`,
    contentType: "application/pdf",
  };
}
