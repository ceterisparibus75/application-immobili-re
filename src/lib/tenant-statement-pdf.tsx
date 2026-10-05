import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import React from "react";
import { LEGAL_FORM_LABELS } from "@/lib/constants";
import type { StatementMovement } from "@/lib/tenant-statement-movements";

export interface TenantStatementPdfData {
  tenant: { name: string; address?: string | null; email?: string | null };
  society: {
    name: string;
    addressLine1?: string | null;
    postalCode?: string | null;
    city?: string | null;
    siret?: string | null;
    legalForm?: string | null;
    shareCapital?: number | null;
    email?: string | null;
    signatoryName?: string | null;
    logoSignedUrl?: string | null;
    legalMentions?: string | null;
  } | null;
  movements: StatementMovement[];
  summary: { totalDebit: number; totalCredit: number; balance: number };
  issuedAt: string; // ISO
  periodLabel?: string | null; // optionnel, pour "Décompte du JJ au JJ" / "Décompte au JJ/MM/AAAA"
}

const GRAY = "#6b7280";
const DARK = "#111827";
const BORDER = "#e5e7eb";
const LIGHT_BG = "#f9fafb";
const DEBIT_COLOR = "#b91c1c";
const CREDIT_COLOR = "#047857";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: DARK, paddingTop: 50, paddingBottom: 70, paddingHorizontal: 50 },
  logoContainer: { alignItems: "center", marginBottom: 12 },
  logo: { maxHeight: 72, maxWidth: 200 },
  headerRow: { flexDirection: "row", marginBottom: 24 },
  emitter: { flex: 1, paddingRight: 16 },
  recipientBox: { width: 180, padding: 12, position: "relative" },
  recipientCorner: { position: "absolute", fontSize: 10, color: "#d1d5db" },
  companyName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  smallText: { fontSize: 8, color: GRAY, marginBottom: 1 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  infoRow: { fontSize: 8.5, marginBottom: 2 },
  tableHeader: { flexDirection: "row", backgroundColor: LIGHT_BG, borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: BORDER },
  colDate: { width: 60, padding: 5 },
  colLabel: { flex: 1, padding: 5 },
  colDebit: { width: 70, padding: 5, textAlign: "right" },
  colCredit: { width: 70, padding: 5, textAlign: "right" },
  colBalance: { width: 70, padding: 5, textAlign: "right" },
  thText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  tdText: { fontSize: 8.5 },
  totalsBox: { marginTop: 12, padding: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: LIGHT_BG },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  totalLabel: { fontSize: 9, color: GRAY },
  totalValue: { fontSize: 9, textAlign: "right" },
  balanceLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK, marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderColor: BORDER },
  balanceValue: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "right", marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderColor: BORDER },
  legal: { fontSize: 7, color: GRAY, marginTop: 20, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 0, left: 40, right: 40, paddingTop: 5, paddingBottom: 10, borderTopWidth: 1, borderColor: BORDER },
  footerInfo: { fontSize: 7, color: GRAY, textAlign: "center", marginBottom: 3 },
  footerPage: { fontSize: 7, color: GRAY, textAlign: "center" },
});

function sanitizeSpaces(str: string) {
  return str.replace(/ | | | | /g, " ");
}
function fmt(v: number) {
  return sanitizeSpaces(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v));
}
function fmtNum(v: number) {
  return sanitizeSpaces(new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v));
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR");
}

function splitAddress(addr: string): [string, string] | null {
  const m = addr.match(/^(.*?)\s+(\d{5}\s*.+)$/);
  return m ? [m[1].trim(), m[2].trim()] : null;
}

