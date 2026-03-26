"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

const YEAR_OPTIONS = [
  { value: "all", label: "Toutes les ann\u00e9es" },
  ...YEARS.map((y) => ({ value: String(y), label: String(y) })),
];

const JOURNAL_OPTIONS = [
  { value: "all", label: "Tous les journaux" },
  { value: "VENTES", label: "Ventes" },
  { value: "BANQUE", label: "Banque" },
  { value: "OPERATIONS_DIVERSES", label: "Op\u00e9rations diverses" },
];

interface FecAnomaly {
  entryId: string;
  piece: string | null;
  message: string;
  severity: "error" | "warning";
}
interface FecStats {
  totalEntries: number;
  totalLines: number;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}
interface ValidationResult {
  lineCount: number;
  anomalies: FecAnomaly[];
  stats: FecStats;
  filename: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function ExportsFecPage() {
  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const [journal, setJournal] = useState<string>("all");
  const [validatedOnly, setValidatedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const errorCount =
    result?.anomalies.filter((a) => a.severity === "error").length ?? 0;
  const warningCount =
    result?.anomalies.filter((a) => a.severity === "warning").length ?? 0;

  async function validate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/comptabilite/fec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: year !== "all" ? year : undefined,
          journalType: journal !== "all" ? journal : undefined,
          validatedOnly,
        }),
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  const downloadParams = new URLSearchParams();
  if (year !== "all") downloadParams.set("year", year);
  if (journal !== "all") downloadParams.set("journal", journal);
  if (validatedOnly) downloadParams.set("validatedOnly", "true");
  const downloadUrl = `/api/comptabilite/fec?${downloadParams.toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/comptabilite">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Export FEC</h1>
          <p className="text-muted-foreground">
            Fichier des \u00c9critures Comptables \u2014 Format DGFiP
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Param\u00e8tres d&apos;export
          </CardTitle>
          <CardDescription>
            S\u00e9lectionnez la p\u00e9riode et le journal \u00e0 exporter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="year-select">Exercice comptable</Label>
              <NativeSelect
                id="year-select"
                options={YEAR_OPTIONS}
                value={year}
                onChange={(e) => { setYear(e.target.value); setResult(null); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="journal-select">Journal</Label>
              <NativeSelect
                id="journal-select"
                options={JOURNAL_OPTIONS}
                value={journal}
                onChange={(e) => { setJournal(e.target.value); setResult(null); }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="validated-only"
              checked={validatedOnly}
              onChange={(e) => { setValidatedOnly(e.target.checked); setResult(null); }}
              className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
            <Label htmlFor="validated-only" className="cursor-pointer">
              \u00c9critures valid\u00e9es uniquement
            </Label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={validate} disabled={loading} variant="outline">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {loading ? "Validation..." : "Valider les donn\u00e9es"}
            </Button>
            <a href={downloadUrl} download>
              <Button disabled={!result || errorCount > 0}>
                <Download className="h-4 w-4" />
                T\u00e9l\u00e9charger le FEC
              </Button>
            </a>
          </div>
          {result && errorCount > 0 && (
            <p className="text-xs text-destructive">
              Le t\u00e9l\u00e9chargement est bloqu\u00e9 : corrigez les erreurs avant
              d&apos;exporter.
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">\u00c9critures</p>
              <p className="text-2xl font-bold">{result.stats.totalEntries}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Lignes FEC</p>
              <p className="text-2xl font-bold">{result.lineCount}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Total d\u00e9bit</p>
              <p className="text-2xl font-bold">{fmt(result.stats.totalDebit)} \u20ac</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Total cr\u00e9dit</p>
              <p className="text-2xl font-bold">{fmt(result.stats.totalCredit)} \u20ac</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Nom du fichier</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {result.filename}
                </p>
              </div>
              {result.stats.balanced ? (
                <Badge className="bg-green-500">Balance OK</Badge>
              ) : (
                <Badge variant="destructive">D\u00e9s\u00e9quilibre</Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {errorCount === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                Contr\u00f4les DGFiP
              </CardTitle>
              <CardDescription>
                {errorCount === 0 && warningCount === 0
                  ? "Aucune anomalie d\u00e9tect\u00e9e \u2014 FEC conforme"
                  : errorCount + " erreur" + (errorCount !== 1 ? "s" : "") + ", " + warningCount + " avertissement" + (warningCount !== 1 ? "s" : "")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.anomalies.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Toutes les \u00e9critures sont conformes au format FEC DGFiP
                </div>
              ) : (
                <div className="space-y-2">
                  {result.anomalies.map((a, i) => (
                    <div
                      key={i}
                      className={
                        "flex items-start justify-between gap-2 rounded-md border p-3 text-sm " +
                        (a.severity === "error"
                          ? "border-destructive/50 bg-destructive/10 text-destructive"
                          : "border-amber-500/50 bg-amber-50 text-amber-800")
                      }
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{a.message}</span>
                      </div>
                      {a.piece && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {a.piece}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
