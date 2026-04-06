import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import React from "react";

// ============================================================
// Types
// ============================================================

export interface ValuationReportData {
  // Société
  society: {
    name: string;
    legalForm?: string | null;
    siret?: string | null;
    address?: string | null;
  };
  // Immeuble
  building: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    buildingType: string;
    totalArea?: number | null;
    constructionYear?: number | null;
    acquisitionPrice?: number | null;
    acquisitionDate?: string | null;
  };
  // Résultats synthétiques
  valuation: {
    date: string;
    estimatedValueLow?: number | null;
    estimatedValueMid?: number | null;
    estimatedValueHigh?: number | null;
    estimatedRentalValue?: number | null;
    pricePerSqm?: number | null;
    capitalizationRate?: number | null;
  };
  // Baux en cours
  leases: Array<{
    tenant: string;
    unitDescription: string;
    area: number;
    annualRent: number;
    leaseType: string;
  }>;
  occupancyRate: number;
  totalAnnualRent: number;
  // Analyses IA
  aiAnalyses: Array<{
    provider: string;
    estimatedValue?: number | null;
    rentalValue?: number | null;
    pricePerSqm?: number | null;
    capRate?: number | null;
    confidence?: number | null;
    methodology?: string | null;
    strengths?: string[];
    weaknesses?: string[];
    opportunities?: string[];
    threats?: string[];
    narrative?: string | null;
  }>;
  // Rapports d'experts
  expertReports: Array<{
    expertName: string;
    reportDate: string;
    estimatedValue?: number | null;
    methodology?: string | null;
  }>;
  // Comparables
  comparables: Array<{
    address: string;
    city: string;
    saleDate: string;
    salePrice: number;
    builtArea?: number | null;
    pricePerSqm?: number | null;
    distanceKm?: number | null;
  }>;
}

export interface RentReportData {
  society: {
    name: string;
    legalForm?: string | null;
  };
  lease: {
    leaseType: string;
    startDate: string;
    endDate?: string | null;
    currentRentHT: number;
    tenant: string;
  };
  unit: {
    lotType: string;
    area: number;
    building: string;
    address: string;
  };
  valuation: {
    date: string;
    estimatedMarketRent?: number | null;
    estimatedRentLow?: number | null;
    estimatedRentHigh?: number | null;
    rentPerSqm?: number | null;
    deviationPercent?: number | null;
  };
  aiAnalyses: Array<{
    provider: string;
    estimatedRent?: number | null;
    rentPerSqm?: number | null;
    confidence?: number | null;
    methodology?: string | null;
    strengths?: string[];
    weaknesses?: string[];
    opportunities?: string[];
    threats?: string[];
    narrative?: string | null;
  }>;
  comparableRents: Array<{
    address: string;
    city: string;
    annualRent: number;
    area?: number | null;
    rentPerSqm?: number | null;
    distanceKm?: number | null;
  }>;
}

// ============================================================
// Styles
// ============================================================

const PRIMARY = "#2E75B6";
const DARK = "#111827";
const GRAY = "#6b7280";
const BORDER = "#d1d5db";
const LIGHT_BG = "#f3f4f6";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: DARK, paddingTop: 50, paddingBottom: 60, paddingHorizontal: 50 },
  // Cover
  coverPage: { fontFamily: "Helvetica", justifyContent: "center", alignItems: "center", paddingHorizontal: 60 },
  coverTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: PRIMARY, textAlign: "center", marginBottom: 12 },
  coverSubtitle: { fontSize: 14, color: DARK, textAlign: "center", marginBottom: 6 },
  coverMeta: { fontSize: 10, color: GRAY, textAlign: "center", marginBottom: 4 },
  coverDivider: { width: 100, height: 2, backgroundColor: PRIMARY, marginVertical: 20 },
  // Section headers
  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: PRIMARY, marginBottom: 8, marginTop: 16, borderBottomWidth: 1, borderColor: PRIMARY, paddingBottom: 3 },
  subTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 4, marginTop: 8 },
  // Text
  text: { fontSize: 9, lineHeight: 1.5, marginBottom: 4 },
  textSmall: { fontSize: 8, color: GRAY, marginBottom: 2 },
  textBold: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  // KPI row
  kpiRow: { flexDirection: "row", marginBottom: 12, gap: 8 },
  kpiBox: { flex: 1, backgroundColor: LIGHT_BG, padding: 10, borderRadius: 4, alignItems: "center" },
  kpiValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: PRIMARY },
  kpiLabel: { fontSize: 7, color: GRAY, marginTop: 2, textAlign: "center" },
  // Table
  tableHeader: { flexDirection: "row", backgroundColor: PRIMARY, paddingVertical: 4, paddingHorizontal: 6 },
  tableHeaderText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "white" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: BORDER, paddingVertical: 3, paddingHorizontal: 6 },
  tableRowAlt: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: BORDER, paddingVertical: 3, paddingHorizontal: 6, backgroundColor: "#f9fafb" },
  tableCell: { fontSize: 8 },
  // SWOT
  swotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  swotBox: { width: "48%", padding: 8, borderRadius: 4, minHeight: 60 },
  swotTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  swotItem: { fontSize: 8, marginBottom: 2, paddingLeft: 8 },
  // Footer
  footer: { position: "absolute", bottom: 25, left: 50, right: 50, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: GRAY },
});

