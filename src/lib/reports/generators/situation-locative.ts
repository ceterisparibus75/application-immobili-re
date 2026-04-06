/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import type { PaymentFrequency } from "@/generated/prisma/client";
import type { ReportOptions, ReportResult, ColAlign } from "../types";
import { CW } from "../constants";
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

/** Number of periods per year for a given payment frequency */
function periodsPerYear(freq: PaymentFrequency): number {
  switch (freq) {
    case "ANNUEL": return 1;
    case "SEMESTRIEL": return 2;
    case "TRIMESTRIEL": return 4;
    case "MENSUEL":
    default: return 12;
  }
}

const HEADERS = ["Étage", "Lot", "Type", "m2", "Locataire", "Effet", "Loyer an. HT", "Évol.%", "Loyer/m2", "VLM", "Prov.ch."];
const WIDTHS  = [28, 32, 45, 30, 90, 48, 60, 36, 42, 50, CW - 461];
const ALIGNS: ColAlign[] = ["left", "left", "left", "right", "left", "left", "right", "right", "right", "right", "right"];

export async function generateSituationLocative(opts: ReportOptions): Promise<ReportResult> {
  const { societyId, buildingId } = opts;

  const buildings = await prisma.building.findMany({
    where: { societyId, ...(buildingId ? { id: buildingId } : {}) },
    include: {
      lots: {
        include: {
          leases: {
            where: { status: { in: ["EN_COURS", "RENOUVELE"] } },
            include: {
              tenant: true,
              chargeProvisions: { where: { isActive: true } },
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

  // Cover page
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

  for (const b of buildings) {
    if (y < 160) { p = ctx.np(); y = contentStartY(); }

    const occ = b.lots.filter((l) => l.leases.length > 0).length;
    const totalRentAnnuel = b.lots.reduce((s, l) => {
      const lease = l.leases[0];
      if (!lease) return s;
      return s + lease.currentRentHT * periodsPerYear(lease.paymentFrequency);
    }, 0);

    y = drawSectionHeader(p, ctx.serifBold, y, `${b.name} - ${b.lots.length} lot(s)`);
    y = drawSubText(p, ctx.reg, y, `Occupation : ${occ}/${b.lots.length} | Loyers annuels HC : ${pdfCur(totalRentAnnuel)}`);
    y -= 4;
    y = drawTableHeader(p, ctx.bold, y, HEADERS, WIDTHS, ALIGNS);

    let totalLoyer = 0;
    let totalSurface = 0;
    let totalVLM = 0;
    let totalProv = 0;
    let lotCount = 0;
    let evolSum = 0;
    let evolCount = 0;
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
      const baseRent = (lease as any)?.baseRentHT ?? lease?.currentRentHT ?? 0;
      const evol = baseRent > 0 ? ((lease!.currentRentHT - baseRent) / baseRent) * 100 : 0;
      // Loyer mensuel equivalent for rent/m2
      const loyerMensuel = lease ? lease.currentRentHT * periods / 12 : 0;
      const loyerM2 = area > 0 && lease ? loyerMensuel / area : 0;
      const vlm = (lot as any).marketRentValue ?? 0;
      const provCharges = lease?.chargeProvisions?.reduce((s: number, cp: any) => s + cp.monthlyAmount, 0) ?? 0;

      totalLoyer += loyerAnnuel;
      totalSurface += area;
      totalVLM += vlm;
      totalProv += provCharges;
      lotCount++;
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
        vlm > 0 ? pdfCur(vlm) : "-",
        provCharges > 0 ? pdfCur(provCharges) : "-",
      ], WIDTHS, ALIGNS, { rowIndex: lotCount - 1 });
    }

    // Totaux + Moyennes rows (need ~40pt for both, check before rendering)
    if (y < minY() + 40) { p = ctx.np(); y = contentStartY(); }
    y = drawTotalsRow(p, ctx.bold, y, [
      "TOTAUX", "", "", totalSurface > 0 ? totalSurface.toFixed(0) : "", "",
      "", pdfCur(totalLoyer), "", "", totalVLM > 0 ? pdfCur(totalVLM) : "", totalProv > 0 ? pdfCur(totalProv) : "",
    ], WIDTHS, ALIGNS);

    // Moyennes row
    y = drawMoyennesRow(p, ctx.bold, y, [
      "MOYENNES", "", "", "", "", "",
      lotCount > 0 ? pdfCur(totalLoyer / lotCount) : "-",
      evolCount > 0 ? (evolSum / evolCount).toFixed(1) + "%" : "-",
      loyerM2Count > 0 ? pdfCur(loyerM2Sum / loyerM2Count) : "-",
      "", "",
    ], WIDTHS, ALIGNS);

    y -= 12;
  }

  return {
    buffer: await ctx.save(),
    filename: `situation-locative-${new Date().toISOString().slice(0, 10)}.pdf`,
    contentType: "application/pdf",
  };
}
