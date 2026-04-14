"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
  ArrowRight, X, ArrowDownLeft, ArrowUpRight, Sparkles, FileText,
} from "lucide-react";
import { importBankStatement, type ImportRow } from "@/actions/bank";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type Step = "upload" | "analyzing" | "mapping" | "preview" | "result";

type ParsedFile = {
  headers: string[];
  rows: Record<string, string>[];
  filename: string;
};

type ColumnMapping = {
  date: string;
  amount: string;
  label: string;
  reference: string;
  // Pour le cas où débit/crédit sont dans 2 colonnes séparées
  debit: string;
  credit: string;
  amountMode: "single" | "split";
};

// ── Composant principal ──────────────────────────────────────────────────────

export default function ImportStatement({
  bankAccountId,
  societyId,
}: {
  bankAccountId: string;
  societyId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: "", amount: "", label: "", reference: "",
    debit: "", credit: "", amountMode: "single",
  });
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; duplicates: number } | null>(null);
  const [isPdf, setIsPdf] = useState(false);

  // ── Étape 1 : Upload ───────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    const isPdfFile = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

    if (isPdfFile) {
      // Flux PDF → analyse IA directe
      setIsPdf(true);
      setStep("analyzing");

      try {
        const formData = new FormData();
        formData.append("file", f);

        const res = await fetch("/api/bank/parse-pdf", {
          method: "POST",
          body: formData,
        });

        const data = (await res.json()) as { rows?: ImportRow[]; error?: string };

        if (!res.ok || !data.rows) {
          toast.error(data.error ?? "Erreur lors de l'analyse IA du PDF");
          setStep("upload");
          setIsPdf(false);
          return;
        }

        setParsedRows(data.rows);
        setFile({ headers: [], rows: [], filename: f.name });
        setStep("preview");
      } catch {
        toast.error("Impossible d'analyser le PDF. Vérifiez votre connexion.");
        setStep("upload");
        setIsPdf(false);
      }
      return;
    }

    // Flux CSV/XLSX existant
    setIsPdf(false);
    const buffer = await f.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const { parseImportFile } = await import("@/lib/import-parser");
    const result = await parseImportFile(
      Buffer.from(base64, "base64"),
      f.name
    );

    if (result.headers.length === 0) {
      toast.error("Fichier vide ou format non reconnu");
      return;
    }

    setFile({ headers: result.headers, rows: result.rows, filename: f.name });

    // Auto-détecter les colonnes par nom
    const lower = result.headers.map((h) => h.toLowerCase().trim());
    const autoMapping: ColumnMapping = {
      date: "",
      amount: "",
      label: "",
      reference: "",
      debit: "",
      credit: "",
      amountMode: "single",
    };

    for (let i = 0; i < lower.length; i++) {
      const h = lower[i];
      const original = result.headers[i];
      if (/date.*op|date.*val|date/i.test(h)) autoMapping.date ||= original;
      if (/montant|amount|solde/i.test(h) && !/solde.*apres|solde.*avant/i.test(h)) autoMapping.amount ||= original;
      if (/lib[eé]ll[eé]|label|description|motif|communication/i.test(h)) autoMapping.label ||= original;
      if (/r[eé]f[eé]rence|reference|ref\b/i.test(h)) autoMapping.reference ||= original;
      if (/d[eé]bit|debit/i.test(h)) autoMapping.debit ||= original;
      if (/cr[eé]dit|credit/i.test(h)) autoMapping.credit ||= original;
    }

    // Si on a trouvé débit ET crédit mais pas de montant unique → mode split
    if (autoMapping.debit && autoMapping.credit && !autoMapping.amount) {
      autoMapping.amountMode = "split";
    }

    setMapping(autoMapping);
    setStep("mapping");
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) void handleFile(f);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  }

  // ── Étape 2 : Mapping → Preview ────────────────────────────────────────

  function handleMapping() {
    if (!file) return;
    if (!mapping.date || !mapping.label) {
      toast.error("Les colonnes Date et Libellé sont obligatoires");
      return;
    }
    if (mapping.amountMode === "single" && !mapping.amount) {
      toast.error("La colonne Montant est obligatoire");
      return;
    }
    if (mapping.amountMode === "split" && (!mapping.debit && !mapping.credit)) {
      toast.error("Au moins une colonne Débit ou Crédit est requise");
      return;
    }

    const rows: ImportRow[] = [];
    for (const row of file.rows) {
      const dateVal = row[mapping.date] ?? "";
      const labelVal = row[mapping.label] ?? "";
      const refVal = row[mapping.reference] ?? "";

      let amount: number;
      if (mapping.amountMode === "single") {
        amount = parseAmount(row[mapping.amount] ?? "");
      } else {
        const debitVal = parseAmount(row[mapping.debit] ?? "");
        const creditVal = parseAmount(row[mapping.credit] ?? "");
        // Débit = sortie (négatif), Crédit = entrée (positif)
        if (debitVal !== 0) {
          amount = -Math.abs(debitVal);
        } else {
          amount = Math.abs(creditVal);
        }
      }

      if (!dateVal || !labelVal || amount === 0) continue;

      rows.push({
        transactionDate: dateVal,
        amount,
        label: labelVal,
        reference: refVal || undefined,
      });
    }

    if (rows.length === 0) {
      toast.error("Aucune ligne valide trouvée avec ce mapping");
      return;
    }

    setParsedRows(rows);
    setStep("preview");
  }

  // ── Étape 3 : Import ──────────────────────────────────────────────────

  async function handleImport() {
    setImporting(true);
    const res = await importBankStatement(societyId, bankAccountId, parsedRows);
    if (res.success && res.data) {
      setResult(res.data);
      setStep("result");
      if (res.data.imported > 0) {
        toast.success(`${res.data.imported} transaction${res.data.imported > 1 ? "s" : ""} importée${res.data.imported > 1 ? "s" : ""}`);
      }
    } else {
      toast.error(res.error ?? "Erreur lors de l'import");
    }
    setImporting(false);
  }

  function handleReset() {
    setStep("upload");
    setFile(null);
    setIsPdf(false);
    setMapping({ date: "", amount: "", label: "", reference: "", debit: "", credit: "", amountMode: "single" });
    setParsedRows([]);
    setResult(null);
    router.refresh();
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (step === "analyzing") {
    return (
      <div className="border-2 border-dashed border-[var(--color-brand-blue)]/40 rounded-xl p-6 text-center bg-[var(--color-brand-blue)]/5">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand-blue)]" />
          <Sparkles className="h-5 w-5 text-[var(--color-brand-blue)]" />
        </div>
        <p className="text-sm font-medium text-[var(--color-brand-deep)]">
          Analyse IA en cours…
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Claude lit votre relevé PDF et extrait les transactions
        </p>
      </div>
    );
  }

  if (step === "upload") {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center hover:border-[var(--color-brand-blue)]/40 transition-colors cursor-pointer"
        onClick={() => document.getElementById("csv-upload")?.click()}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-[var(--color-brand-deep)]">
          Importer un relevé bancaire
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          CSV, XLSX — glisser-déposer ou cliquer
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
          <Sparkles className="h-3 w-3 text-[var(--color-brand-blue)]" />
          PDF analysé automatiquement par IA
        </p>
        <input
          id="csv-upload"
          type="file"
          accept=".csv,.xlsx,.xls,.pdf"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    );
  }

  if (step === "mapping" && file) {
    const headerOptions = file.headers.map((h) => ({ value: h, label: h }));

    return (
      <Card className="border-0 shadow-brand bg-white rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)] flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-[var(--color-brand-blue)]" />
                Mapping des colonnes
              </CardTitle>
              <CardDescription className="mt-1">
                {file.filename} — {file.rows.length} lignes détectées
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleReset}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode montant */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Mode montant</Label>
            <div className="flex gap-2">
              <Button
                variant={mapping.amountMode === "single" ? "default" : "outline"}
                size="sm"
                className="rounded-lg text-xs"
                onClick={() => setMapping((m) => ({ ...m, amountMode: "single" }))}
              >
                Colonne unique (+ / -)
              </Button>
              <Button
                variant={mapping.amountMode === "split" ? "default" : "outline"}
                size="sm"
                className="rounded-lg text-xs"
                onClick={() => setMapping((m) => ({ ...m, amountMode: "split" }))}
              >
                Débit / Crédit séparés
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date *</Label>
              <NativeSelect
                value={mapping.date}
                onChange={(e) => setMapping((m) => ({ ...m, date: e.target.value }))}
                options={headerOptions}
                placeholder="— Colonne —"
              />
            </div>
            <div>
              <Label className="text-xs">Libellé *</Label>
              <NativeSelect
                value={mapping.label}
                onChange={(e) => setMapping((m) => ({ ...m, label: e.target.value }))}
                options={headerOptions}
                placeholder="— Colonne —"
              />
            </div>
            {mapping.amountMode === "single" ? (
              <div>
                <Label className="text-xs">Montant *</Label>
                <NativeSelect
                  value={mapping.amount}
                  onChange={(e) => setMapping((m) => ({ ...m, amount: e.target.value }))}
                  options={headerOptions}
                  placeholder="— Colonne —"
                />
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-xs">Débit (sorties)</Label>
                  <NativeSelect
                    value={mapping.debit}
                    onChange={(e) => setMapping((m) => ({ ...m, debit: e.target.value }))}
                    options={headerOptions}
                    placeholder="— Colonne —"
                  />
                </div>
                <div>
                  <Label className="text-xs">Crédit (entrées)</Label>
                  <NativeSelect
                    value={mapping.credit}
                    onChange={(e) => setMapping((m) => ({ ...m, credit: e.target.value }))}
                    options={headerOptions}
                    placeholder="— Colonne —"
                  />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Référence</Label>
              <NativeSelect
                value={mapping.reference}
                onChange={(e) => setMapping((m) => ({ ...m, reference: e.target.value }))}
                options={headerOptions}
                placeholder="— Optionnel —"
              />
            </div>
          </div>

          {/* Aperçu premières lignes */}
          <div className="bg-gray-50/80 rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Aperçu (3 premières lignes)</p>
            <div className="space-y-1.5 text-xs">
              {file.rows.slice(0, 3).map((row, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <span className="text-muted-foreground w-6">{i + 1}.</span>
                  {mapping.date && <span className="font-mono">{row[mapping.date]}</span>}
                  {mapping.amountMode === "single" && mapping.amount && (
                    <span className="font-mono font-semibold">{row[mapping.amount]}</span>
                  )}
                  {mapping.amountMode === "split" && (
                    <span className="font-mono font-semibold">
                      {row[mapping.debit] ? `-${row[mapping.debit]}` : `+${row[mapping.credit]}`}
                    </span>
                  )}
                  {mapping.label && (
                    <span className="truncate flex-1">{row[mapping.label]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleMapping} className="w-full rounded-lg gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white">
            Vérifier et continuer
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "preview") {
    const totalCredit = parsedRows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const totalDebit = parsedRows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0);

    return (
      <Card className="border-0 shadow-brand bg-white rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)] flex items-center gap-2">
                {isPdf && <Sparkles className="h-4 w-4 text-[var(--color-brand-blue)]" />}
                Vérification avant import
              </CardTitle>
              <CardDescription className="mt-1">
                {file?.filename && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3 shrink-0" />
                    {file.filename} —{" "}
                  </span>
                )}
                {parsedRows.length} transaction{parsedRows.length > 1 ? "s" : ""} valide{parsedRows.length > 1 ? "s" : ""} — les doublons seront automatiquement ignorés
                {isPdf && (
                  <span className="ml-1 text-[var(--color-brand-blue)]">· extrait par IA</span>
                )}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleReset}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Résumé */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50/80 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Lignes</p>
              <p className="text-lg font-bold text-[var(--color-brand-deep)]">{parsedRows.length}</p>
            </div>
            <div className="bg-[var(--color-status-positive-bg)]/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Entrées</p>
              <p className="text-lg font-bold text-[var(--color-status-positive)]">
                +{totalCredit.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
              </p>
            </div>
            <div className="bg-[var(--color-status-negative-bg)]/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Sorties</p>
              <p className="text-lg font-bold text-[var(--color-status-negative)]">
                {totalDebit.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
              </p>
            </div>
          </div>

          {/* Liste */}
          <div className="max-h-64 overflow-y-auto divide-y divide-border/30 rounded-lg border border-border/40">
            {parsedRows.slice(0, 50).map((row, i) => {
              const isCredit = row.amount >= 0;
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                    isCredit ? "bg-[var(--color-status-positive-bg)]" : "bg-[var(--color-status-negative-bg)]"
                  }`}>
                    {isCredit
                      ? <ArrowDownLeft className="h-2.5 w-2.5 text-[var(--color-status-positive)]" />
                      : <ArrowUpRight className="h-2.5 w-2.5 text-[var(--color-status-negative)]" />
                    }
                  </div>
                  <span className="text-muted-foreground w-20 shrink-0 font-mono">{row.transactionDate}</span>
                  <span className="flex-1 truncate">{row.label}</span>
                  <span className={`font-mono font-semibold shrink-0 ${
                    isCredit ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"
                  }`}>
                    {isCredit ? "+" : ""}{row.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                  </span>
                </div>
              );
            })}
            {parsedRows.length > 50 && (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                … et {parsedRows.length - 50} autres lignes
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => isPdf ? handleReset() : setStep("mapping")} className="flex-1 rounded-lg">
              Retour
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing}
              className="flex-1 rounded-lg gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white"
            >
              {importing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Import en cours…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Importer {parsedRows.length} transaction{parsedRows.length > 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "result" && result) {
    return (
      <Card className="border-0 shadow-brand bg-white rounded-xl">
        <CardContent className="py-8 text-center space-y-4">
          <CheckCircle2 className="h-10 w-10 mx-auto text-[var(--color-status-positive)]" />
          <div>
            <p className="text-lg font-semibold text-[var(--color-brand-deep)]">Import terminé</p>
            <div className="flex justify-center gap-6 mt-3 text-sm">
              <div>
                <p className="text-2xl font-bold text-[var(--color-status-positive)]">{result.imported}</p>
                <p className="text-xs text-muted-foreground">importée{result.imported > 1 ? "s" : ""}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-status-caution)]">{result.duplicates}</p>
                <p className="text-xs text-muted-foreground">doublon{result.duplicates > 1 ? "s" : ""} ignoré{result.duplicates > 1 ? "s" : ""}</p>
              </div>
              {result.skipped > 0 && (
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground">ligne{result.skipped > 1 ? "s" : ""} invalide{result.skipped > 1 ? "s" : ""}</p>
                </div>
              )}
            </div>
            {result.duplicates > 0 && (
              <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Les doublons ont été détectés par date + montant + libellé (tolérance ±1 jour)
              </p>
            )}
          </div>
          <Button onClick={handleReset} variant="outline" className="rounded-lg">
            Nouvel import
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse un montant français : "1 234,56" → 1234.56, "-1.234,56" → -1234.56 */
function parseAmount(raw: string): number {
  if (!raw?.trim()) return 0;
  let s = raw.trim();
  // Enlever les espaces (séparateur milliers FR)
  s = s.replace(/\s/g, "");
  // Détecter le format FR (virgule décimale, point séparateur milliers)
  // vs format EN (point décimal, virgule séparateur milliers)
  if (s.includes(",") && s.includes(".")) {
    // "1.234,56" → FR ou "1,234.56" → EN
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // FR : "1.234,56" → enlever les points, virgule → point
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // EN : "1,234.56" → enlever les virgules
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    // Virgule seule → décimale FR
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