// ============================================================
// Helpers
// ============================================================

function eur(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function pct(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `${n.toFixed(1)} %`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "N/A";
  try {
    return new Date(d).toLocaleDateString("fr-FR");
  } catch {
    return d;
  }
}

// ============================================================
// Rapport Valeur Vénale
// ============================================================

export function PropertyValuationReport({ data }: { data: ValuationReportData }) {
  const v = data.valuation;
  const firstAi = data.aiAnalyses[0];

  return (
    <Document>
      {/* PAGE DE GARDE */}
      <Page size="A4" style={[s.page, s.coverPage]}>
        <Text style={s.coverTitle}>AVIS DE VALEUR</Text>
        <View style={s.coverDivider} />
        <Text style={s.coverSubtitle}>{data.building.name}</Text>
        <Text style={s.coverMeta}>{data.building.address}, {data.building.postalCode} {data.building.city}</Text>
        <Text style={s.coverMeta}>{data.society.name}{data.society.legalForm ? ` (${data.society.legalForm})` : ""}</Text>
        <Text style={s.coverMeta}>Date : {fmtDate(v.date)}</Text>
        <PageFooter society={data.society.name} />
      </Page>

      {/* CONTENU */}
      <Page size="A4" style={s.page}>
        {/* SECTION 1 — Identification */}
        <Text style={s.sectionTitle}>1. Identification du bien</Text>
        <View style={{ flexDirection: "row", gap: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.text}>Adresse : {data.building.address}, {data.building.postalCode} {data.building.city}</Text>
            <Text style={s.text}>Type : {data.building.buildingType}</Text>
            <Text style={s.text}>Surface totale : {data.building.totalArea ? `${data.building.totalArea} m²` : "N/A"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.text}>Année de construction : {data.building.constructionYear ?? "N/A"}</Text>
            <Text style={s.text}>Prix d{"'"}acquisition : {eur(data.building.acquisitionPrice)}</Text>
            <Text style={s.text}>Date d{"'"}acquisition : {fmtDate(data.building.acquisitionDate)}</Text>
          </View>
        </View>

        {/* SECTION 2 — État locatif */}
        <Text style={s.sectionTitle}>2. État locatif</Text>
        <View style={s.kpiRow}>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{pct(data.occupancyRate)}</Text>
            <Text style={s.kpiLabel}>Taux d{"'"}occupation</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{eur(data.totalAnnualRent)}</Text>
            <Text style={s.kpiLabel}>Revenus locatifs annuels</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{data.leases.length}</Text>
            <Text style={s.kpiLabel}>Baux en cours</Text>
          </View>
        </View>

        {data.leases.length > 0 && (
          <>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { flex: 2 }]}>Locataire</Text>
              <Text style={[s.tableHeaderText, { flex: 2 }]}>Lot</Text>
              <Text style={[s.tableHeaderText, { width: 50, textAlign: "right" }]}>m²</Text>
              <Text style={[s.tableHeaderText, { width: 80, textAlign: "right" }]}>Loyer annuel</Text>
            </View>
            {data.leases.map((l, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { flex: 2 }]}>{l.tenant}</Text>
                <Text style={[s.tableCell, { flex: 2 }]}>{l.unitDescription}</Text>
                <Text style={[s.tableCell, { width: 50, textAlign: "right" }]}>{l.area}</Text>
                <Text style={[s.tableCell, { width: 80, textAlign: "right" }]}>{eur(l.annualRent)}</Text>
              </View>
            ))}
          </>
        )}

        {/* SECTION 3 — Comparables */}
        {data.comparables.length > 0 && (
          <>
            <Text style={s.sectionTitle}>3. Transactions comparables</Text>
            <Text style={s.textSmall}>{data.comparables.length} transactions identifiées (source DVF)</Text>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { flex: 3 }]}>Adresse</Text>
              <Text style={[s.tableHeaderText, { width: 60, textAlign: "right" }]}>Date</Text>
              <Text style={[s.tableHeaderText, { width: 70, textAlign: "right" }]}>Prix</Text>
              <Text style={[s.tableHeaderText, { width: 50, textAlign: "right" }]}>€/m²</Text>
              <Text style={[s.tableHeaderText, { width: 40, textAlign: "right" }]}>Dist.</Text>
            </View>
            {data.comparables.slice(0, 15).map((c, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { flex: 3 }]}>{c.address}, {c.city}</Text>
                <Text style={[s.tableCell, { width: 60, textAlign: "right" }]}>{fmtDate(c.saleDate)}</Text>
                <Text style={[s.tableCell, { width: 70, textAlign: "right" }]}>{eur(c.salePrice)}</Text>
                <Text style={[s.tableCell, { width: 50, textAlign: "right" }]}>{c.pricePerSqm ? `${Math.round(c.pricePerSqm)}` : "N/A"}</Text>
                <Text style={[s.tableCell, { width: 40, textAlign: "right" }]}>{c.distanceKm ? `${c.distanceKm} km` : "N/A"}</Text>
              </View>
            ))}
          </>
        )}

        <PageFooter society={data.society.name} />
      </Page>

      {/* PAGE 3 — Analyses IA + SWOT */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>4. Évaluations IA</Text>

        {/* KPIs synthétiques */}
        <View style={s.kpiRow}>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{eur(v.estimatedValueMid)}</Text>
            <Text style={s.kpiLabel}>Valeur retenue</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{eur(v.estimatedValueLow)} — {eur(v.estimatedValueHigh)}</Text>
            <Text style={s.kpiLabel}>Fourchette</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{eur(v.estimatedRentalValue)}</Text>
            <Text style={s.kpiLabel}>Valeur locative estimée</Text>
          </View>
        </View>

        <View style={s.kpiRow}>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{v.pricePerSqm ? `${Math.round(v.pricePerSqm)} €/m²` : "N/A"}</Text>
            <Text style={s.kpiLabel}>Prix au m²</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{pct(v.capitalizationRate)}</Text>
            <Text style={s.kpiLabel}>Taux de capitalisation</Text>
          </View>
        </View>

        {/* Comparaison IA */}
        {data.aiAnalyses.length > 1 && (
          <>
            <Text style={s.subTitle}>Comparaison des avis IA</Text>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { flex: 1 }]}>Fournisseur</Text>
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>Valeur</Text>
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>€/m²</Text>
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>Taux cap.</Text>
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>Confiance</Text>
            </View>
            {data.aiAnalyses.map((a, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { flex: 1 }]}>{a.provider}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{eur(a.estimatedValue)}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{a.pricePerSqm ? Math.round(a.pricePerSqm) : "N/A"}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{pct(a.capRate)}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{a.confidence ? `${Math.round(a.confidence * 100)}%` : "N/A"}</Text>
              </View>
            ))}
          </>
        )}

        {/* SWOT */}
        {firstAi && (
          <>
            <Text style={s.sectionTitle}>5. Analyse SWOT</Text>
            <View style={s.swotGrid}>
              <View style={[s.swotBox, { backgroundColor: "#dcfce7" }]}>
                <Text style={s.swotTitle}>Forces</Text>
                {(firstAi.strengths ?? []).map((item, i) => (
                  <Text key={i} style={s.swotItem}>- {item}</Text>
                ))}
              </View>
              <View style={[s.swotBox, { backgroundColor: "#fef3c7" }]}>
                <Text style={s.swotTitle}>Faiblesses</Text>
                {(firstAi.weaknesses ?? []).map((item, i) => (
                  <Text key={i} style={s.swotItem}>- {item}</Text>
                ))}
              </View>
              <View style={[s.swotBox, { backgroundColor: "#dbeafe" }]}>
                <Text style={s.swotTitle}>Opportunités</Text>
                {(firstAi.opportunities ?? []).map((item, i) => (
                  <Text key={i} style={s.swotItem}>- {item}</Text>
                ))}
              </View>
              <View style={[s.swotBox, { backgroundColor: "#fee2e2" }]}>
                <Text style={s.swotTitle}>Menaces</Text>
                {(firstAi.threats ?? []).map((item, i) => (
                  <Text key={i} style={s.swotItem}>- {item}</Text>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Rapports d'experts */}
        {data.expertReports.length > 0 && (
          <>
            <Text style={s.sectionTitle}>6. Rapports d{"'"}experts</Text>
            {data.expertReports.map((r, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={s.textBold}>{r.expertName} — {fmtDate(r.reportDate)}</Text>
                <Text style={s.text}>Valeur estimée : {eur(r.estimatedValue)}</Text>
                {r.methodology && <Text style={s.textSmall}>Méthode : {r.methodology}</Text>}
              </View>
            ))}
          </>
        )}

        <PageFooter society={data.society.name} />
      </Page>

      {/* PAGE 4 — Conclusion + Narrative */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>7. Conclusion</Text>

        <View style={[s.kpiRow, { marginBottom: 16 }]}>
          <View style={[s.kpiBox, { backgroundColor: "#dbeafe" }]}>
            <Text style={[s.kpiValue, { fontSize: 18 }]}>{eur(v.estimatedValueMid)}</Text>
            <Text style={s.kpiLabel}>VALEUR VÉNALE RETENUE</Text>
          </View>
        </View>

        <Text style={s.text}>
          Fourchette de valeur : {eur(v.estimatedValueLow)} à {eur(v.estimatedValueHigh)}
        </Text>
        <Text style={s.text}>
          Valeur locative de marché estimée : {eur(v.estimatedRentalValue)} / an
        </Text>

        {/* Narrative détaillée */}
        {firstAi?.narrative && (
          <>
            <Text style={s.sectionTitle}>8. Analyse détaillée</Text>
            <Text style={[s.text, { textAlign: "justify" }]}>{firstAi.narrative}</Text>
          </>
        )}

        {/* Réserves */}
        <Text style={[s.sectionTitle, { marginTop: 20 }]}>Réserves et limitations</Text>
        <Text style={s.text}>
          Cet avis de valeur est généré par intelligence artificielle et ne constitue pas une expertise certifiée
          au sens de la Charte de l{"'"}Expertise en Évaluation Immobilière. Il est fourni à titre indicatif et doit
          être confirmé par un expert agréé pour toute transaction ou engagement financier.
        </Text>
        <Text style={s.textSmall}>
          Sources : données MyGestia, DVF (Etalab), analyses IA Claude (Anthropic) et Gemini (Google).
        </Text>

        <PageFooter society={data.society.name} />
      </Page>
    </Document>
  );
}

// ============================================================
// Rapport Évaluation Loyer
// ============================================================

export function RentValuationReport({ data }: { data: RentReportData }) {
  const v = data.valuation;
  const firstAi = data.aiAnalyses[0];

  return (
    <Document>
      {/* PAGE DE GARDE */}
      <Page size="A4" style={[s.page, s.coverPage]}>
        <Text style={s.coverTitle}>ÉVALUATION DE LOYER</Text>
        <View style={s.coverDivider} />
        <Text style={s.coverSubtitle}>{data.unit.building}</Text>
        <Text style={s.coverMeta}>{data.unit.address}</Text>
        <Text style={s.coverMeta}>Lot : {data.unit.lotType} — {data.unit.area} m²</Text>
        <Text style={s.coverMeta}>Locataire : {data.lease.tenant}</Text>
        <Text style={s.coverMeta}>{data.society.name}</Text>
        <Text style={s.coverMeta}>Date : {fmtDate(v.date)}</Text>
        <PageFooter society={data.society.name} />
      </Page>

      {/* CONTENU */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>1. Situation du bail</Text>
        <View style={{ flexDirection: "row", gap: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.text}>Type de bail : {data.lease.leaseType}</Text>
            <Text style={s.text}>Début : {fmtDate(data.lease.startDate)}</Text>
            <Text style={s.text}>Fin : {fmtDate(data.lease.endDate)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.text}>Loyer actuel HT : {eur(data.lease.currentRentHT)}</Text>
            <Text style={s.text}>Surface : {data.unit.area} m²</Text>
            <Text style={s.text}>Locataire : {data.lease.tenant}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>2. Résultats de l{"'"}évaluation</Text>
        <View style={s.kpiRow}>
          <View style={[s.kpiBox, { backgroundColor: "#dbeafe" }]}>
            <Text style={s.kpiValue}>{eur(v.estimatedMarketRent)}</Text>
            <Text style={s.kpiLabel}>Loyer de marché estimé</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{eur(v.estimatedRentLow)} — {eur(v.estimatedRentHigh)}</Text>
            <Text style={s.kpiLabel}>Fourchette</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{v.deviationPercent != null ? `${v.deviationPercent > 0 ? "+" : ""}${v.deviationPercent.toFixed(1)}%` : "N/A"}</Text>
            <Text style={s.kpiLabel}>Écart vs. loyer actuel</Text>
          </View>
        </View>

        {v.rentPerSqm && (
          <Text style={s.text}>Loyer au m² estimé : {Math.round(v.rentPerSqm)} €/m²/an</Text>
        )}

        {/* Comparaison IA */}
        {data.aiAnalyses.length > 1 && (
          <>
            <Text style={s.subTitle}>Comparaison des avis IA</Text>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { flex: 1 }]}>Fournisseur</Text>
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>Loyer estimé</Text>
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>€/m²</Text>
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>Confiance</Text>
            </View>
            {data.aiAnalyses.map((a, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { flex: 1 }]}>{a.provider}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{eur(a.estimatedRent)}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{a.rentPerSqm ? Math.round(a.rentPerSqm) : "N/A"}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{a.confidence ? `${Math.round(a.confidence * 100)}%` : "N/A"}</Text>
              </View>
            ))}
          </>
        )}

        {/* SWOT */}
        {firstAi && (
          <>
            <Text style={s.sectionTitle}>3. Analyse SWOT</Text>
            <View style={s.swotGrid}>
              <View style={[s.swotBox, { backgroundColor: "#dcfce7" }]}>
                <Text style={s.swotTitle}>Forces</Text>
                {(firstAi.strengths ?? []).map((item, i) => (
                  <Text key={i} style={s.swotItem}>- {item}</Text>
                ))}
              </View>
              <View style={[s.swotBox, { backgroundColor: "#fef3c7" }]}>
                <Text style={s.swotTitle}>Faiblesses</Text>
                {(firstAi.weaknesses ?? []).map((item, i) => (
                  <Text key={i} style={s.swotItem}>- {item}</Text>
                ))}
              </View>
              <View style={[s.swotBox, { backgroundColor: "#dbeafe" }]}>
                <Text style={s.swotTitle}>Opportunités</Text>
                {(firstAi.opportunities ?? []).map((item, i) => (
                  <Text key={i} style={s.swotItem}>- {item}</Text>
                ))}
              </View>
              <View style={[s.swotBox, { backgroundColor: "#fee2e2" }]}>
                <Text style={s.swotTitle}>Menaces</Text>
                {(firstAi.threats ?? []).map((item, i) => (
                  <Text key={i} style={s.swotItem}>- {item}</Text>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Comparables */}
        {data.comparableRents.length > 0 && (
          <>
            <Text style={s.sectionTitle}>4. Loyers comparables</Text>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { flex: 3 }]}>Adresse</Text>
              <Text style={[s.tableHeaderText, { width: 80, textAlign: "right" }]}>Loyer annuel</Text>
              <Text style={[s.tableHeaderText, { width: 50, textAlign: "right" }]}>€/m²</Text>
              <Text style={[s.tableHeaderText, { width: 40, textAlign: "right" }]}>Dist.</Text>
            </View>
            {data.comparableRents.slice(0, 10).map((c, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { flex: 3 }]}>{c.address}, {c.city}</Text>
                <Text style={[s.tableCell, { width: 80, textAlign: "right" }]}>{eur(c.annualRent)}</Text>
                <Text style={[s.tableCell, { width: 50, textAlign: "right" }]}>{c.rentPerSqm ? Math.round(c.rentPerSqm) : "N/A"}</Text>
                <Text style={[s.tableCell, { width: 40, textAlign: "right" }]}>{c.distanceKm ? `${c.distanceKm} km` : "N/A"}</Text>
              </View>
            ))}
          </>
        )}

        {/* Narrative */}
        {firstAi?.narrative && (
          <>
            <Text style={s.sectionTitle}>5. Analyse détaillée</Text>
            <Text style={[s.text, { textAlign: "justify" }]}>{firstAi.narrative}</Text>
          </>
        )}

        {/* Réserves */}
        <Text style={[s.sectionTitle, { marginTop: 16 }]}>Réserves</Text>
        <Text style={s.text}>
          Cette évaluation de loyer est générée par intelligence artificielle et ne constitue pas une expertise certifiée.
          Elle est fournie à titre indicatif.
        </Text>

        <PageFooter society={data.society.name} />
      </Page>
    </Document>
  );
}

// ============================================================
// Footer
// ============================================================

function PageFooter({ society }: { society: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{society} — MyGestia</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}
