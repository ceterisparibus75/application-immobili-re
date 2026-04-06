import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { getAnalyticsData } from "@/actions/analytics";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatCurrency } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** formatCurrency adapte pour pdf-lib : remplace les espaces insecables hors WinAnsi */
function pdfCur(amount: number): string {
  return formatCurrency(amount).replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
}

// ── PDF constants (same as report-generator) ──
const BLUE = rgb(0.12, 0.29, 0.58);
const LBLUE = rgb(0.91, 0.94, 0.98);
const GRAY = rgb(0.55, 0.55, 0.55);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0.1, 0.1, 0.1);
const RED = rgb(0.78, 0.18, 0.18);
const PW = 595.28;
const PH = 841.89;
const MRG = 40;
const CW = PW - 2 * MRG;

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) {
      return NextResponse.json({ error: "Aucune societe selectionnee" }, { status: 400 });
    }

    await requireSocietyAccess(session.user.id, societyId);

    const data = await getAnalyticsData(societyId);
    if (!data) {
      return NextResponse.json({ error: "Impossible de charger les donnees" }, { status: 500 });
    }

    // Fetch society name for branding
    const { prisma } = await import("@/lib/prisma");
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { name: true, siret: true, addressLine1: true, city: true, postalCode: true },
    });

    const buffer = await generateDashboardPdf(data, society);

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `tableau-de-bord-${dateStr}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[dashboard/export]", error);
    return NextResponse.json({ error: "Erreur lors de la generation du PDF" }, { status: 500 });
  }
}

// ── PDF generation ──

type AnalyticsData = NonNullable<Awaited<ReturnType<typeof getAnalyticsData>>>;

interface SocietyInfo {
  name: string;
  siret?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  postalCode?: string | null;
}

async function generateDashboardPdf(
  data: AnalyticsData,
  society: SocietyInfo | null,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const ds = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

  const societyName = society?.name ?? null;
  const societyFooterParts: string[] = [];
  if (society?.addressLine1) societyFooterParts.push(society.addressLine1);
  if (society?.postalCode || society?.city) {
    societyFooterParts.push([society.postalCode, society.city].filter(Boolean).join(" "));
  }
  if (society?.siret) societyFooterParts.push(`SIRET : ${society.siret}`);
  const societyFooter = societyFooterParts.length > 0 ? societyFooterParts.join(" — ") : null;
  let pageCount = 0;

  const newPage = (): any => {
    pageCount++;
    const p: any = doc.addPage([PW, PH]);
    // Header background
    p.drawRectangle({ x: 0, y: PH - 60, width: PW, height: 60, color: BLUE });
    if (societyName) {
      const nameWidth = bold.widthOfTextAtSize(societyName, 10);
      p.drawText(societyName, { x: PW - MRG - nameWidth, y: PH - 22, size: 10, font: bold, color: WHITE });
    }
    p.drawText("Tableau de bord", { x: MRG, y: PH - 28, size: 14, font: bold, color: WHITE });
    p.drawText(`Synthese au ${ds}`, { x: MRG, y: PH - 48, size: 9, font: reg, color: rgb(0.82, 0.87, 0.96) });
    p.drawText(`Genere le ${ds}`, { x: PW - 150, y: PH - 48, size: 8, font: reg, color: rgb(0.82, 0.87, 0.96) });
    // Footer
    p.drawLine({ start: { x: MRG, y: 30 }, end: { x: PW - MRG, y: 30 }, thickness: 0.5, color: GRAY });
    const footerLabel = societyName
      ? `${societyName} — Genere le ${ds} — Page ${pageCount}`
      : `Application de gestion immobiliere — Genere le ${ds} — Page ${pageCount}`;
    p.drawText(footerLabel, { x: MRG, y: 18, size: 7, font: reg, color: GRAY });
    if (societyFooter) {
      p.drawText(societyFooter, { x: MRG, y: 9, size: 6, font: reg, color: GRAY });
    }
    return p;
  };

  // Helper: section header
  const sectionHeader = (p: any, y: number, title: string): number => {
    p.drawRectangle({ x: MRG, y: y - 16, width: CW, height: 18, color: LBLUE });
    p.drawText(title, { x: MRG + 6, y: y - 10, size: 9, font: bold, color: BLUE });
    return y - 26;
  };

  // Helper: KPI row
  const kpiRow = (p: any, y: number, label: string, value: string, valueColor = BLACK): number => {
    p.drawText(label, { x: MRG + 10, y: y - 10, size: 8.5, font: reg, color: BLACK });
    const vWidth = reg.widthOfTextAtSize(value, 8.5);
    p.drawText(value, { x: PW - MRG - 10 - vWidth, y: y - 10, size: 8.5, font: bold, color: valueColor });
    p.drawLine({ start: { x: MRG + 6, y: y - 16 }, end: { x: PW - MRG - 6, y: y - 16 }, thickness: 0.3, color: rgb(0.9, 0.9, 0.9) });
    return y - 20;
  };

  // Helper: table row
  const tableRow = (p: any, y: number, cells: string[], widths: number[], isHeader = false): number => {
    const bg = isHeader ? BLUE : Math.round(y) % 30 < 15 ? rgb(0.97, 0.97, 0.97) : WHITE;
    p.drawRectangle({ x: MRG, y: y - 14, width: CW, height: 15, color: bg });
    let x = MRG + 4;
    cells.forEach((c, i) => {
      p.drawText(String(c).slice(0, 42), {
        x,
        y: y - 10,
        size: 7.5,
        font: isHeader ? bold : reg,
        color: isHeader ? WHITE : BLACK,
      });
      x += widths[i];
    });
    return y - 15;
  };

  const { kpis, monthlyRevenue, buildingOccupancy, overdueByAge, topTenants, lenderSummaries } = data;

  // ══════════════════════════════════════════════════════════════
  // PAGE 1: KPIs
  // ══════════════════════════════════════════════════════════════
  let p = newPage();
  let y = PH - 80;

  // ── Indicateurs cles ──
  y = sectionHeader(p, y, "Indicateurs cles");
  y = kpiRow(p, y, "Revenus du mois", pdfCur(kpis.currentMonthRevenue));
  const changeStr = kpis.revenueChange >= 0 ? `+${kpis.revenueChange}%` : `${kpis.revenueChange}%`;
  y = kpiRow(p, y, "Evolution vs mois precedent", changeStr, kpis.revenueChange >= 0 ? rgb(0.13, 0.55, 0.13) : RED);
  y = kpiRow(p, y, "Taux d'occupation", `${kpis.occupancyRate}%`);
  y = kpiRow(p, y, "Impayes", pdfCur(kpis.totalOverdueAmount), kpis.totalOverdueAmount > 0 ? RED : BLACK);
  y = kpiRow(p, y, "Factures impayees", `${kpis.unpaidInvoiceCount}`);
  if (kpis.grossYield !== null) {
    y = kpiRow(p, y, "Rendement brut", `${kpis.grossYield.toFixed(1)}%`);
  }
  y = kpiRow(p, y, "Tresorerie disponible", pdfCur(kpis.availableCash), kpis.availableCash < 0 ? RED : BLACK);

  y -= 10;

  // ── Patrimoine ──
  y = sectionHeader(p, y, "Patrimoine");
  y = kpiRow(p, y, "Immeubles", `${kpis.totalBuildings}`);
  y = kpiRow(p, y, "Lots (total)", `${kpis.totalLots}`);
  y = kpiRow(p, y, "Lots occupes", `${kpis.occupiedLots}`);
  y = kpiRow(p, y, "Lots vacants", `${kpis.vacantLots}`, kpis.vacantLots > 0 ? RED : BLACK);
  if (kpis.patrimonyValue > 0) {
    y = kpiRow(p, y, "Valeur patrimoine", pdfCur(kpis.patrimonyValue));
  }

  y -= 10;

  // ── Locataires & Baux ──
  y = sectionHeader(p, y, "Locataires & Baux");
  y = kpiRow(p, y, "Locataires actifs", `${kpis.totalTenants}`);
  y = kpiRow(p, y, "Baux en cours", `${kpis.activeLeaseCount}`);
  y = kpiRow(p, y, "Baux expirant sous 90 jours", `${kpis.expiringLeaseCount}`, kpis.expiringLeaseCount > 0 ? rgb(0.8, 0.5, 0.0) : BLACK);

  y -= 10;

  // ── Facturation ──
  y = sectionHeader(p, y, "Facturation");
  y = kpiRow(p, y, "Loyers mensuels HT", pdfCur(kpis.monthlyRentHT));
  y = kpiRow(p, y, "Charges recuperables (12 mois)", pdfCur(kpis.recoverableCharges));

  y -= 10;

  // ── Technique ──
  if (kpis.expiringDiagnosticCount > 0 || kpis.openMaintenanceCount > 0) {
    y = sectionHeader(p, y, "Technique");
    if (kpis.expiringDiagnosticCount > 0) {
      y = kpiRow(p, y, "Diagnostics expirant sous 90j", `${kpis.expiringDiagnosticCount}`, rgb(0.8, 0.5, 0.0));
    }
    if (kpis.openMaintenanceCount > 0) {
      y = kpiRow(p, y, "Maintenances en cours", `${kpis.openMaintenanceCount}`);
    }
    y -= 10;
  }

  // ── Endettement ──
  if (kpis.activeLoanCount > 0) {
    y = sectionHeader(p, y, "Endettement");
    y = kpiRow(p, y, "Capital restant du", pdfCur(kpis.totalDebt), RED);
    y = kpiRow(p, y, "Mensualite totale", pdfCur(kpis.monthlyLoanPayment));
    y = kpiRow(p, y, "Emprunts actifs", `${kpis.activeLoanCount}`);
    if (kpis.ltv !== null) {
      y = kpiRow(p, y, "LTV", `${kpis.ltv}%`, kpis.ltv > 80 ? RED : kpis.ltv > 60 ? rgb(0.8, 0.5, 0.0) : rgb(0.13, 0.55, 0.13));
    }
  }

  // ══════════════════════════════════════════════════════════════
  // PAGE 2: Tables
  // ══════════════════════════════════════════════════════════════
  p = newPage();
  y = PH - 80;

  // ── Revenus mensuels (tableau) ──
  y = sectionHeader(p, y, "Revenus mensuels (12 derniers mois)");
  const revWs = [CW * 0.4, CW * 0.6];
  y = tableRow(p, y, ["Mois", "Revenus TTC"], revWs, true);
  for (const m of monthlyRevenue) {
    y = tableRow(p, y, [m.month, pdfCur(m.revenue)], revWs);
    if (y < 60) {
      p = newPage();
      y = PH - 80;
    }
  }
  const totalRevenue = monthlyRevenue.reduce((s, m) => s + m.revenue, 0);
  y -= 4;
  p.drawText("Total 12 mois :", { x: MRG + 10, y: y - 10, size: 8.5, font: bold, color: BLUE });
  const totalStr = pdfCur(totalRevenue);
  const totalWidth = bold.widthOfTextAtSize(totalStr, 8.5);
  p.drawText(totalStr, { x: PW - MRG - 10 - totalWidth, y: y - 10, size: 8.5, font: bold, color: BLUE });
  y -= 24;

  // ── Occupation par immeuble ──
  if (buildingOccupancy.length > 0) {
    y = sectionHeader(p, y, "Occupation par immeuble");
    const occWs = [CW * 0.35, CW * 0.15, CW * 0.15, CW * 0.15, CW * 0.2];
    y = tableRow(p, y, ["Immeuble", "Occupes", "Vacants", "Total", "Taux"], occWs, true);
    for (const b of buildingOccupancy) {
      if (y < 60) {
        p = newPage();
        y = PH - 80;
      }
      y = tableRow(p, y, [b.name, `${b.occupied}`, `${b.vacant}`, `${b.total}`, `${b.rate}%`], occWs);
    }
    y -= 14;
  }

  // ── Impayes par anciennete ──
  if (overdueByAge.some((b) => b.count > 0)) {
    if (y < 120) {
      p = newPage();
      y = PH - 80;
    }
    y = sectionHeader(p, y, "Impayes par anciennete");
    const ageWs = [CW * 0.35, CW * 0.25, CW * 0.4];
    y = tableRow(p, y, ["Anciennete", "Nombre", "Montant"], ageWs, true);
    for (const bucket of overdueByAge) {
      y = tableRow(p, y, [bucket.label, `${bucket.count}`, pdfCur(bucket.amount)], ageWs);
    }
    y -= 14;
  }

  // ── Top 5 locataires ──
  if (topTenants.length > 0) {
    if (y < 140) {
      p = newPage();
      y = PH - 80;
    }
    y = sectionHeader(p, y, "Top 5 locataires (volume de facturation)");
    const tenWs = [CW * 0.6, CW * 0.4];
    y = tableRow(p, y, ["Locataire", "Total facture"], tenWs, true);
    for (const t of topTenants) {
      y = tableRow(p, y, [t.name, pdfCur(t.total)], tenWs);
    }
    y -= 14;
  }

  // ── Endettement par etablissement ──
  if (lenderSummaries.length > 0) {
    if (y < 140) {
      p = newPage();
      y = PH - 80;
    }
    y = sectionHeader(p, y, "Endettement par etablissement");
    const lenderWs = [CW * 0.25, CW * 0.12, CW * 0.21, CW * 0.21, CW * 0.21];
    y = tableRow(p, y, ["Etablissement", "Emprunts", "Restant du", "Mensualite", "Rembourse"], lenderWs, true);
    for (const ls of lenderSummaries) {
      if (y < 60) {
        p = newPage();
        y = PH - 80;
      }
      y = tableRow(p, y, [ls.lender, `${ls.loanCount}`, pdfCur(ls.remainingBalance), pdfCur(ls.monthlyPayment), `${ls.pctRepaid}%`], lenderWs);
    }
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
