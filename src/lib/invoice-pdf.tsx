import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import React from "react";

export type InvoicePdfData = {
  invoiceNumber: string; invoiceType: string; issueDate: string; dueDate: string;
  periodStart?: string | null; periodEnd?: string | null;
  totalHT: number; totalVAT: number; totalTTC: number;
  previousBalance: number; isAvoir: boolean;
  society: {
    name: string; addressLine1?: string | null; postalCode?: string | null;
    city?: string | null; country?: string | null; phone?: string | null;
    siret?: string | null; vatNumber?: string | null; legalForm?: string | null;
    shareCapital?: number | null; bankName?: string | null;
    vatRegime?: string | null; legalMentions?: string | null;
    signatoryName?: string | null; logoSignedUrl?: string | null;
    iban?: string | null; bic?: string | null; email?: string | null;
  } | null;
  tenant: { name: string; address?: string | null; email?: string | null };
  lotLabel?: string | null;
  lines: Array<{ label: string; lotNumber?: string | null; totalHT: number; vatRate: number; totalTTC: number }>;
  payments: Array<{ paidAt: string; method?: string | null; amount: number }>;
  creditNoteForNumber?: string | null;
};

const GRAY = "#6b7280";
const DARK = "#111827";
const BORDER = "#e5e7eb";
const LIGHT_BG = "#f9fafb";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: DARK, paddingTop: 50, paddingBottom: 70, paddingHorizontal: 50 },
  logoContainer: { alignItems: "center", marginBottom: 12 },
  logo: { maxHeight: 96, maxWidth: 240 },
  headerRow: { flexDirection: "row", marginBottom: 24 },
  emitter: { flex: 1, paddingRight: 16 },
  recipientBox: { width: 180, padding: 12, position: "relative" },
  recipientCorner: { position: "absolute", fontSize: 10, color: "#d1d5db" },
  companyName: { fontSize: 12, fontFamily: "Times-Bold", marginBottom: 2 },
  smallText: { fontSize: 8, color: GRAY, marginBottom: 1 },
  title: { fontSize: 15, fontFamily: "Times-Bold", marginBottom: 4 },
  infoRow: { fontSize: 8.5, marginBottom: 2 },
  tableHeader: { flexDirection: "row", backgroundColor: LIGHT_BG, borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: BORDER },
  tableRowAlt: { flexDirection: "row", borderBottomWidth: 1, borderColor: BORDER, backgroundColor: "#fafafa" },
  colLabel: { flex: 1, padding: 5 },
  colHT: { width: 70, padding: 5, textAlign: "right" },
  colTVA: { width: 50, padding: 5, textAlign: "right" },
  colTTC: { width: 70, padding: 5, textAlign: "right" },
  thText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  tdText: { fontSize: 8.5 },
  tdSubText: { fontSize: 7, color: GRAY },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 1 },
  totalLabel: { width: 100, textAlign: "right", fontSize: 8.5, color: GRAY, paddingRight: 8 },
  totalValue: { width: 80, textAlign: "right", fontSize: 8.5 },
  totalLabelBold: { width: 100, textAlign: "right", fontSize: 9, fontFamily: "Helvetica-Bold", paddingRight: 8, paddingTop: 3, borderTopWidth: 1, borderColor: DARK },
  totalValueBold: { width: 80, textAlign: "right", fontSize: 9, fontFamily: "Helvetica-Bold", paddingTop: 3, borderTopWidth: 1, borderColor: DARK },
  paymentText: { fontSize: 8.5, color: "#059669" },
  accountRow: { flexDirection: "row", borderWidth: 1, borderColor: BORDER, marginTop: -1 },
  accountCellLeft: { flex: 1, padding: 6, fontSize: 8.5, borderRightWidth: 1, borderColor: BORDER },
  accountCellRight: { width: 100, padding: 6, fontSize: 8.5, textAlign: "right" },
  legal: { fontSize: 7, color: GRAY, marginTop: 12, lineHeight: 1.4 },
  bankSection: { marginTop: 8, fontSize: 8.5 },
  bankTitle: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  footer: { position: "absolute", bottom: 0, left: 40, right: 40, paddingTop: 5, paddingBottom: 10, borderTopWidth: 1, borderColor: BORDER },
  footerInfo: { fontSize: 7, color: GRAY, textAlign: "center", marginBottom: 3 },
  footerPage: { fontSize: 7, color: GRAY, textAlign: "center" },
});

function fmt(v: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v).replace(/ /g, " ").replace(/ /g, " "); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("fr-FR"); }

const LEGAL_FORM_LABELS: Record<string, string> = {
  SCI: "Societe Civile Immobiliere (SCI)", SARL: "SARL",
  SAS: "SAS", SA: "SA", EURL: "EURL", SASU: "SASU", SNC: "SNC", AUTRE: "Societe",
  PERSONNE_PHYSIQUE: "Proprietaire",
};