export function TenantStatementPdf({ data }: { data: TenantStatementPdfData }) {
  const soc = data.society;
  const legalFormLabel =
    soc?.legalForm && soc.legalForm !== "AUTRE" && soc.legalForm !== "PERSONNE_PHYSIQUE"
      ? (LEGAL_FORM_LABELS[soc.legalForm] ?? soc.legalForm)
      : null;
  const capitalMention = legalFormLabel && soc?.shareCapital
    ? `${legalFormLabel} au capital de ${fmtNum(soc.shareCapital)}€`
    : legalFormLabel ?? (soc?.shareCapital ? `Capital social : ${fmtNum(soc.shareCapital)}€` : null);

  const footerParts = [
    soc?.addressLine1
      ? soc.addressLine1 + ([soc.postalCode, soc.city].filter(Boolean).length > 0 ? ", " + [soc.postalCode, soc.city].filter(Boolean).join(" ") : "")
      : null,
    capitalMention,
    soc?.siret ? "SIRET : " + soc.siret : null,
    soc?.email ?? null,
  ].filter((p): p is string => !!p);

  const tenantAddressLines = data.tenant.address ? splitAddress(data.tenant.address) : null;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {soc?.logoSignedUrl && (
          <View style={s.logoContainer}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={s.logo} src={soc.logoSignedUrl} />
          </View>
        )}

        <View style={s.headerRow}>
          <View style={s.emitter}>
            <Text style={s.companyName}>{soc?.name ?? ""}</Text>
            {soc?.addressLine1 && (
              <Text style={s.smallText}>
                {soc.addressLine1}
                {soc.postalCode || soc.city ? `, ${[soc.postalCode, soc.city].filter(Boolean).join(" ")}` : ""}
              </Text>
            )}
            {capitalMention && <Text style={s.smallText}>{capitalMention}</Text>}
            {soc?.siret && <Text style={s.smallText}>SIRET : {soc.siret}</Text>}
          </View>
          <View style={s.recipientBox}>
            <Text style={[s.recipientCorner, { top: 0, left: 0 }]}>+</Text>
            <Text style={[s.recipientCorner, { top: 0, right: 0 }]}>+</Text>
            <Text style={[s.recipientCorner, { bottom: 0, left: 0 }]}>+</Text>
            <Text style={[s.recipientCorner, { bottom: 0, right: 0 }]}>+</Text>
            <Text style={s.companyName}>{data.tenant.name}</Text>
            {tenantAddressLines ? (
              <>
                <Text style={s.smallText}>{tenantAddressLines[0]}</Text>
                <Text style={s.smallText}>{tenantAddressLines[1]}</Text>
              </>
            ) : data.tenant.address ? (
              <Text style={s.smallText}>{data.tenant.address}</Text>
            ) : null}
          </View>
        </View>

        <Text style={s.title}>DÉCOMPTE LOCATIF</Text>
        <Text style={s.infoRow}>Émis le : {fmtDate(data.issuedAt)}</Text>
        {data.periodLabel && <Text style={s.infoRow}>{data.periodLabel}</Text>}

        <View style={{ marginTop: 14 }}>
          <View style={s.tableHeader}>
            <Text style={[s.colDate, s.thText]}>Date</Text>
            <Text style={[s.colLabel, s.thText]}>Libellé</Text>
            <Text style={[s.colDebit, s.thText]}>Débit</Text>
            <Text style={[s.colCredit, s.thText]}>Crédit</Text>
            <Text style={[s.colBalance, s.thText]}>Solde</Text>
          </View>
          {data.movements.length === 0 ? (
            <View style={s.tableRow}>
              <Text style={{ padding: 10, fontSize: 9, color: GRAY, textAlign: "center", flex: 1 }}>
                Aucun mouvement à afficher.
              </Text>
            </View>
          ) : (
            data.movements.map((m, i) => (
              <View key={i} style={s.tableRow} wrap={false}>
                <Text style={[s.colDate, s.tdText]}>{fmtDate(m.date)}</Text>
                <Text style={[s.colLabel, s.tdText]}>{m.label}</Text>
                <Text style={[s.colDebit, s.tdText, { color: DEBIT_COLOR }]}>
                  {m.type === "debit" ? fmt(m.amount) : ""}
                </Text>
                <Text style={[s.colCredit, s.tdText, { color: CREDIT_COLOR }]}>
                  {m.type === "credit" ? fmt(m.amount) : ""}
                </Text>
                <Text
                  style={[
                    s.colBalance,
                    s.tdText,
                    { color: m.balance > 0 ? DEBIT_COLOR : m.balance < 0 ? CREDIT_COLOR : DARK },
                  ]}
                >
                  {fmt(m.balance)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={s.totalsBox}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total facturé (débit)</Text>
            <Text style={[s.totalValue, { color: DEBIT_COLOR }]}>{fmt(data.summary.totalDebit)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total réglé / avoirs (crédit)</Text>
            <Text style={[s.totalValue, { color: CREDIT_COLOR }]}>{fmt(data.summary.totalCredit)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={s.balanceLabel}>
              {data.summary.balance > 0 ? "Solde restant dû" : data.summary.balance < 0 ? "Solde créditeur en votre faveur" : "Solde équilibré"}
            </Text>
            <Text style={[s.balanceValue, { color: data.summary.balance > 0 ? DEBIT_COLOR : data.summary.balance < 0 ? CREDIT_COLOR : DARK }]}>
              {fmt(Math.abs(data.summary.balance))}
            </Text>
          </View>
        </View>

        <Text style={s.legal}>
          Document interne établi à titre informatif. Il reprend l&apos;ensemble des opérations enregistrées
          sur votre compte locataire à la date d&apos;émission ci-dessus. Toute observation doit nous être
          adressée dans les meilleurs délais.
        </Text>

        <View style={{ marginTop: 20, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 9, color: GRAY }}>Fait à {soc?.city ?? "—"}, le {fmtDate(data.issuedAt)}</Text>
          {soc?.signatoryName && (
            <Text style={{ fontSize: 9, marginTop: 2 }}>{soc.signatoryName}, pour {soc.name}</Text>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerInfo}>{footerParts.join(" · ")}</Text>
          <Text
            style={s.footerPage}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
