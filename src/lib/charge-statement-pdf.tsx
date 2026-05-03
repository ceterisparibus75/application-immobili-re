import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import React from "react";

export type ChargeCategory = {
  categoryName: string;
  nature: string;
  totalAmount: number;
  recoverableAmount: number;
  allocationMethod: string;
  allocationRate: number;
  tenantShare: number;
};

export type ChargeStatementPdfData = {
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  tenantName: string;
  lotNumber: string;
  buildingName: string;
  totalCharges: number;
  totalProvisions: number;
  balance: number;
  categories: ChargeCategory[];
  prorataDays: number;
  society: {
    name: string;
    addressLine1?: string | null;
    postalCode?: string | null;
    city?: string | null;
    email?: string | null;
  } | null;
};

const GRAY = "#6b7280";
const DARK = "#111827";
const BORDER = "#e5e7eb";
const LIGHT_BG = "#f9fafb";
const BRAND = "#1B4F8A";
const POSITIVE = "#059669";
const NEGATIVE = "#DC2626";

function sanitizeSpaces(str: string) {
  return str.replace(/ | | | |⁠/g, " ");
}
function fmt(v: number) {
  return sanitizeSpaces(
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v)
  );
}
function fmtDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR");
}
function fmtPct(v: number) {
  return sanitizeSpaces(
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v) + " %"
  );
}
function dateOnly(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}
function inclusivePeriodDays(startIso: string, endIso: string) {
  const start = dateOnly(startIso);
  const end = dateOnly(endIso);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

const NATURE_LABELS: Record<string, string> = {
  RECUPERABLE: "Recuper.",
  PARTIELLE: "Partielle",
  PROPRIETAIRE: "Propr.",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 44,
  },
  headerRow: { flexDirection: "row", marginBottom: 20 },
  societyBlock: { flex: 1, paddingRight: 16 },
  societyName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BRAND, marginBottom: 3 },
  societyAddr: { fontSize: 8.5, color: GRAY, marginBottom: 1 },
  titleBlock: { width: 200, alignItems: "flex-end" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 4, textAlign: "right" },
  titleYear: { fontSize: 12, color: BRAND, fontFamily: "Helvetica-Bold", textAlign: "right" },
  infoBox: {
    flexDirection: "row",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
  },
  infoCell: { flex: 1, padding: 8 },
  infoLabel: { fontSize: 7.5, color: GRAY, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 2 },
  infoValue: { fontSize: 9, color: DARK },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: LIGHT_BG,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: BORDER },
  tableRowAlt: { flexDirection: "row", borderBottomWidth: 1, borderColor: BORDER, backgroundColor: "#fafafa" },
  colCat: { flex: 1.6, padding: 5 },
  colNat: { width: 52, padding: 5, textAlign: "center" },
  colAmt: { width: 68, padding: 5, textAlign: "right" },
  colRecov: { width: 68, padding: 5, textAlign: "right" },
  colKey: { width: 52, padding: 5, textAlign: "right" },
  colShare: { width: 72, padding: 5, textAlign: "right" },
  thText: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  tdText: { fontSize: 8.5 },
  summaryRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  sumLabel: { width: 150, textAlign: "right", fontSize: 9, color: GRAY, paddingRight: 8 },
  sumValue: { width: 80, textAlign: "right", fontSize: 9 },
  sumLabelBold: {
    width: 150,
    textAlign: "right",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    paddingRight: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderColor: DARK,
  },
  sumValueBold: {
    width: 80,
    textAlign: "right",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    paddingTop: 4,
    borderTopWidth: 1,
    borderColor: DARK,
  },
  noteBox: {
    marginTop: 16,
    padding: 8,
    backgroundColor: LIGHT_BG,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
  },
  noteText: { fontSize: 8, color: GRAY },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 44,
    right: 44,
    paddingTop: 5,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  footerText: { fontSize: 7, color: GRAY, textAlign: "center" },
});