function typeTitle(invoiceType: string, isAvoir: boolean): string {
  if (isAvoir) return "AVOIR";
  if (invoiceType === "APPEL_LOYER") return "APPEL DE LOYER ET CHARGES";
  if (invoiceType === "QUITTANCE") return "QUITTANCE DE LOYER";
  if (invoiceType === "REGULARISATION_CHARGES") return "RÉGULARISATION DE CHARGES";
  if (invoiceType === "REFACTURATION") return "REFACTURATION";
  return "FACTURE";
}

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  const soc = data.society;
  const paid = data.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalToPay = data.previousBalance + data.totalTTC;

  // Mention légale : "{Forme juridique} au capital de {montant} €"
  const legalFormLabel = soc?.legalForm ? (LEGAL_FORM_LABELS[soc.legalForm] ?? soc.legalForm) : null;
  const capitalMention = legalFormLabel && soc?.shareCapital
    ? legalFormLabel + " au capital de " + new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(soc.shareCapital) + " €"
    : legalFormLabel
      ? legalFormLabel
      : soc?.shareCapital
        ? "Capital social : " + new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(soc.shareCapital) + " €"
        : null;

  const footerParts = [
    soc?.addressLine1 ? soc.addressLine1 + ([soc.postalCode, soc.city].filter(Boolean).length > 0 ? ", " + [soc.postalCode, soc.city].filter(Boolean).join(" ") : "") : null,
    capitalMention,
    soc?.siret ? "SIRET : " + soc.siret : null,
    soc?.email ?? null,
  ].filter((p): p is string => p !== null && p !== undefined && p !== "");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {soc?.logoSignedUrl ? (
          <View style={s.logoContainer}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={soc.logoSignedUrl} style={s.logo} />
          </View>
        ) : null}

        <View style={s.headerRow}>
          <View style={s.emitter}>
            <Text style={s.companyName}>{soc?.name ?? "---"}</Text>
            {soc?.addressLine1 ? <Text style={s.smallText}>{soc.addressLine1}, {[soc.postalCode, soc.city].filter(Boolean).join(" ")}</Text> : null}
            {soc?.phone ? <Text style={s.smallText}>Tél. : {soc.phone}</Text> : null}
            {soc?.legalForm && soc?.shareCapital ? (
              <Text style={s.smallText}>{LEGAL_FORM_LABELS[soc.legalForm] ?? soc.legalForm} au capital de {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(soc.shareCapital)} €</Text>
            ) : soc?.legalForm ? (
              <Text style={s.smallText}>{LEGAL_FORM_LABELS[soc.legalForm] ?? soc.legalForm}</Text>
            ) : null}
            {soc?.siret ? <Text style={s.smallText}>SIRET : {soc.siret}</Text> : null}
            {soc?.vatNumber ? <Text style={s.smallText}>N° TVA : {soc.vatNumber}</Text> : null}
          </View>
          <View style={s.recipientBox}>
            <Text style={[s.recipientCorner, { top: 2, left: 2 }]}>+</Text>
            <Text style={[s.recipientCorner, { top: 2, right: 2 }]}>+</Text>
            <Text style={[s.recipientCorner, { bottom: 2, left: 2 }]}>+</Text>
            <Text style={[s.recipientCorner, { bottom: 2, right: 2 }]}>+</Text>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 3 }}>{data.tenant.name}</Text>
            {data.tenant.address
              ? <Text style={{ fontSize: 8.5, color: GRAY }}>{data.tenant.address}</Text>
              : <Text style={{ fontSize: 8, color: "#9ca3af" }}>{data.tenant.email ?? "Adresse non renseignée"}</Text>
            }
          </View>
        </View>

        <Text style={s.title}>{typeTitle(data.invoiceType, data.isAvoir)}</Text>
        <Text style={s.infoRow}>Facture n° {data.invoiceNumber}   Émise le : {fmtDate(data.issueDate)}</Text>
        <Text style={s.infoRow}>{"Date d'échéance : "}{fmtDate(data.dueDate)}</Text>
        {data.periodStart && data.periodEnd
          ? <Text style={s.infoRow}>Période du {fmtDate(data.periodStart)} au {fmtDate(data.periodEnd)}.</Text>
          : null}
        {data.creditNoteForNumber ? <Text style={[s.infoRow, { color: GRAY }]}>Avoir pour facture {data.creditNoteForNumber}</Text> : null}
        {data.lotLabel ? <Text style={[s.infoRow, { marginTop: 2 }]}>Lot(s) : {data.lotLabel}</Text> : null}

        <View style={{ marginTop: 10, marginBottom: 4 }}>
          <View style={s.tableHeader}>
            <Text style={[s.colLabel, s.thText]}>Libellé</Text>
            <Text style={[s.colHT, s.thText]}>HT</Text>
            <Text style={[s.colTVA, s.thText]}>TVA</Text>
            <Text style={[s.colTTC, s.thText]}>TTC</Text>
          </View>
          {data.lines.map((line, i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <View style={s.colLabel}>
                <Text style={s.tdText}>{line.label}</Text>
              </View>
              <Text style={[s.colHT, s.tdText]}>{fmt(line.totalHT)}</Text>
              <Text style={[s.colTVA, s.tdText, { color: GRAY }]}>{line.vatRate.toFixed(2)} %</Text>
              <Text style={[s.colTTC, s.tdText]}>{fmt(line.totalTTC)}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 4, marginBottom: 10 }}>
          <View style={s.totalRow}><Text style={s.totalLabel}>Total HT</Text><Text style={s.totalValue}>{fmt(data.totalHT)}</Text></View>
          {data.totalVAT > 0.001 ? <View style={s.totalRow}><Text style={s.totalLabel}>TVA</Text><Text style={s.totalValue}>{fmt(data.totalVAT)}</Text></View> : null}
          <View style={s.totalRow}><Text style={s.totalLabelBold}>TOTAL TTC</Text><Text style={s.totalValueBold}>{fmt(data.totalTTC)}</Text></View>
        </View>

        {paid > 0.001 ? (
          <View style={{ marginBottom: 8 }}>
            {data.payments.map((p, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                <Text style={s.paymentText}>Règlement le {fmtDate(p.paidAt)}{p.method ? " (" + p.method + ")" : ""}</Text>
                <Text style={s.paymentText}>- {fmt(p.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4 }}>Situation de compte au {fmtDate(data.issueDate)}</Text>
        <Text style={{ fontSize: 8, color: GRAY, marginBottom: 6 }}>{"Retrouvez ci-dessous la somme totale dont vous êtes redevable. Il s'agit du montant de votre solde précédent auquel s'ajoute le montant de cette facture."}</Text>
        <View style={{ marginBottom: 12 }}>
          <View style={s.accountRow}><Text style={s.accountCellLeft}>Solde précédent</Text><Text style={s.accountCellRight}>{fmt(data.previousBalance)}</Text></View>
          <View style={s.accountRow}>
            <Text style={[s.accountCellLeft, { fontFamily: "Helvetica-Bold" }]}>Total à payer au {fmtDate(data.dueDate)}</Text>
            <Text style={[s.accountCellRight, { fontFamily: "Helvetica-Bold" }]}>{fmt(Math.max(0, totalToPay - paid))}</Text>
          </View>
        </View>

        <View style={s.legal}>
          {soc?.vatRegime === "FRANCHISE" ? <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>TVA non applicable - art. 293 B du CGI</Text> : null}
          <Text>{"Pas d'escompte pour règlement anticipé. En cas de retard de paiement, une pénalité égale à 3 fois le taux intérêt légal sera exigible (Article L 441-10, alinéa 12 du Code de Commerce). Pour tout professionnel, en sus des indemnités de retard, toute somme, y compris l'acompte, non payée à sa date d'exigibilité produira de plein droit le paiement d'une indemnité forfaitaire de 40 euros due au titre des frais de recouvrement (Art. 441-6, I al. 12 du code de commerce et D. 441-5 ibidem)."}</Text>
          {soc?.legalMentions ? <Text style={{ marginTop: 3 }}>{soc.legalMentions}</Text> : null}
        </View>

        <View style={{ alignItems: "flex-end", marginTop: 12, marginBottom: 10 }}>
          <Text style={{ fontSize: 8.5 }}>Fait à {soc?.city ?? "---"}, le {fmtDate(data.issueDate)}</Text>
          {soc?.signatoryName ? <Text style={{ fontSize: 8.5 }}>{soc.signatoryName}, pour {soc?.name}</Text> : null}
        </View>

        {(soc?.bankName || soc?.iban || soc?.bic) ? (
          <View style={s.bankSection}>
            <Text style={s.bankTitle}>Coordonnées bancaires</Text>
            {soc.bankName ? <Text>Banque : {soc.bankName}</Text> : null}
            {soc.iban ? <Text>IBAN : {soc.iban}</Text> : null}
            {soc.bic ? <Text>BIC : {soc.bic}</Text> : null}
          </View>
        ) : null}

        <View style={s.footer} fixed>
          {footerParts.length > 0 ? <Text style={s.footerInfo}>{footerParts.join("  |  ")}</Text> : null}
          <Text style={s.footerPage} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => pageNumber + " / " + totalPages} />
        </View>
      </Page>
    </Document>
  );
}
