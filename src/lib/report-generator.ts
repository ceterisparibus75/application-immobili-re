/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Générateur de rapports PDF et Excel
 * Templates : SITUATION_LOCATIVE, COMPTE_RENDU_GESTION, RENTABILITE_LOT,
 *             ETAT_IMPAYES, RECAP_CHARGES_LOCATAIRE, SUIVI_TRAVAUX
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

export type ReportType =
  | "SITUATION_LOCATIVE"
  | "COMPTE_RENDU_GESTION"
  | "RENTABILITE_LOT"
  | "ETAT_IMPAYES"
  | "RECAP_CHARGES_LOCATAIRE"
  | "SUIVI_TRAVAUX";

export interface ReportOptions {
  societyId: string;
  type: ReportType;
  year?: number;
  buildingId?: string;
  tenantId?: string;
  format?: "pdf" | "xlsx";
}

export interface ReportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export async function generateReport(options: ReportOptions): Promise<ReportResult> {
  switch (options.type) {
    case "SITUATION_LOCATIVE":      return generateSituationLocative(options);
    case "COMPTE_RENDU_GESTION":    return generateCompteRenduGestion(options);
    case "RENTABILITE_LOT":         return generateRentabiliteLot(options);
    case "ETAT_IMPAYES":            return generateEtatImpayes(options);
    case "RECAP_CHARGES_LOCATAIRE": return generateRecapChargesLocataire(options);
    case "SUIVI_TRAVAUX":           return generateSuiviTravaux(options);
    default: throw new Error("Type de rapport inconnu");
  }
}

// ── PDF helpers ────────────────────────────────────────────────────
const BLUE  = rgb(0.12, 0.29, 0.58); const LBLUE = rgb(0.91, 0.94, 0.98);
const GRAY  = rgb(0.55, 0.55, 0.55); const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0.1, 0.1, 0.1);   const RED   = rgb(0.78, 0.18, 0.18);
const PW = 595.28; const PH = 841.89; const MRG = 40; const CW = PW - 2 * MRG;

async function initPdf(title: string, subtitle: string) {
  const doc  = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);
  const ds   = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  let pageCount = 0;
  const np = (): any => {
    pageCount++;
    const p: any = doc.addPage([PW, PH]);
    p.drawRectangle({ x: 0, y: PH-60, width: PW, height: 60, color: BLUE });
    p.drawText(title,    { x: MRG, y: PH-28, size: 14, font: bold, color: WHITE });
    p.drawText(subtitle, { x: MRG, y: PH-48, size: 9,  font: reg,  color: rgb(0.82,0.87,0.96) });
    p.drawText(`Généré le ${ds}`, { x: PW-150, y: PH-38, size: 8, font: reg, color: rgb(0.82,0.87,0.96) });
    p.drawLine({ start:{x:MRG,y:30}, end:{x:PW-MRG,y:30}, thickness:0.5, color:GRAY });
    p.drawText(`Application de gestion immobiliere - Page ${pageCount}`, { x: MRG, y:18, size:7, font:reg, color:GRAY });
    return p;
  };
  return { bold, reg, np, save: async (): Promise<Buffer> => Buffer.from(await doc.save()) };
}

/** Affiche un message "Aucune donnée" dans un PDF si les données sont vides */
function drawEmptyMessage(p: any, font: any, y: number, message: string): number {
  p.drawRectangle({ x: MRG, y: y-30, width: CW, height: 32, color: rgb(0.97,0.95,0.90) });
  p.drawText(message, { x: MRG + CW/2 - message.length*2.2, y: y-20, size: 9, font, color: GRAY });
  return y - 40;
}

function sh(p: any, b: any, y: number, t: string): number {
  p.drawRectangle({ x: MRG, y: y-16, width: CW, height: 18, color: LBLUE });
  p.drawText(t, { x: MRG+6, y: y-10, size: 9, font: b, color: BLUE });
  return y - 26;
}

