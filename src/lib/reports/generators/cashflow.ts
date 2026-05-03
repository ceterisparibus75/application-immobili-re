import { prisma } from "@/lib/prisma";
import type { ReportOptions, ReportResult, ColAlign } from "../types";
import { LCW, CW, CORAL, GREEN } from "../constants";
import { initPdf, drawCoverPage, pdfCur, contentStartY } from "../pdf-core";
import {
  drawSectionHeader,
  drawSubText,
  drawTableHeader,
  drawTableRow,
  drawTotalsRow,
  drawEmptyMessage,
} from "../pdf-helpers";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const OP_INCOME  = ["loyers", "charges_locatives", "regularisation", "autres_revenus"];
const EXC_INCOME = ["cession_immeuble", "depot_garantie"];
const OP_EXP     = ["charges_copro", "assurance", "entretien_courant", "taxes", "frais_bancaires", "interets_emprunt", "remboursement_emprunt", "honoraires", "energie", "fournitures", "frais_gestion", "divers_depense"];
const EXC_EXP    = ["travaux", "acquisition_immeuble"];
const FIN_IN     = ["souscription_emprunt", "apport_cca"];
const FIN_OUT    = ["remboursement_cca"];

const CAT_LABELS: Record<string, string> = {
  loyers: "Loyers",
  charges_locatives: "Charges locatives",
  regularisation: "Régularisation charges",
  autres_revenus: "Autres revenus",
  cession_immeuble: "Cession d'immeuble",
  depot_garantie: "Dépôt de garantie",
  charges_copro: "Charges copropriété",
  assurance: "Assurance",
  entretien_courant: "Entretien courant",
  taxes: "Taxes et impôts",
  frais_bancaires: "Frais bancaires",
  interets_emprunt: "Intérêts emprunt",
  remboursement_emprunt: "Remboursement emprunt",
  honoraires: "Honoraires",
  energie: "Énergie",
  fournitures: "Fournitures",
  frais_gestion: "Frais gestion",
  divers_depense: "Divers dépenses",
  travaux: "Travaux",
  acquisition_immeuble: "Acquisition immeuble",
  souscription_emprunt: "Souscription emprunt",
  apport_cca: "Apport en CCA",
  remboursement_cca: "Remboursement CCA",
};

const catLabel = (id: string) => CAT_LABELS[id] ?? id;
const fmtIn    = (v: number) => v >  0.005 ? pdfCur(v)           : "-";
const fmtOut   = (v: number) => v < -0.005 ? pdfCur(Math.abs(v)) : "-";
const netCol   = (v: number) => v > 0.005 ? GREEN : v < -0.005 ? CORAL : null;
const pct      = (v: number, tot: number) => tot !== 0 ? (Math.abs(v / tot) * 100).toFixed(1) + "%" : "-";

