/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
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

const HEADERS = ["Etage", "Lot", "Type", "m2", "Locataire", "Effet", "Loyer an. HT", "Evol.%", "Loyer/m2", "VLM", "Prov.ch."];
const WIDTHS  = [30, 35, 50, 32, 82, 48, 58, 38, 42, 50, CW - 465];
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
          },
        },
        orderBy: { number: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const ctx = await initPdf("Situation locative", "Etat des lots et baux actifs par immeuble", opts.society);

  // Cover page
  drawCoverPage(ctx, "Situation Locative", "Etat des lots et baux actifs", [
    `Societe : ${opts.society?.name ?? ""}`,
    `Date : ${new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`,
    buildingId ? `Immeuble filtre` : `Tous les immeubles`,
  ]);

  let p = ctx.np();
  let y = contentStartY();

  if (buildings.length === 0) {
    drawEmptyMessage(p, ctx.reg, y, "Aucun immeuble trouve pour cette societe.");
    return { buffer: await ctx.save(), filename: `situation-locative-${new Date().toISOString().slice(0, 10)}.pdf`, contentType: "application/pdf" };
  }

  for (const b of buildings) {
    if (y < 160) { p = ctx.np(); y = contentStartY(); }

    const occ = b.lots.filter((l) => l.leases.length > 0).length;
    const totalRentAnnuel = b.lots.reduce((s, l) => s + (l.leases[0]?.currentRentHT ?? 0) * 12, 0);

    y = drawSectionHeader(p, ctx.bold, y, `${b.name} - ${b.lots.length} lot(s)`);
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
      const loyerAnnuel = (lease?.currentRentHT ?? 0) * 12;
      const baseRent = (lease as any)?.baseRentHT ?? lease?.currentRentHT ?? 0;
      const evol = baseRent > 0 ? ((lease!.currentRentHT - baseRent) / baseRent) * 100 : 0;
      const loyerM2 = area > 0 && lease ? lease.currentRentHT / area : 0;
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

    // Totaux row
    if (y < minY()) { p = ctx.np(); y = contentStartY(); }
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
