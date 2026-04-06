 
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import type { ReportOptions, ReportResult, ColAlign } from "../types";
import { CW, CORAL } from "../constants";
import { initPdf, drawCoverPage, pdfCur, contentStartY, minY } from "../pdf-core";
import {
  drawSectionHeader,
  drawTableHeader,
  drawTableRow,
  drawTotalsRow,
  drawKpiRow,
  drawEmptyMessage,
} from "../pdf-helpers";

export async function generateRecapChargesLocataire(opts: ReportOptions): Promise<ReportResult> {
  const { societyId, tenantId } = opts;
  const year = opts.year ?? new Date().getFullYear();
  if (!tenantId) throw new Error("tenantId requis pour ce rapport");

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, societyId } });
  if (!tenant) throw new Error("Locataire introuvable");

  const leases = await prisma.lease.findMany({
    where: { societyId, tenantId },
    include: {
      lot: { include: { building: { select: { name: true } } } },
      chargeProvisions: { where: { isActive: true } },
      chargeRegularizations: { where: { fiscalYear: year } },
      invoices: {
        where: { issueDate: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) }, invoiceType: { not: "AVOIR" } },
      },
    },
  });

  const tenantName = tenant.entityType === "PERSONNE_MORALE"
    ? (tenant.companyName ?? "-")
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "-";

  const ctx = await initPdf(`Récap charges - ${tenantName}`, `Exercice ${year}`, opts.society);

  drawCoverPage(ctx, "Récapitulatif des Charges", `Locataire : ${tenantName}`, [
    `Société : ${opts.society?.name ?? ""}`,
    `Exercice : ${year}`,
  ]);

  let p = ctx.np();
  let y = contentStartY();

  if (leases.length === 0) {
    drawEmptyMessage(p, ctx.reg, y, "Aucun bail trouvé pour ce locataire.");
    return { buffer: await ctx.save(), filename: `charges-locataire-${tenantId.slice(0, 8)}-${year}.pdf`, contentType: "application/pdf" };
  }

  y = drawSectionHeader(p, ctx.serifBold, y, "Informations locataire");
  y -= 4;
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Nom / Raison sociale", tenantName);
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Email", tenant.email ?? "-");
  y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Téléphone", tenant.phone ?? "-");
  y -= 12;

  for (const lease of leases) {
    if (y < 160) { p = ctx.np(); y = contentStartY(); }
    y = drawSectionHeader(p, ctx.serifBold, y, `${lease.lot.building.name} - Lot ${lease.lot.number}  (bail du ${formatDate(new Date(lease.startDate))})`);

    const totalInv = lease.invoices.reduce((s, i) => s + i.totalTTC, 0);
    y -= 4;
    y = drawKpiRow(p, ctx.bold, ctx.reg, y, "Loyers appelés", pdfCur(totalInv));
    y -= 8;

    if (lease.chargeProvisions.length > 0) {
      const WS = [200, 100, CW - 300];
      const WA: ColAlign[] = ["left", "right", "right"];
      y = drawTableHeader(p, ctx.bold, y, ["Provision sur charges", "Mensuel", "Annuel"], WS, WA);
      let totProv = 0;
      let ri = 0;
      for (const cp of lease.chargeProvisions) {
        if (y < minY()) { p = ctx.np(); y = contentStartY(); }
        totProv += cp.monthlyAmount;
        y = drawTableRow(p, ctx.reg, y, [cp.label, pdfCur(cp.monthlyAmount), pdfCur(cp.monthlyAmount * 12)], WS, WA, { rowIndex: ri++ });
      }
      y = drawTotalsRow(p, ctx.bold, y, ["Total provisions/mois", pdfCur(totProv), pdfCur(totProv * 12)], WS, WA);
      y -= 8;
    }

    for (const chargeReg of lease.chargeRegularizations) {
      if (y < minY()) { p = ctx.np(); y = contentStartY(); }
      const color = chargeReg.balance > 0 ? CORAL : undefined;
      y = drawKpiRow(p, ctx.bold, ctx.reg, y,
        `Régularisation ${chargeReg.fiscalYear}`,
        `Charges ${pdfCur(chargeReg.totalCharges)} / Provisions ${pdfCur(chargeReg.totalProvisions)} - Solde ${pdfCur(chargeReg.balance)}`,
        color
      );
    }
    y -= 12;
  }

  return {
    buffer: await ctx.save(),
    filename: `charges-locataire-${tenantId.slice(0, 8)}-${year}.pdf`,
    contentType: "application/pdf",
  };
}