export async function generateCashflowTresorerie(opts: ReportOptions): Promise<ReportResult> {
  const { societyId } = opts;
  const year = opts.year ?? new Date().getFullYear();
  const from = new Date(year, 0, 1);
  const to   = new Date(year, 11, 31, 23, 59, 59);

  const [transactions, bankAccounts, uncatCount] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: {
        bankAccount: { societyId },
        transactionDate: { gte: from, lte: to },
        NOT: { category: "virement_interne" },
      },
      select: { transactionDate: true, amount: true, category: true },
    }),
    prisma.bankAccount.findMany({
      where: { societyId, isActive: true },
      select: { accountName: true, bankName: true, currentBalance: true, lastSyncAt: true },
      orderBy: { bankName: "asc" },
    }),
    prisma.bankTransaction.count({
      where: {
        bankAccount: { societyId },
        transactionDate: { gte: from, lte: to },
        category: null,
      },
    }),
  ]);

  // ── Agrégation ────────────────────────────────────────────────────────────
  const Z12 = () => Array(12).fill(0) as number[];
  const mOpInc = Z12(), mOpExp = Z12();
  const mExcInc = Z12(), mExcExp = Z12();
  const mFinIn = Z12(), mFinOut = Z12();
  const catTotals: Record<string, number> = {};

  for (const tx of transactions) {
    if (!tx.category) continue;
    const m = new Date(tx.transactionDate).getMonth();
    const a = tx.amount;
    catTotals[tx.category] = (catTotals[tx.category] ?? 0) + a;
    if      (OP_INCOME.includes(tx.category))  mOpInc[m]  += a;
    else if (EXC_INCOME.includes(tx.category)) mExcInc[m] += a;
    else if (OP_EXP.includes(tx.category))     mOpExp[m]  += a;
    else if (EXC_EXP.includes(tx.category))    mExcExp[m] += a;
    else if (FIN_IN.includes(tx.category))     mFinIn[m]  += a;
    else if (FIN_OUT.includes(tx.category))    mFinOut[m] += a;
  }

  const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const add = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);

  const mOpNet  = add(mOpInc,  mOpExp);
  const mExcNet = add(mExcInc, mExcExp);
  const mFinNet = add(mFinIn,  mFinOut);
  const mTotal  = add(add(mOpNet, mExcNet), mFinNet);

  const aOpInc  = sum(mOpInc),  aOpExp  = sum(mOpExp),  aOpNet  = aOpInc  + aOpExp;
  const aExcInc = sum(mExcInc), aExcExp = sum(mExcExp), aExcNet = aExcInc + aExcExp;
  const aFinIn  = sum(mFinIn),  aFinOut = sum(mFinOut), aFinNet = aFinIn  + aFinOut;
  const aTotal  = aOpNet + aExcNet + aFinNet;

  // ── PDF ───────────────────────────────────────────────────────────────────
  const ctx = await initPdf(`Trésorerie ${year}`, "Rapport de trésorerie", opts.society);

  const coverDetails: string[] = [
    `Société : ${opts.society?.name ?? ""}`,
    `Période : 01/01/${year} au 31/12/${year}`,
  ];
  if (uncatCount > 0) {
    coverDetails.push(`Note : ${uncatCount} transaction(s) non catégorisée(s) — montants partiels`);
  }
  drawCoverPage(ctx, "Rapport de Trésorerie", `Exercice ${year}`, coverDetails);

  // ── Tableau de flux mensuel (paysage) ─────────────────────────────────────
  const PW_L = 841.89;
  const pg   = ctx.np(true);
  let y      = contentStartY(true);

  const colW   = 38;
  const labelW = LCW - 12 * colW - colW;
  const WIDTHS: number[] = [labelW, ...Array(12).fill(colW) as number[], colW];
  const ALIGNS: ColAlign[] = ["left", ...Array(13).fill("right") as ColAlign[]];

  const rowIn  = (lbl: string, mo: number[], ann: number): string[] =>
    [lbl, ...mo.map(fmtIn),  fmtIn(ann)];
  const rowOut = (lbl: string, mo: number[], ann: number): string[] =>
    [lbl, ...mo.map(fmtOut), fmtOut(ann)];
  const rowNet = (lbl: string, mo: number[], ann: number): string[] =>
    [lbl, ...mo.map(pdfCur), pdfCur(ann)];
  const colNet = (mo: number[], ann: number) =>
    [null, ...mo.map(netCol), netCol(ann)] as (ReturnType<typeof netCol>)[];

  y = drawTableHeader(pg, ctx.bold, y, ["", ...MONTHS, "Année"], WIDTHS, ALIGNS, PW_L);

  // Opérationnel
  y = drawSectionHeader(pg, ctx.serifBold, y, "Opérationnel", PW_L);
  y = drawTableRow(pg, ctx.reg, y, rowIn("Encaissements", mOpInc, aOpInc),   WIDTHS, ALIGNS, { rowIndex: 0 }, PW_L);
  y = drawTableRow(pg, ctx.reg, y, rowOut("Décaissements", mOpExp, aOpExp),  WIDTHS, ALIGNS, { rowIndex: 1 }, PW_L);
  y = drawTableRow(pg, ctx.reg, y, rowNet("Net opérationnel", mOpNet, aOpNet), WIDTHS, ALIGNS,
    { rowIndex: 0, cellColors: colNet(mOpNet, aOpNet), bold: ctx.bold, boldCols: [0] }, PW_L);
  y -= 6;

  // Exceptionnel
  y = drawSectionHeader(pg, ctx.serifBold, y, "Exceptionnel", PW_L);
  y = drawTableRow(pg, ctx.reg, y, rowIn("Encaissements", mExcInc, aExcInc),   WIDTHS, ALIGNS, { rowIndex: 0 }, PW_L);
  y = drawTableRow(pg, ctx.reg, y, rowOut("Décaissements", mExcExp, aExcExp),  WIDTHS, ALIGNS, { rowIndex: 1 }, PW_L);
  y = drawTableRow(pg, ctx.reg, y, rowNet("Net exceptionnel", mExcNet, aExcNet), WIDTHS, ALIGNS,
    { rowIndex: 0, cellColors: colNet(mExcNet, aExcNet), bold: ctx.bold, boldCols: [0] }, PW_L);
  y -= 6;

  // Financement
  y = drawSectionHeader(pg, ctx.serifBold, y, "Financement", PW_L);
  y = drawTableRow(pg, ctx.reg, y, rowIn("Entrées", mFinIn, aFinIn),   WIDTHS, ALIGNS, { rowIndex: 0 }, PW_L);
  y = drawTableRow(pg, ctx.reg, y, rowOut("Sorties", mFinOut, aFinOut), WIDTHS, ALIGNS, { rowIndex: 1 }, PW_L);
  y = drawTableRow(pg, ctx.reg, y, rowNet("Net financement", mFinNet, aFinNet), WIDTHS, ALIGNS,
    { rowIndex: 0, cellColors: colNet(mFinNet, aFinNet), bold: ctx.bold, boldCols: [0] }, PW_L);
  y -= 12;

  // Grand total
  y = drawTotalsRow(pg, ctx.bold, y, rowNet("FLUX NET TOTAL", mTotal, aTotal), WIDTHS, ALIGNS, PW_L);

  if (uncatCount > 0) {
    drawSubText(pg, ctx.reg, y - 4,
      `${uncatCount} transaction(s) non catégorisée(s) exclues — certains montants peuvent être incomplets.`);
  }

  // ── Ventilation par catégorie + comptes (portrait) ────────────────────────
  let curPg = ctx.np(false);
  let y2    = contentStartY(false);

  const W_CAT: number[] = [CW - 160, 110, 50];
  const A_CAT: ColAlign[] = ["left", "right", "right"];

  // Dépenses
  const expRows = [...OP_EXP, ...EXC_EXP]
    .map(id => ({ label: catLabel(id), amount: catTotals[id] ?? 0 }))
    .filter(r => r.amount < -0.005)
    .sort((a, b) => a.amount - b.amount);
  const totExp = expRows.reduce((s, r) => s + r.amount, 0);

  y2 = drawSectionHeader(curPg, ctx.serifBold, y2, "Dépenses par catégorie");
  if (expRows.length === 0) {
    y2 = drawEmptyMessage(curPg, ctx.reg, y2, "Aucune dépense catégorisée sur la période");
  } else {
    y2 = drawTableHeader(curPg, ctx.bold, y2, ["Catégorie", "Montant", "% total"], W_CAT, A_CAT);
    expRows.forEach((r, i) => {
      y2 = drawTableRow(curPg, ctx.reg, y2,
        [r.label, pdfCur(Math.abs(r.amount)), pct(r.amount, totExp)], W_CAT, A_CAT, { rowIndex: i });
    });
    y2 = drawTotalsRow(curPg, ctx.bold, y2, ["TOTAL", pdfCur(Math.abs(totExp)), "100%"], W_CAT, A_CAT);
  }
  y2 -= 16;

  // Revenus
  const incRows = [...OP_INCOME, ...EXC_INCOME]
    .map(id => ({ label: catLabel(id), amount: catTotals[id] ?? 0 }))
    .filter(r => r.amount > 0.005)
    .sort((a, b) => b.amount - a.amount);
  const totInc = incRows.reduce((s, r) => s + r.amount, 0);

  if (y2 - (26 + (incRows.length + 2) * 16) < 60) {
    curPg = ctx.np(false);
    y2    = contentStartY(false);
  }
  y2 = drawSectionHeader(curPg, ctx.serifBold, y2, "Revenus par catégorie");
  if (incRows.length === 0) {
    y2 = drawEmptyMessage(curPg, ctx.reg, y2, "Aucun revenu catégorisé sur la période");
  } else {
    y2 = drawTableHeader(curPg, ctx.bold, y2, ["Catégorie", "Montant", "% total"], W_CAT, A_CAT);
    incRows.forEach((r, i) => {
      y2 = drawTableRow(curPg, ctx.reg, y2,
        [r.label, pdfCur(r.amount), pct(r.amount, totInc)], W_CAT, A_CAT, { rowIndex: i });
    });
    y2 = drawTotalsRow(curPg, ctx.bold, y2, ["TOTAL", pdfCur(totInc), "100%"], W_CAT, A_CAT);
  }

  // Comptes bancaires
  if (bankAccounts.length > 0) {
    y2 -= 16;
    if (y2 - (26 + (bankAccounts.length + 2) * 16) < 60) {
      curPg = ctx.np(false);
      y2    = contentStartY(false);
    }
    const W_BANK: number[] = [CW - 230, 80, 100, 50];
    const A_BANK: ColAlign[] = ["left", "left", "right", "right"];

    y2 = drawSectionHeader(curPg, ctx.serifBold, y2, "Comptes bancaires");
    y2 = drawTableHeader(curPg, ctx.bold, y2,
      ["Compte", "Banque", "Solde actuel", "Dernière sync."], W_BANK, A_BANK);
    bankAccounts.forEach((acc, i) => {
      const lastSync = acc.lastSyncAt
        ? new Date(acc.lastSyncAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })
        : "—";
      y2 = drawTableRow(curPg, ctx.reg, y2,
        [acc.accountName, acc.bankName, pdfCur(acc.currentBalance), lastSync],
        W_BANK, A_BANK, { rowIndex: i });
    });
    const totalBalance = bankAccounts.reduce((s, a) => s + a.currentBalance, 0);
    y2 = drawTotalsRow(curPg, ctx.bold, y2,
      ["SOLDE TOTAL", "", pdfCur(totalBalance), ""], W_BANK, A_BANK);
    void y2;
  }

  return {
    buffer: await ctx.save(),
    filename: `tresorerie-${year}.pdf`,
    contentType: "application/pdf",
  };
}