export function ChargeStatementPdf({ data }: { data: ChargeStatementPdfData }) {
  const soc = data.society;
  const isDebt = data.balance > 0;
  const isZeroBalance = Math.abs(data.balance) < 0.01;
  const balanceColor = isZeroBalance ? DARK : isDebt ? NEGATIVE : POSITIVE;
  const balanceLabel = isZeroBalance ? "Solde nul" : isDebt ? "Complement a payer" : "Avoir a rembourser";
  const periodDays = inclusivePeriodDays(data.periodStart, data.periodEnd);
  const hasProrata = data.prorataDays > 0 && data.prorataDays < periodDays;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.societyBlock}>
            {soc && <Text style={s.societyName}>{soc.name}</Text>}
            {soc?.addressLine1 && <Text style={s.societyAddr}>{soc.addressLine1}</Text>}
            {(soc?.postalCode || soc?.city) && (
              <Text style={s.societyAddr}>{[soc.postalCode, soc.city].filter(Boolean).join(" ")}</Text>
            )}
            {soc?.email && <Text style={s.societyAddr}>{soc.email}</Text>}
          </View>
          <View style={s.titleBlock}>
            <Text style={s.title}>Decompte annuel{"\n"}de charges</Text>
            <Text style={s.titleYear}>Exercice {data.fiscalYear}</Text>
          </View>
        </View>

        {/* Info tenant / lot */}
        <View style={s.infoBox}>
          <View style={[s.infoCell, { borderRightWidth: 1, borderRightColor: BORDER }]}>
            <Text style={s.infoLabel}>Locataire</Text>
            <Text style={s.infoValue}>{data.tenantName}</Text>
          </View>
          <View style={[s.infoCell, { borderRightWidth: 1, borderRightColor: BORDER }]}>
            <Text style={s.infoLabel}>Lot</Text>
            <Text style={s.infoValue}>{data.lotNumber} — {data.buildingName}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Periode</Text>
            <Text style={s.infoValue}>{fmtDate(data.periodStart)} – {fmtDate(data.periodEnd)}</Text>
          </View>
        </View>

        {/* Categories table */}
        {data.categories.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Detail des charges recuperables</Text>
            <View style={s.tableHeader}>
              <View style={s.colCat}><Text style={s.thText}>Categorie</Text></View>
              <View style={s.colNat}><Text style={s.thText}>Nature</Text></View>
              <View style={s.colAmt}><Text style={s.thText}>Total</Text></View>
              <View style={s.colRecov}><Text style={s.thText}>Recuper.</Text></View>
              <View style={s.colKey}><Text style={s.thText}>Cle (%)</Text></View>
              <View style={s.colShare}><Text style={s.thText}>Votre part</Text></View>
            </View>
            {data.categories.map((cat, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <View style={s.colCat}><Text style={s.tdText}>{cat.categoryName}</Text></View>
                <View style={s.colNat}><Text style={s.tdText}>{NATURE_LABELS[cat.nature] ?? cat.nature}</Text></View>
                <View style={s.colAmt}><Text style={s.tdText}>{fmt(cat.totalAmount)}</Text></View>
                <View style={s.colRecov}><Text style={s.tdText}>{fmt(cat.recoverableAmount)}</Text></View>
                <View style={s.colKey}><Text style={s.tdText}>{fmtPct(cat.allocationRate)}</Text></View>
                <View style={s.colShare}><Text style={s.tdText}>{fmt(cat.tenantShare)}</Text></View>
              </View>
            ))}
          </>
        )}

        {/* Summary */}
        <Text style={s.sectionTitle}>Recapitulatif</Text>
        <View style={s.summaryRow}>
          <Text style={s.sumLabel}>Charges recuperables (votre part)</Text>
          <Text style={s.sumValue}>{fmt(data.totalCharges)}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.sumLabel}>Provisions versees</Text>
          <Text style={s.sumValue}>{fmt(data.totalProvisions)}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={[s.sumLabelBold]}>{balanceLabel}</Text>
          <Text style={[s.sumValueBold, { color: balanceColor }]}>
            {isDebt ? "+" : ""}{fmt(Math.abs(data.balance))}
          </Text>
        </View>

        {/* Prorata note */}
        {hasProrata && (
          <View style={s.noteBox}>
            <Text style={s.noteText}>
              Note : votre occupation couvre {data.prorataDays} jours sur {periodDays} (prorata {Math.round((data.prorataDays / periodDays) * 100)} %). Les charges ont ete calculees au prorata de votre presence.
            </Text>
          </View>
        )}

        <View style={s.noteBox}>
          <Text style={s.noteText}>
            Les justificatifs de charges sont tenus a votre disposition pendant le delai legal de consultation. Les montants presentes correspondent aux charges recuperables et aux cles de repartition applicables a votre lot.
          </Text>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {soc?.name ?? "Votre gestionnaire"} — Decompte annuel de charges {data.fiscalYear} — {data.tenantName}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateChargeStatementPdfBuffer(data: ChargeStatementPdfData): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  return renderToBuffer(<ChargeStatementPdf data={data} />) as unknown as Promise<Buffer>;
}