function tr(p: any, r: any, b: any, y: number, cells: string[], ws: number[], hdr = false): number {
  const bg = hdr ? BLUE : (Math.round(y) % 30 < 15 ? rgb(0.97,0.97,0.97) : WHITE);
  p.drawRectangle({ x: MRG, y: y-14, width: CW, height: 15, color: bg });
  let x = MRG + 4;
  cells.forEach((c, i) => {
    p.drawText(String(c).slice(0,42), { x, y: y-10, size: 7.5, font: hdr ? b : r, color: hdr ? WHITE : BLACK });
    x += ws[i];
  });
  return y - 15;
}

// ── 1. Situation locative ─────────────────────────────────────────

async function generateSituationLocative(opts: ReportOptions): Promise<ReportResult> {
  const { societyId, buildingId } = opts;
  const buildings = await prisma.building.findMany({
    where: { societyId, ...(buildingId ? { id: buildingId } : {}) },
    include: {
      lots: {
        include: {
          leases: {
            where: { status: { in: ["EN_COURS", "RENOUVELE"] } },
            include: { tenant: true },
            take: 1,
          },
        },
        orderBy: { number: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
  const { bold, reg, np, save } = await initPdf(
    "Situation locative", "État des lots et baux actifs par immeuble"
  );
  const WS  = [70, 120, 90, 75, 60, CW - 415];
  const HDR = ["Lot", "Locataire", "Type", "Loyer HC/m", "Statut", "Fin bail"];
  let p: any = np(); let y = PH - 80;

  if (buildings.length === 0) {
    drawEmptyMessage(p, reg, y, "Aucun immeuble trouvé pour cette société.");
  }

  for (const b of buildings) {
    if (y < 150) { p = np(); y = PH - 80; }
    y = sh(p, bold, y, `${b.name} - ${b.lots.length} lot(s)`);
    const occ  = b.lots.filter(l => l.leases.length > 0).length;
    const rent = b.lots.reduce((s, l) => s + (l.leases[0]?.currentRentHT ?? 0), 0);
    p.drawText(`Occupation : ${occ}/${b.lots.length} | Loyers HC : ${formatCurrency(rent)}/mois`,
      { x: MRG+6, y: y+2, size: 8, font: reg, color: GRAY });
    y -= 16;
    y = tr(p, reg, bold, y, HDR, WS, true);
    for (const lot of b.lots) {
      if (y < 60) { p = np(); y = PH - 80; y = tr(p, reg, bold, y, HDR, WS, true); }
      const lease = lot.leases[0];
      const tn = lease?.tenant
        ? (lease.tenant.entityType === "PERSONNE_MORALE"
            ? (lease.tenant.companyName ?? "-")
            : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim() || "-")
        : "Vacant";
      y = tr(p, reg, bold, y, [
        lot.number, tn, lot.lotType.replace(/_/g," "),
        lease ? formatCurrency(lease.currentRentHT) : "-",
        lease ? "Occupé" : "Vacant",
        lease?.endDate ? formatDate(new Date(lease.endDate)) : "-",
      ], WS);
    }
    y -= 10;
  }
  return {
    buffer: await save(),
    filename: `situation-locative-${new Date().toISOString().slice(0,10)}.pdf`,
    contentType: "application/pdf",
  };
}

// ── 2. Compte-rendu de gestion ─────────────────────────────────────

async function generateCompteRenduGestion(opts: ReportOptions): Promise<ReportResult> {
  const { societyId } = opts;
  const year = opts.year ?? new Date().getFullYear();
  const from = new Date(year, 0, 1); const to = new Date(year, 11, 31, 23, 59, 59);

  const [society, invoices, charges, buildings] = await Promise.all([
    prisma.society.findUnique({ where: { id: societyId } }),
    prisma.invoice.findMany({
      where: { societyId, issueDate: { gte: from, lte: to }, invoiceType: { not: "AVOIR" } },
      include: { lease: { include: { lot: { select: { buildingId: true } } } } },
    }),
    prisma.charge.findMany({
      where: { societyId, date: { gte: from, lte: to } },
    }),
    prisma.building.findMany({ where: { societyId }, include: { lots: { select: { id: true } } } }),
  ]);

  const paid  = invoices.filter(i => i.status === "PAYE").reduce((s, i) => s + i.totalTTC, 0);
  const pend  = invoices.filter(i => i.status !== "PAYE").reduce((s, i) => s + i.totalTTC, 0);
  const tchg  = charges.reduce((s, c) => s + c.amount, 0);
  const { bold, reg, np, save } = await initPdf(`Compte-rendu de gestion ${year}`, society?.name ?? "");
  let p: any = np(); let y = PH - 80;

  if (invoices.length === 0 && charges.length === 0) {
    drawEmptyMessage(p, reg, y, `Aucune donnée financière trouvée pour l'année ${year}.`);
    y -= 10;
  }

  y = sh(p, bold, y, `Synthèse ${year}`);
  [
    ["Loyers encaissés (payés)", formatCurrency(paid)],
    ["Loyers en attente / retard", formatCurrency(pend)],
    ["Total des charges", formatCurrency(tchg)],
    ["Résultat net (encaissé - charges)", formatCurrency(paid - tchg)],
  ].forEach(([l, v]) => {
    p.drawText(l, { x: MRG+10, y, size: 9, font: reg, color: BLACK });
    p.drawText(v, { x: MRG+280, y, size: 9, font: bold, color: BLUE });
    y -= 18;
  });
  y -= 8;

  y = sh(p, bold, y, "Détail par immeuble");
  const BW = [120, 45, 80, 80, 80, CW - 405];
  y = tr(p, reg, bold, y, ["Immeuble","Lots","Facturé","Encaissé","Charges","En attente"], BW, true);

  for (const b of buildings) {
    if (y < 60) { p = np(); y = PH - 80; y = tr(p, reg, bold, y, ["Immeuble","Lots","Facturé","Encaissé","Charges","En attente"], BW, true); }
    const bi   = invoices.filter(i => i.lease?.lot?.buildingId === b.id);
    const bc   = charges.filter(c => c.buildingId === b.id);
    const bF   = bi.reduce((s, i) => s + i.totalTTC, 0);
    const bP   = bi.filter(i => i.status === "PAYE").reduce((s, i) => s + i.totalTTC, 0);
    const bC   = bc.reduce((s, c) => s + c.amount, 0);
    y = tr(p, reg, bold, y, [b.name, String(b.lots.length), formatCurrency(bF), formatCurrency(bP), formatCurrency(bC), formatCurrency(bF - bP)], BW);
  }

  return {
    buffer: await save(),
    filename: `compte-rendu-gestion-${year}.pdf`,
    contentType: "application/pdf",
  };
}

// ── 3. Rentabilité par lot ─────────────────────────────────────────

async function generateRentabiliteLot(opts: ReportOptions): Promise<ReportResult> {
  const { societyId, buildingId } = opts;
  const year = opts.year ?? new Date().getFullYear();
  const from = new Date(year, 0, 1); const to = new Date(year, 11, 31, 23, 59, 59);

  const lots = await prisma.lot.findMany({
    where: { building: { societyId }, ...(buildingId ? { buildingId } : {}) },
    include: {
      building: true,
      leases: {
        where: { status: { in: ["EN_COURS", "RENOUVELE"] } },
        include: {
          invoices: {
            where: { issueDate: { gte: from, lte: to }, invoiceType: { not: "AVOIR" } },
          },
        },
        take: 1,
      },
    },
    orderBy: [{ building: { name: "asc" } }, { number: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Application gestion immobilière"; wb.created = new Date();
  const ws = wb.addWorksheet("Rentabilité par lot");
  const hFill: ExcelJS.Fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FF1E4A94"} };
  const hFont: Partial<ExcelJS.Font> = { bold:true, color:{argb:"FFFFFFFF"}, size:10 };
  const tFill: ExcelJS.Fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FFE8F0FD"} };

  ws.mergeCells("A1:H1");
  const tc = ws.getCell("A1");
  tc.value = `Tableau de rentabilité par lot — ${year}`;
  tc.font = { bold:true, size:13, color:{argb:"FF1E4A94"} };
  tc.alignment = { horizontal:"center" };
  ws.getRow(1).height = 28;

  const hdrs = ["Immeuble","Lot","Type","Statut","Loyer mensuel HC","Revenus annuels","Valeur locative marché","Occupation"];
  const cw   = [25,12,18,12,18,18,22,12];
  const hr   = ws.addRow(hdrs);
  hr.eachCell(c => { c.fill=hFill; c.font=hFont; c.alignment={horizontal:"center",vertical:"middle"}; c.border={bottom:{style:"thin",color:{argb:"FF1E4A94"}}}; });
  ws.getRow(2).height = 22;
  hdrs.forEach((_,i) => { ws.getColumn(i+1).width = cw[i]; });
  const EUR = '#,##0.00 "€"';

  let totRev = 0;
  for (const lot of lots) {
    const lease = lot.leases[0];
    const rev   = lease?.invoices.reduce((s, inv) => s + inv.totalTTC, 0) ?? 0;
    totRev += rev;
    const row = ws.addRow([
      lot.building.name, lot.number, lot.lotType.replace(/_/g," "),
      lease ? "Occupé" : "Vacant",
      lease?.currentRentHT ?? 0,
      rev,
      lot.marketRentValue ?? null,
      lot.status.replace(/_/g," "),
    ]);
    [5,6,7].forEach(ci => { row.getCell(ci).numFmt = EUR; });
    row.getCell(4).font = { color:{argb: lease ? "FF187B46" : "FFC8302E"} };
  }

  const tRow = ws.addRow(["TOTAL","","","","",totRev,null,""]);
  tRow.eachCell((c,ci) => { c.fill=tFill; c.font={bold:true}; if(ci===6) c.numFmt=EUR; });

  ws.addConditionalFormatting({ ref:"D3:D"+(lots.length+2), rules:[
    { type:"containsText", operator:"containsText", text:"Vacant", priority:1, style:{fill:{type:"pattern",pattern:"solid",fgColor:{argb:"FFFCE8E8"}}} },
  ]});

  const buf = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  return { buffer:buf, filename:`rentabilite-lots-${year}.xlsx`, contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
}

// ── 4. État des impayés ────────────────────────────────────────────

async function generateEtatImpayes(opts: ReportOptions): Promise<ReportResult> {
  const { societyId, format = "pdf" } = opts;
  const today = new Date();

  const invoices = await prisma.invoice.findMany({
    where: {
      societyId,
      invoiceType: { not: "AVOIR" },
      dueDate: { lt: today },
      status: { notIn: ["PAYE"] },
    },
    include: {
      tenant: true,
      lease: { include: { lot: { include: { building: { select:{name:true} } } } } },
    },
    orderBy: { dueDate: "asc" },
  });

  const EUR = '#,##0.00 "€"';
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook(); wb.creator = "Application gestion immobilière";
    const ws = wb.addWorksheet("Impayés");
    const hF: ExcelJS.Fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FFC8302E"} };
    const hFn: Partial<ExcelJS.Font> = { bold:true, color:{argb:"FFFFFFFF"}, size:10 };
    ws.mergeCells("A1:G1"); ws.getCell("A1").value = `État des impayés — ${today.toLocaleDateString("fr-FR")}`;
    ws.getCell("A1").font={bold:true,size:13,color:{argb:"FFC8302E"}}; ws.getCell("A1").alignment={horizontal:"center"};
    ws.getRow(1).height=28;
    const hdr=["N° facture","Locataire","Immeuble / Lot","Échéance","Montant TTC","Retard (j)","Statut"];
    ws.addRow(hdr).eachCell(c=>{c.fill=hF;c.font=hFn;c.alignment={horizontal:"center"};});
    ws.getRow(2).height=22;
    [16,25,28,14,16,14,14].forEach((w,i)=>{ws.getColumn(i+1).width=w;});
    let total=0;
    for (const inv of invoices) {
      const tn = inv.tenant.entityType==="PERSONNE_MORALE"
        ? (inv.tenant.companyName??"-")
        : `${inv.tenant.firstName??""} ${inv.tenant.lastName??""}`.trim()||"-";
      const loc = inv.lease?.lot ? `${inv.lease.lot.building.name} / ${inv.lease.lot.number}` : "-";
      const days = Math.max(0, Math.floor((today.getTime()-new Date(inv.dueDate).getTime())/86400000));
      total += inv.totalTTC;
      const row=ws.addRow([inv.invoiceNumber,tn,loc,new Date(inv.dueDate).toLocaleDateString("fr-FR"),inv.totalTTC,days,inv.status]);
      row.getCell(5).numFmt=EUR;
      if(days>30) row.getCell(6).font={color:{argb:"FFC8302E"},bold:true};
    }
    const tRow=ws.addRow(["TOTAL","","","",total,"",""]);
    tRow.getCell(5).numFmt=EUR; tRow.eachCell(c=>{c.font={bold:true};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFFCE8E8"}};});
    const buf=Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
    return {buffer:buf,filename:`impayes-${today.toISOString().slice(0,10)}.xlsx`,contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"};
  }

  // PDF
  const { bold, reg, np, save } = await initPdf("État des impayés", `Factures impayées au ${today.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`);
  let p: any = np(); let y = PH - 80;
  const total = invoices.reduce((s,i) => s+i.totalTTC, 0);

  if (invoices.length === 0) {
    p.drawText("Aucune facture impayée", {x:MRG+6,y,size:10,font:bold,color:rgb(0.09,0.48,0.27)});
    y -= 16;
    p.drawText("Toutes les factures sont à jour.", {x:MRG+6,y,size:9,font:reg,color:GRAY});
    return {buffer:await save(),filename:`impayes-${today.toISOString().slice(0,10)}.pdf`,contentType:"application/pdf"};
  }

  p.drawText(`${invoices.length} facture(s) - Total : ${formatCurrency(total)}`, {x:MRG+6,y,size:9,font:bold,color:RED});
  y -= 20;
  const WS=[85,120,105,70,75,CW-455];
  y = tr(p,reg,bold,y,["N° Facture","Locataire","Immeuble/Lot","Échéance","Montant","Retard"],WS,true);
  for (const inv of invoices) {
    if(y<60){p=np();y=PH-80;y=tr(p,reg,bold,y,["N° Facture","Locataire","Immeuble/Lot","Échéance","Montant","Retard"],WS,true);}
    const tn=inv.tenant.entityType==="PERSONNE_MORALE"?(inv.tenant.companyName??"-"):`${inv.tenant.firstName??""} ${inv.tenant.lastName??""}`.trim()||"-";
    const loc=inv.lease?.lot?`${inv.lease.lot.building.name} / ${inv.lease.lot.number}`:"-";
    const days=Math.max(0,Math.floor((today.getTime()-new Date(inv.dueDate).getTime())/86400000));
    y=tr(p,reg,bold,y,[inv.invoiceNumber,tn,loc,new Date(inv.dueDate).toLocaleDateString("fr-FR"),formatCurrency(inv.totalTTC),`${days}j`],WS);
  }
  return {buffer:await save(),filename:`impayes-${today.toISOString().slice(0,10)}.pdf`,contentType:"application/pdf"};
}

// ── 5. Récapitulatif charges locataire ─────────────────────────────

async function generateRecapChargesLocataire(opts: ReportOptions): Promise<ReportResult> {
  const { societyId, tenantId } = opts;
  const year = opts.year ?? new Date().getFullYear();
  if (!tenantId) throw new Error("tenantId requis pour ce rapport");

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, societyId } });
  if (!tenant) throw new Error("Locataire introuvable");

  const leases = await prisma.lease.findMany({
    where: { societyId, tenantId },
    include: {
      lot: { include: { building: { select:{name:true} } } },
      chargeProvisions: { where: { isActive: true } },
      chargeRegularizations: { where: { fiscalYear: year } },
      invoices: {
        where: { issueDate:{gte:new Date(year,0,1),lte:new Date(year,11,31,23,59,59)}, invoiceType:{not:"AVOIR"} },
      },
    },
  });

  const tenantName = tenant.entityType==="PERSONNE_MORALE"
    ? (tenant.companyName??"-")
    : `${tenant.firstName??""} ${tenant.lastName??""}`.trim()||"-";

  const { bold, reg: regFont, np, save } = await initPdf(
    `Recap charges - ${tenantName}`, `Exercice ${year}`
  );
  let p: any = np(); let y = PH - 80;

  if (leases.length === 0) {
    drawEmptyMessage(p, regFont, y, `Aucun bail trouvé pour ce locataire.`);
    return {
      buffer: await save(),
      filename: `charges-locataire-${tenantId.slice(0,8)}-${year}.pdf`,
      contentType: "application/pdf",
    };
  }

  y = sh(p, bold, y, "Informations locataire");
  [["Nom / Raison sociale", tenantName], ["Email", tenant.email??"-"], ["Téléphone", tenant.phone??"-"]].forEach(([l,v])=>{
    p.drawText(`${l} :`,{x:MRG+10,y,size:8,font:bold,color:GRAY});
    p.drawText(v,{x:MRG+160,y,size:8,font:regFont,color:BLACK}); y-=16;
  });
  y -= 8;

  for (const lease of leases) {
    if (y < 160) { p = np(); y = PH - 80; }
    y = sh(p, bold, y, `${lease.lot.building.name} - Lot ${lease.lot.number}  (bail du ${formatDate(new Date(lease.startDate))})`);
    const totalInv = lease.invoices.reduce((s,i) => s+i.totalTTC, 0);
    p.drawText(`Loyers appelés : ${formatCurrency(totalInv)}`, {x:MRG+10,y,size:8,font:regFont,color:BLACK}); y-=16;

    if (lease.chargeProvisions.length > 0) {
      const WS=[200,100,CW-300];
      y=tr(p,regFont,bold,y,["Provision sur charges","Mensuel",""],WS,true);
      let totProv=0;
      for (const cp of lease.chargeProvisions) {
        if(y<60){p=np();y=PH-80;} totProv+=cp.monthlyAmount;
        y=tr(p,regFont,bold,y,[cp.label,formatCurrency(cp.monthlyAmount),""],WS);
      }
      p.drawRectangle({x:MRG,y:y-14,width:CW,height:15,color:LBLUE});
      p.drawText("Total provisions/mois",{x:MRG+4,y:y-10,size:8,font:bold,color:BLUE});
      p.drawText(formatCurrency(totProv),{x:MRG+204,y:y-10,size:8,font:bold,color:BLUE}); y-=20;
    }

    for (const chargeReg of lease.chargeRegularizations) {
      if(y<60){p=np();y=PH-80;}
      p.drawText(`Régularisation ${chargeReg.fiscalYear} : charges ${formatCurrency(chargeReg.totalCharges)} / provisions ${formatCurrency(chargeReg.totalProvisions)} - Solde ${formatCurrency(chargeReg.balance)}`,
        {x:MRG+10,y,size:8,font:regFont,color:chargeReg.balance>0?RED:BLACK}); y-=16;
    }
    y -= 8;
  }
  return {
    buffer: await save(),
    filename: `charges-locataire-${tenantId.slice(0,8)}-${year}.pdf`,
    contentType: "application/pdf",
  };
}

// ── 6. Suivi des travaux et maintenances ──────────────────────────

async function generateSuiviTravaux(opts: ReportOptions): Promise<ReportResult> {
  const { societyId, buildingId } = opts;
  const year = opts.year ?? new Date().getFullYear();
  const from = new Date(year, 0, 1); const to = new Date(year, 11, 31, 23, 59, 59);

  const maintenances = await prisma.maintenance.findMany({
    where: {
      building: { societyId },
      ...(buildingId ? { buildingId } : {}),
      OR: [
        { scheduledAt: { gte: from, lte: to } },
        { completedAt: { gte: from, lte: to } },
        { createdAt:   { gte: from, lte: to } },
      ],
    },
    include: { building: { select:{name:true} } },
    orderBy: [{ building:{name:"asc"} }, { scheduledAt:"asc" }],
  });

  const wb = new ExcelJS.Workbook(); wb.creator="Application gestion immobilière"; wb.created=new Date();
  const ws = wb.addWorksheet("Suivi travaux");
  const hF: ExcelJS.Fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FF1E4A94"} };
  const hFn: Partial<ExcelJS.Font> = { bold:true, color:{argb:"FFFFFFFF"}, size:10 };

  ws.mergeCells("A1:G1"); ws.getCell("A1").value=`Suivi des travaux — ${year}`;
  ws.getCell("A1").font={bold:true,size:13,color:{argb:"FF1E4A94"}}; ws.getCell("A1").alignment={horizontal:"center"};
  ws.getRow(1).height=28;
  const hdrs=["Immeuble","Titre","Description","Coût","Payé","Planifié le","Réalisé le"];
  ws.addRow(hdrs).eachCell(c=>{c.fill=hF;c.font=hFn;c.alignment={horizontal:"center"};});
  ws.getRow(2).height=22;
  [22,25,35,14,10,14,14].forEach((w,i)=>{ws.getColumn(i+1).width=w;});

  let totCost=0;
  const byBuilding: Record<string,{cost:number,count:number}> = {};

  for (const m of maintenances) {
    const cost=m.cost??0; totCost+=cost;
    if(!byBuilding[m.building.name]) byBuilding[m.building.name]={cost:0,count:0};
    byBuilding[m.building.name].cost+=cost; byBuilding[m.building.name].count++;
    const row=ws.addRow([
      m.building.name, m.title, m.description??"",
      cost||null, m.isPaid?"Oui":"Non",
      m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString("fr-FR") : "",
      m.completedAt ? new Date(m.completedAt).toLocaleDateString("fr-FR") : "",
    ]);
    row.getCell(4).numFmt='#,##0.00 "€"';
    const bg = m.completedAt ? "FFD6F5E3" : m.scheduledAt ? "FFFFF4CE" : "FFE8F0FD";
    row.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:bg}};});
  }

  const tRow=ws.addRow(["TOTAL","","",totCost,"","",""]);
  tRow.getCell(4).numFmt='#,##0.00 "€"';
  tRow.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE8F0FD"}};c.font={bold:true};});

  // Onglet synthèse
  const ws2=wb.addWorksheet("Synthèse par immeuble");
  [30,18,18].forEach((w,i)=>{ws2.getColumn(i+1).width=w;});
  ws2.addRow(["Immeuble","Coût total","Nb interventions"]).eachCell(c=>{c.fill=hF;c.font=hFn;});
  for (const [name,{cost,count}] of Object.entries(byBuilding)) {
    const r=ws2.addRow([name,cost,count]); r.getCell(2).numFmt='#,##0.00 "€"';
  }
  const sr=ws2.addRow(["TOTAL",totCost,maintenances.length]);
  sr.eachCell(c=>{c.font={bold:true};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE8F0FD"}};});
  sr.getCell(2).numFmt='#,##0.00 "€"';

  const buf=Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  return {buffer:buf,filename:`suivi-travaux-${year}.xlsx`,contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"};
}
