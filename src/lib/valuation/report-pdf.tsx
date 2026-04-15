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
    // Valeurs issues de la méthodologie professionnelle
    exploitationValue?: number | null;
    realisationValue?: number | null;
    renovationCosts?: number | null;
    abatementPercent?: number | null;
    comparisonValue?: number | null;
    incomeValue?: number | null;
    weightingRationale?: string | null;
    marketContext?: string | null;
    recommendations?: string[];
    caveats?: string[];
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
  // Formater manuellement pour éviter les caractères Unicode problématiques avec react-pdf
  const rounded = Math.round(n);
  const parts = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${parts} €`;
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
      {/* ============================================================ */}
      {/* PAGE DE GARDE                                                 */}
      {/* ============================================================ */}
      <Page size="A4" style={[s.page, s.coverPage]}>
        <Text style={s.coverTitle}>RAPPORT D&apos;EXPERTISE IMMOBILIÈRE</Text>
        <Text style={[s.coverMeta, { fontSize: 11, color: PRIMARY, marginBottom: 4 }]}>AVIS DE VALEUR VÉNALE</Text>
        <View style={s.coverDivider} />
        <Text style={s.coverSubtitle}>{data.building.name}</Text>
        <Text style={s.coverMeta}>{data.building.address}</Text>
        <Text style={s.coverMeta}>{data.building.postalCode} {data.building.city}</Text>
        <View style={{ marginVertical: 12 }} />
        <Text style={s.coverMeta}>Commanditaire : {data.society.name}{data.society.legalForm ? ` (${data.society.legalForm})` : ""}</Text>
        {data.society.siret && <Text style={s.coverMeta}>SIRET : {data.society.siret}</Text>}
        <Text style={s.coverMeta}>Date d&apos;évaluation : {fmtDate(v.date)}</Text>
        <View style={{ marginTop: 24 }}>
          <Text style={[s.coverMeta, { fontSize: 8, fontStyle: "italic" }]}>
            Rapport généré par analyse IA (Claude Sonnet · GPT-4o) assistée des données DVF (Demandes de Valeurs Foncières, Etalab).
          </Text>
          <Text style={[s.coverMeta, { fontSize: 8, fontStyle: "italic" }]}>
            Conforme à la Charte de l&apos;Expertise en Évaluation Immobilière (5e éd.) · Normes TEGoVA/EVS 2020 · RICS/IVS.
          </Text>
        </View>
        <PageFooter society={data.society.name} />
      </Page>

      {/* ============================================================ */}
      {/* SECTION 1-4 : Saisine · Mission · Procédure · Identification  */}
      {/* ============================================================ */}
      <Page size="A4" style={s.page}>

        {/* 1. Saisine */}
        <Text style={s.sectionTitle}>1. Saisine</Text>
        <Text style={s.text}>
          La société <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.society.name}</Text>
          {data.society.legalForm ? ` (${data.society.legalForm})` : ""}
          {data.society.siret ? `, SIRET ${data.society.siret}` : ""}
          {data.society.address ? `, dont le siège social est situé ${data.society.address}` : ""},
          a sollicité la présente expertise en vue de déterminer la valeur vénale de l&apos;immeuble désigné ci-après.
        </Text>

        {/* 2. Mission */}
        <Text style={s.sectionTitle}>2. Mission</Text>
        <Text style={s.text}>
          La mission confiée consiste à déterminer, à la date du {fmtDate(v.date)}, la valeur vénale de marché de l&apos;immeuble
          sis {data.building.address}, {data.building.postalCode} {data.building.city}.
        </Text>
        <Text style={s.text}>
          L&apos;évaluation est réalisée selon deux approches complémentaires : la méthode par capitalisation du revenu (principale)
          et la méthode par comparaison directe (recoupement). Elle distingue la Valeur d&apos;Exploitation
          (lots loués) et la Valeur de Réalisation (ensemble du patrimoine).
        </Text>

        {/* 3. Procédure d'expertise */}
        <Text style={s.sectionTitle}>3. Procédure d&apos;expertise</Text>
        <Text style={s.text}>
          L&apos;expertise est conduite à partir des données transmises par le commanditaire (baux en cours, charges, diagnostics,
          historique d&apos;acquisition) et des données de marché issues de la base DVF (Demandes de Valeurs Foncières, Etalab)
          portant sur les mutations comparables de la commune et des communes limitrophes.
        </Text>
        <Text style={s.text}>
          Les résultats sont consolidés par analyse croisée de deux moteurs d&apos;intelligence artificielle (Claude Sonnet d&apos;Anthropic
          et GPT-4o d&apos;OpenAI), chacun appliquant de façon indépendante les méthodologies expertales françaises.
        </Text>

        {/* 4. Identification du bien */}
        <Text style={s.sectionTitle}>4. Identification et description du bien</Text>
        <View style={{ flexDirection: "row", gap: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.textBold}>Désignation</Text>
            <Text style={s.text}>Adresse : {data.building.address}</Text>
            <Text style={s.text}>{data.building.postalCode} {data.building.city}</Text>
            <Text style={s.text}>Type : {data.building.buildingType}</Text>
            <Text style={s.text}>Surface totale : {data.building.totalArea ? `${data.building.totalArea} m²` : "N/A"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.textBold}>Historique</Text>
            <Text style={s.text}>Année de construction : {data.building.constructionYear ?? "N/A"}</Text>
            <Text style={s.text}>Prix d&apos;acquisition : {eur(data.building.acquisitionPrice)}</Text>
            <Text style={s.text}>Date d&apos;acquisition : {fmtDate(data.building.acquisitionDate)}</Text>
          </View>
        </View>

        <PageFooter society={data.society.name} />
      </Page>

      {/* ============================================================ */}
      {/* SECTION 5-6 : Servitudes · Fiscalité                         */}
      {/* ============================================================ */}
      <Page size="A4" style={s.page}>

        {/* 5. Servitudes et contraintes urbanistiques */}
        <Text style={s.sectionTitle}>5. Servitudes et contraintes urbanistiques</Text>
        <Text style={s.text}>
          Sauf indication contraire des documents fournis, l&apos;évaluation est réalisée en l&apos;état apparent du bien,
          sans recherche exhaustive des servitudes. L&apos;expert recommande de procéder à une vérification des règles
          d&apos;urbanisme locales (PLU, plan de prévention des risques) et de l&apos;état hypothécaire auprès du service
          de la publicité foncière compétent.
        </Text>
        {(firstAi?.caveats ?? []).length > 0 && (
          <>
            <Text style={s.subTitle}>Réserves relevées par l&apos;analyse</Text>
            {(firstAi?.caveats ?? []).map((c, i) => (
              <Text key={i} style={s.text}>• {c}</Text>
            ))}
          </>
        )}

        {/* 6. Fiscalité */}
        <Text style={s.sectionTitle}>6. Fiscalité</Text>
        <Text style={s.text}>
          Les valeurs déterminées dans le présent rapport s&apos;entendent hors droits et hors fiscalité.
          Elles ne préjugent pas des impôts et taxes susceptibles de s&apos;appliquer à la cession
          (droits d&apos;enregistrement ~7,5% pour les locaux professionnels, ~8% pour l&apos;habitation) ni
          des impôts sur les plus-values éventuelles.
        </Text>
        <Text style={s.text}>
          Les frais d&apos;acquisition estimés sont inclus dans le raisonnement de la méthode par capitalisation
          conformément aux pratiques expertales françaises.
        </Text>

        {/* 7. Situation locative */}
        <Text style={s.sectionTitle}>7. Situation locative</Text>
        <View style={s.kpiRow}>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{pct(data.occupancyRate)}</Text>
            <Text style={s.kpiLabel}>Taux d&apos;occupation</Text>
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
              <Text style={[s.tableHeaderText, { flex: 2 }]}>Lot / Destination</Text>
              <Text style={[s.tableHeaderText, { width: 50, textAlign: "right" }]}>m²</Text>
              <Text style={[s.tableHeaderText, { width: 80, textAlign: "right" }]}>Loyer annuel HT</Text>
              <Text style={[s.tableHeaderText, { width: 60, textAlign: "right" }]}>Type de bail</Text>
            </View>
            {data.leases.map((l, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { flex: 2 }]}>{l.tenant}</Text>
                <Text style={[s.tableCell, { flex: 2 }]}>{l.unitDescription}</Text>
                <Text style={[s.tableCell, { width: 50, textAlign: "right" }]}>{l.area}</Text>
                <Text style={[s.tableCell, { width: 80, textAlign: "right" }]}>{eur(l.annualRent)}</Text>
                <Text style={[s.tableCell, { width: 60, textAlign: "right" }]}>{l.leaseType}</Text>
              </View>
            ))}
          </>
        )}

        <PageFooter society={data.society.name} />
      </Page>

      {/* ============================================================ */}
      {/* SECTION 8 : Marché immobilier                                */}
      {/* ============================================================ */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>8. Marché immobilier — Contexte et comparables</Text>

        {firstAi?.marketContext && (
          <>
            <Text style={s.subTitle}>Contexte de marché</Text>
            <Text style={[s.text, { textAlign: "justify" }]}>{firstAi.marketContext}</Text>
          </>
        )}

        {data.comparables.length > 0 && (
          <>
            <Text style={s.subTitle}>
              Transactions comparables DVF ({data.comparables.length} mutations — commune et environs)
            </Text>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { flex: 3 }]}>Adresse</Text>
              <Text style={[s.tableHeaderText, { width: 60, textAlign: "right" }]}>Date</Text>
              <Text style={[s.tableHeaderText, { width: 70, textAlign: "right" }]}>Prix total</Text>
              <Text style={[s.tableHeaderText, { width: 50, textAlign: "right" }]}>€/m²</Text>
              <Text style={[s.tableHeaderText, { width: 40, textAlign: "right" }]}>Dist.</Text>
            </View>
            {data.comparables.slice(0, 20).map((c, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { flex: 3 }]}>{c.address}, {c.city}</Text>
                <Text style={[s.tableCell, { width: 60, textAlign: "right" }]}>{fmtDate(c.saleDate)}</Text>
                <Text style={[s.tableCell, { width: 70, textAlign: "right" }]}>{eur(c.salePrice)}</Text>
                <Text style={[s.tableCell, { width: 50, textAlign: "right" }]}>
                  {c.pricePerSqm ? `${Math.round(c.pricePerSqm)}` : "N/A"}
                </Text>
                <Text style={[s.tableCell, { width: 40, textAlign: "right" }]}>
                  {c.distanceKm != null ? `${c.distanceKm} km` : "N/A"}
                </Text>
              </View>
            ))}
            <Text style={[s.textSmall, { marginTop: 4 }]}>
              Source : DVF (Demandes de Valeurs Foncières), données Etalab / data.gouv.fr — nature_mutation = Vente.
            </Text>
          </>
        )}

        <PageFooter society={data.society.name} />
      </Page>

      {/* ============================================================ */}
      {/* SECTION 9-11 : Étude de valeur · Recoupement · Valeur globale */}
      {/* ============================================================ */}
      <Page size="A4" style={s.page}>

        {/* 9. Étude de valeur */}
        <Text style={s.sectionTitle}>9. Étude de valeur — Méthodes appliquées</Text>

        {/* Méthode par capitalisation */}
        <Text style={s.subTitle}>9.1 Méthode par capitalisation du revenu (principale)</Text>
        {firstAi?.incomeValue != null || firstAi?.exploitationValue != null ? (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            {firstAi?.exploitationValue != null && (
              <View style={[s.kpiBox, { backgroundColor: "#dbeafe", flex: 1 }]}>
                <Text style={s.kpiValue}>{eur(firstAi.exploitationValue)}</Text>
                <Text style={s.kpiLabel}>Valeur d&apos;Exploitation</Text>
                <Text style={[s.textSmall, { textAlign: "center", marginTop: 2 }]}>Lots loués uniquement</Text>
              </View>
            )}
            {firstAi?.realisationValue != null && (
              <View style={[s.kpiBox, { backgroundColor: "#f0fdf4", flex: 1 }]}>
                <Text style={s.kpiValue}>{eur(firstAi.realisationValue)}</Text>
                <Text style={s.kpiLabel}>Valeur de Réalisation</Text>
                <Text style={[s.textSmall, { textAlign: "center", marginTop: 2 }]}>
                  Tous lots
                  {firstAi?.abatementPercent != null && firstAi.abatementPercent > 0
                    ? ` − abatt. ${firstAi.abatementPercent}%`
                    : ""}
                </Text>
              </View>
            )}
            {firstAi?.incomeValue != null && (
              <View style={[s.kpiBox, { flex: 1 }]}>
                <Text style={s.kpiValue}>{eur(firstAi.incomeValue)}</Text>
                <Text style={s.kpiLabel}>Valeur par capitalisation</Text>
                <Text style={[s.textSmall, { textAlign: "center", marginTop: 2 }]}>
                  Taux : {v.capitalizationRate ? `${v.capitalizationRate.toFixed(1)}%` : "N/A"}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={s.text}>Données insuffisantes pour la méthode par capitalisation.</Text>
        )}

        {firstAi?.renovationCosts != null && firstAi.renovationCosts > 0 && (
          <Text style={[s.textSmall, { marginBottom: 4 }]}>
            Coûts de remise en état lots vacants estimés : {eur(firstAi.renovationCosts)}
          </Text>
        )}

        {/* Méthode par comparaison */}
        <Text style={s.subTitle}>9.2 Méthode par comparaison directe (recoupement)</Text>
        {firstAi?.comparisonValue != null ? (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <View style={[s.kpiBox, { backgroundColor: "#faf5ff", flex: 1 }]}>
              <Text style={s.kpiValue}>{eur(firstAi.comparisonValue)}</Text>
              <Text style={s.kpiLabel}>Valeur par comparaison</Text>
              <Text style={[s.textSmall, { textAlign: "center", marginTop: 2 }]}>Basée sur les comparables DVF</Text>
            </View>
          </View>
        ) : (
          <Text style={s.text}>Comparaison directe non calculée (absence de comparables suffisants).</Text>
        )}

        {/* 10. Recoupement */}
        <Text style={s.sectionTitle}>10. Recoupement et pondération</Text>
        {firstAi?.weightingRationale ? (
          <Text style={[s.text, { textAlign: "justify" }]}>{firstAi.weightingRationale}</Text>
        ) : (
          <Text style={s.text}>
            La valeur vénale retenue résulte de la pondération des deux méthodes.
            La méthode par capitalisation est prépondérante pour les biens loués ;
            la méthode par comparaison sert de recoupement.
          </Text>
        )}

        {/* 11. Valeur globale */}
        <Text style={s.sectionTitle}>11. Valeur globale retenue</Text>
        <View style={s.kpiRow}>
          <View style={[s.kpiBox, { backgroundColor: "#dbeafe", flex: 2 }]}>
            <Text style={[s.kpiValue, { fontSize: 16 }]}>{eur(v.estimatedValueMid)}</Text>
            <Text style={s.kpiLabel}>VALEUR VÉNALE RETENUE</Text>
          </View>
          <View style={[s.kpiBox, { flex: 1 }]}>
            <Text style={s.kpiValue}>{eur(v.estimatedValueLow)}</Text>
            <Text style={s.kpiLabel}>Borne basse</Text>
          </View>
          <View style={[s.kpiBox, { flex: 1 }]}>
            <Text style={s.kpiValue}>{eur(v.estimatedValueHigh)}</Text>
            <Text style={s.kpiLabel}>Borne haute</Text>
          </View>
        </View>
        <View style={s.kpiRow}>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{eur(v.estimatedRentalValue)}</Text>
            <Text style={s.kpiLabel}>Valeur locative / an</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{v.pricePerSqm ? `${Math.round(v.pricePerSqm)} €/m²` : "N/A"}</Text>
            <Text style={s.kpiLabel}>Prix au m²</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{pct(v.capitalizationRate)}</Text>
            <Text style={s.kpiLabel}>Taux de capitalisation</Text>
          </View>
        </View>

        <PageFooter society={data.society.name} />
      </Page>

      {/* ============================================================ */}
      {/* SECTION 12 : Fiche de résumé + Comparaison IA                */}
      {/* ============================================================ */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>12. Fiche de résumé</Text>

        {/* Tableau synthèse */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderText, { flex: 2 }]}>Critère</Text>
          <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>Valeur</Text>
        </View>
        {[
          { label: "Adresse", value: `${data.building.address}, ${data.building.postalCode} ${data.building.city}` },
          { label: "Type de bien", value: data.building.buildingType },
          { label: "Surface totale", value: data.building.totalArea ? `${data.building.totalArea} m²` : "N/A" },
          { label: "Taux d'occupation", value: `${pct(data.occupancyRate)}` },
          { label: "Revenus locatifs annuels", value: eur(data.totalAnnualRent) },
          { label: "Valeur vénale retenue", value: eur(v.estimatedValueMid) },
          { label: "Fourchette", value: `${eur(v.estimatedValueLow)} — ${eur(v.estimatedValueHigh)}` },
          { label: "Valeur d'Exploitation", value: firstAi?.exploitationValue != null ? eur(firstAi.exploitationValue) : "N/A" },
          { label: "Valeur de Réalisation", value: firstAi?.realisationValue != null ? eur(firstAi.realisationValue) : "N/A" },
          { label: "Prix au m²", value: v.pricePerSqm ? `${Math.round(v.pricePerSqm)} €/m²` : "N/A" },
          { label: "Valeur locative annuelle", value: eur(v.estimatedRentalValue) },
          { label: "Taux de capitalisation", value: pct(v.capitalizationRate) },
          { label: "Date d'évaluation", value: fmtDate(v.date) },
        ].map((row, i) => (
          <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={[s.tableCell, { flex: 2, fontFamily: "Helvetica-Bold" }]}>{row.label}</Text>
            <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{row.value}</Text>
          </View>
        ))}

        {/* Comparaison multi-IA */}
        {data.aiAnalyses.length > 1 && (
          <>
            <Text style={[s.subTitle, { marginTop: 12 }]}>Comparaison des avis IA</Text>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { flex: 1 }]}>Fournisseur</Text>
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>Valeur retenue</Text>
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>Exploitation</Text>
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>Réalisation</Text>
              <Text style={[s.tableHeaderText, { width: 45, textAlign: "right" }]}>Confiance</Text>
            </View>
            {data.aiAnalyses.map((a, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { flex: 1 }]}>{a.provider}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{eur(a.estimatedValue)}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>
                  {a.exploitationValue != null ? eur(a.exploitationValue) : "N/A"}
                </Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>
                  {a.realisationValue != null ? eur(a.realisationValue) : "N/A"}
                </Text>
                <Text style={[s.tableCell, { width: 45, textAlign: "right" }]}>
                  {a.confidence ? `${Math.round(a.confidence > 1 ? a.confidence : a.confidence * 100)}%` : "N/A"}
                </Text>
              </View>
            ))}
          </>
        )}

        <PageFooter society={data.society.name} />
      </Page>

      {/* ============================================================ */}
      {/* SECTION 13 : Analyse SWOT + Recommandations                  */}
      {/* ============================================================ */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>13. Analyse SWOT et recommandations</Text>

        {firstAi && (
          <View style={s.swotGrid}>
            <View style={[s.swotBox, { backgroundColor: "#dcfce7" }]}>
              <Text style={s.swotTitle}>Forces</Text>
              {(firstAi.strengths ?? []).map((item, i) => (
                <Text key={i} style={s.swotItem}>• {item}</Text>
              ))}
            </View>
            <View style={[s.swotBox, { backgroundColor: "#fef3c7" }]}>
              <Text style={s.swotTitle}>Faiblesses</Text>
              {(firstAi.weaknesses ?? []).map((item, i) => (
                <Text key={i} style={s.swotItem}>• {item}</Text>
              ))}
            </View>
            <View style={[s.swotBox, { backgroundColor: "#dbeafe" }]}>
              <Text style={s.swotTitle}>Opportunités</Text>
              {(firstAi.opportunities ?? []).map((item, i) => (
                <Text key={i} style={s.swotItem}>• {item}</Text>
              ))}
            </View>
            <View style={[s.swotBox, { backgroundColor: "#fee2e2" }]}>
              <Text style={s.swotTitle}>Menaces</Text>
              {(firstAi.threats ?? []).map((item, i) => (
                <Text key={i} style={s.swotItem}>• {item}</Text>
              ))}
            </View>
          </View>
        )}

        {(firstAi?.recommendations ?? []).length > 0 && (
          <>
            <Text style={s.subTitle}>Recommandations</Text>
            {(firstAi?.recommendations ?? []).map((r, i) => (
              <Text key={i} style={s.text}>• {r}</Text>
            ))}
          </>
        )}

        {/* Rapports d'experts */}
        {data.expertReports.length > 0 && (
          <>
            <Text style={[s.subTitle, { marginTop: 10 }]}>Avis d&apos;experts humains</Text>
            {data.expertReports.map((r, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={s.textBold}>{r.expertName} — {fmtDate(r.reportDate)}</Text>
                <Text style={s.text}>Valeur estimée : {eur(r.estimatedValue)}</Text>
                {r.methodology && <Text style={s.textSmall}>Méthode : {r.methodology}</Text>}
              </View>
            ))}
          </>
        )}

        <PageFooter society={data.society.name} />
      </Page>

      {/* ============================================================ */}
      {/* SECTION 14-15 : Conclusion · Clauses · Annexes (narrative)   */}
      {/* ============================================================ */}
      <Page size="A4" style={s.page}>

        {/* 14. Conclusion */}
        <Text style={s.sectionTitle}>14. Conclusion</Text>
        <Text style={s.text}>
          Au terme des investigations menées et en l&apos;état du marché immobilier à la date du {fmtDate(v.date)},
          il est retenu pour le bien objet de la présente expertise une valeur vénale de :
        </Text>
        <View style={[s.kpiRow, { marginVertical: 10 }]}>
          <View style={[s.kpiBox, { backgroundColor: "#dbeafe", flex: 1 }]}>
            <Text style={[s.kpiValue, { fontSize: 18, color: PRIMARY }]}>{eur(v.estimatedValueMid)}</Text>
            <Text style={[s.kpiLabel, { fontSize: 9 }]}>VALEUR VÉNALE — VALEUR RETENUE</Text>
            <Text style={[s.textSmall, { textAlign: "center", marginTop: 4 }]}>
              Fourchette : {eur(v.estimatedValueLow)} à {eur(v.estimatedValueHigh)}
            </Text>
          </View>
        </View>

        {firstAi?.narrative && (
          <>
            <Text style={s.subTitle}>Analyse détaillée</Text>
            <Text style={[s.text, { textAlign: "justify" }]}>{firstAi.narrative}</Text>
          </>
        )}

        {/* 15. Clauses d'utilisation */}
        <Text style={[s.sectionTitle, { marginTop: 16 }]}>15. Clauses d&apos;utilisation et limitations</Text>
        <Text style={[s.text, { textAlign: "justify" }]}>
          Le présent avis de valeur est établi sur la base des informations communiquées par le commanditaire
          et des données de marché disponibles à la date d&apos;évaluation. Il est destiné exclusivement à l&apos;usage
          du commanditaire. Toute utilisation à des fins autres que celles spécifiées dans la mission, notamment
          pour des opérations de crédit, de cession ou de nantissement, doit faire l&apos;objet d&apos;une expertise
          certifiée réalisée par un expert indépendant agréé.
        </Text>
        <Text style={[s.text, { textAlign: "justify" }]}>
          L&apos;évaluation IA ne se substitue pas à une expertise au sens de la Charte de l&apos;Expertise en Évaluation
          Immobilière (5ème édition) ni à une instruction par un expert agréé REV/FRICS. Elle constitue un outil
          d&apos;aide à la décision et doit être confirmée par un professionnel habilité pour tout engagement financier.
        </Text>
        <Text style={s.textSmall}>
          Sources : données transmises par le commanditaire — DVF (Demandes de Valeurs Foncières, Etalab, data.gouv.fr) —
          Analyses IA : Claude Sonnet (Anthropic) et GPT-4o (OpenAI).
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
            <Text style={s.text}>Loyer actuel HT annuel : {eur(data.lease.currentRentHT)}/an</Text>
            <Text style={s.text}>Surface : {data.unit.area} m²</Text>
            <Text style={s.text}>Locataire : {data.lease.tenant}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>2. Résultats de l{"'"}évaluation</Text>
        <View style={s.kpiRow}>
          <View style={[s.kpiBox, { backgroundColor: "#dbeafe" }]}>
            <Text style={s.kpiValue}>{eur(v.estimatedMarketRent)}</Text>
            <Text style={s.kpiLabel}>Loyer de marché estimé (annuel)</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiValue}>{eur(v.estimatedRentLow)} — {eur(v.estimatedRentHigh)}</Text>
            <Text style={s.kpiLabel}>Fourchette (annuel)</Text>
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
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>Loyer estimé/an</Text>
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>€/m²</Text>
              <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>Confiance</Text>
            </View>
            {data.aiAnalyses.map((a, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { flex: 1 }]}>{a.provider}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{eur(a.estimatedRent)}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{a.rentPerSqm ? Math.round(a.rentPerSqm) : "N/A"}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{a.confidence ? `${Math.round(a.confidence > 1 ? a.confidence : a.confidence * 100)}%` : "N/A"}</Text>
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
