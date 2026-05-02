import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  buildGrandLivreExportGroups,
  formatGrandLivreAmount,
  formatGrandLivreDate,
  type GrandLivreExportPayload,
} from "@/lib/grand-livre-export";

const BLUE = "#1f7fb6";
const LIGHT_BLUE = "#d9ebf8";
const ORANGE = "#e87514";
const TEXT = "#111827";
const BORDER = "#b9d8ee";
const MUTED = "#334155";

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: TEXT,
  },
  society: {
    color: BLUE,
    fontSize: 13,
    marginLeft: 4,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  orangeLine: {
    height: 1,
    backgroundColor: ORANGE,
    marginBottom: 5,
  },
  title: {
    color: ORANGE,
    fontSize: 19,
    textAlign: "center",
    marginBottom: 18,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  period: {
    color: BLUE,
    fontSize: 13,
    textAlign: "center",
    flexGrow: 1,
  },
  currency: {
    color: BLUE,
    fontSize: 12,
    width: 140,
    textAlign: "right",
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: LIGHT_BLUE,
    borderColor: BORDER,
    borderWidth: 1,
    minHeight: 18,
    alignItems: "center",
  },
  headerCell: {
    color: BLUE,
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 3,
  },
  accountBlock: {
    marginTop: 8,
    borderColor: BORDER,
    borderWidth: 1,
  },
  accountHeader: {
    flexDirection: "row",
    backgroundColor: "#edf4fa",
    borderBottomColor: BORDER,
    borderBottomWidth: 1,
    minHeight: 20,
    alignItems: "center",
  },
  accountCode: {
    width: "21%",
    color: MUTED,
    fontSize: 10,
    fontWeight: "bold",
    paddingLeft: 57,
  },
  accountLabel: {
    width: "79%",
    color: MUTED,
    fontSize: 10,
    fontWeight: "bold",
  },
  row: {
    flexDirection: "row",
    minHeight: 18,
    borderBottomColor: BORDER,
    borderBottomWidth: 0.5,
    alignItems: "center",
  },
  totalRow: {
    flexDirection: "row",
    minHeight: 18,
    backgroundColor: "#f4f8fb",
    alignItems: "center",
  },
  cell: {
    paddingHorizontal: 3,
  },
  totalLabel: {
    color: BLUE,
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  totalAmount: {
    color: BLUE,
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
  },
  amount: {
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 8,
    left: 24,
    right: 24,
    color: "#64748b",
    fontSize: 7,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

const widths = {
  date: "7%",
  piece: "14%",
  journal: "8%",
  label: "38%",
  debit: "9%",
  lettrage: "4%",
  credit: "10%",
  solde: "10%",
} as const;

function signedAmount(value: number): string {
  const formatted = formatGrandLivreAmount(Math.abs(value));
  return value < 0 ? `(${formatted})` : formatted;
}

function Cell({
  children,
  width,
  align = "left",
  strong = false,
}: {
  children: React.ReactNode;
  width: string;
  align?: "left" | "right" | "center";
  strong?: boolean;
}) {
  return (
    <Text
      style={[
        styles.cell,
        { width, textAlign: align, fontWeight: strong ? "bold" : "normal" },
      ]}
    >
      {children}
    </Text>
  );
}

export function GrandLivrePdf({ data }: { data: GrandLivreExportPayload }) {
  const groups = buildGrandLivreExportGroups(data.rows);
  const generatedAt = formatGrandLivreDate(new Date());

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.society}>{data.societyName}</Text>
        <View style={styles.orangeLine} />
        <Text style={styles.title}>Grands-Livres des Comptes Généraux</Text>

        <View style={styles.metaRow}>
          <Text style={{ width: 140 }} />
          <Text style={styles.period}>{data.periodLabel}</Text>
          <Text style={styles.currency}>Etat exprimé en Euros</Text>
        </View>

        <View style={styles.headerRow} fixed>
          <Text style={[styles.headerCell, { width: widths.date }]}>Date</Text>
          <Text style={[styles.headerCell, { width: widths.piece }]}>Pièce</Text>
          <Text style={[styles.headerCell, { width: widths.journal }]}>Journal</Text>
          <Text style={[styles.headerCell, { width: widths.label }]}>Libellé</Text>
          <Text style={[styles.headerCell, { width: widths.debit, textAlign: "right" }]}>Débit</Text>
          <Text style={[styles.headerCell, { width: widths.lettrage, textAlign: "center" }]}>Let.</Text>
          <Text style={[styles.headerCell, { width: widths.credit, textAlign: "right" }]}>Crédit</Text>
          <Text style={[styles.headerCell, { width: widths.solde, textAlign: "right" }]}>Solde</Text>
        </View>

        {groups.map((group) => (
          <View key={group.accountCode} style={styles.accountBlock}>
            <View style={styles.accountHeader}>
              <Text style={styles.accountCode}>{group.accountCode}</Text>
              <Text style={styles.accountLabel}>{group.accountLabel}</Text>
            </View>

            {group.rows.map((row) => (
              <View key={row.id} style={styles.row}>
                <Cell width={widths.date}>{formatGrandLivreDate(row.date)}</Cell>
                <Cell width={widths.piece}>{row.piece ?? ""}</Cell>
                <Cell width={widths.journal} align="center">{row.journalType}</Cell>
                <Cell width={widths.label}>{row.label}</Cell>
                <Cell width={widths.debit} align="right">
                  {row.debit > 0 ? formatGrandLivreAmount(row.debit) : ""}
                </Cell>
                <Cell width={widths.lettrage} align="center">{row.lettrage ?? ""}</Cell>
                <Cell width={widths.credit} align="right">
                  {row.credit > 0 ? formatGrandLivreAmount(row.credit) : ""}
                </Cell>
                <Cell width={widths.solde} align="right">{signedAmount(row.solde)}</Cell>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={[styles.cell, styles.totalLabel, { width: "69%" }]}>Total</Text>
              <Text style={[styles.cell, styles.totalAmount, { width: widths.debit }]}>
                {formatGrandLivreAmount(group.totalDebit)}
              </Text>
              <Text style={[styles.cell, { width: widths.lettrage }]} />
              <Text style={[styles.cell, styles.totalAmount, { width: widths.credit }]}>
                {formatGrandLivreAmount(group.totalCredit)}
              </Text>
              <Text style={[styles.cell, styles.totalAmount, { width: widths.solde }]}>
                {signedAmount(group.endingBalance)}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>{data.societyName}</Text>
          <Text>Généré le {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
