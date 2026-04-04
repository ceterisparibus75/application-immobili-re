"use client";

import { useState, useTransition, useRef } from "react";
import { useSociety } from "@/providers/society-provider";
import { bulkImportJournalEntries } from "@/actions/accounting";
import type { ImportJournalEntryInput } from "@/actions/accounting";
import type { ParsedEntry } from "@/app/api/comptabilite/import-grand-livre/route";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const JOURNAL_LABELS: Record<string, string> = {
  AN: "A Nouveaux",
  AC: "Achats",
  BQUE: "Banque",
  BQ: "Banque",
  INV: "Investissements",
  OD: "Op. Diverses",
  VT: "Ventes",
};

export default function ImportGrandLivrePage() {
  const { activeSociety } = useSociety();
  const [isParsing, startParsing] = useTransition();
  const [isImporting, startImporting] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [source, setSource] = useState<string>("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function parseFile(file: File) {
    const ext = file.name.toLowerCase();
    const allowed = [".fec", ".txt", ".csv", ".xlsx", ".xls", ".ods"];
    if (!allowed.some((e) => ext.endsWith(e))) {
      toast.error(
        "Format non supporté. Utilisez FEC (.txt, .csv) ou Excel (.xlsx, .xls)."
      );
      return;
    }
    startParsing(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/comptabilite/import-grand-livre", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error?.message ?? "Erreur d'analyse");
        return;
      }
      setEntries(data.entries);
      setSource(data.source);
      setResult(null);
      const allIdx = new Set<number>(
        data.entries.map((_: ParsedEntry, i: number) => i)
      );
      setSelected(allIdx);
      setExpanded(new Set());
      toast.success(data.total + " écriture(s) détectée(s)");
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  }

  function toggleSelect(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === entries.length) setSelected(new Set());
    else setSelected(new Set(entries.map((_, i) => i)));
  }

  function toggleExpand(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function doImport() {
    if (!activeSociety?.id) return;
    const toImport: ImportJournalEntryInput[] = entries
      .filter((_, i) => selected.has(i))
      .map((e) => ({
        journalType: e.journalCode,
        entryDate: e.entryDate,
        piece: e.piece,
        label: e.label || e.piece,
        lines: e.lines.map((l) => ({
          accountCode: l.accountCode,
          label: l.accountLabel,
          debit: l.debit,
          credit: l.credit,
        })),
      }));
    if (!toImport.length) {
      toast.error("Aucune écriture sélectionnée");
      return;
    }
    startImporting(async () => {
      const res = await bulkImportJournalEntries(activeSociety.id, toImport);
      if (res.success && res.data) {
        setResult(res.data);
        toast.success(res.data.imported + " écriture(s) importée(s)");
      } else {
        toast.error(res.error ?? "Erreur d'import");
      }
    });
  }

  const balancedCount = entries.filter((e) => e.isBalanced).length;
  const unbalancedCount = entries.length - balancedCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/comptabilite/grand-livre">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Importer des écritures
          </h1>
          <p className="text-muted-foreground text-sm">
            Format FEC (.txt, .csv) ou Excel (.xlsx, .xls)
          </p>
        </div>
      </div>

      {entries.length === 0 && (
        <Card
          className={["border-2 border-dashed transition-colors cursor-pointer", isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"].join(" ")}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <input
              ref={fileRef}
              type="file"
              accept=".fec,.txt,.csv,.xlsx,.xls,.ods"
              className="hidden"
              onChange={handleFileChange}
            />
            {isParsing ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            ) : (
              <Upload className="h-12 w-12 text-muted-foreground" />
            )}
            <div className="text-center">
              <p className="font-medium">
                {isParsing ? "Analyse en cours..." : "Glissez votre fichier ici"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ou cliquez pour choisir un fichier
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="h-4 w-4" /> FEC standard (.txt, .csv)
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx, .xls)
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 max-w-md text-center">
              Le format FEC est le standard français exporté depuis Sage, EBP,
              Ciel, QuadraCompta...
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card
          className={result.imported > 0 ? "border-green-500" : "border-orange-500"}
        >
          <CardContent className="flex items-center gap-4 py-4">
            <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">
                {result.imported} écriture(s) importée(s), {result.skipped}{" "}
                ignorée(s)
              </p>
              {result.errors.length > 0 && (
                <ul className="text-xs text-destructive mt-1 space-y-0.5">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>- {e}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>... et {result.errors.length - 5} autre(s)</li>
                  )}
                </ul>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEntries([]);
                setResult(null);
              }}
            >
              Nouvel import
            </Button>
          </CardContent>
        </Card>
      )}

      {entries.length > 0 && !result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {entries.length} écriture(s) — {balancedCount} équilibrée(s)
                {source === "fec" && (
                  <Badge variant="secondary" className="ml-2">
                    Format FEC
                  </Badge>
                )}
                {source === "excel" && (
                  <Badge variant="secondary" className="ml-2">
                    Excel
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {unbalancedCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="flex items-center gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {unbalancedCount} déséquilibrée(s)
                  </Badge>
                )}
                <Badge variant="outline">{selected.size} sélectionnée(s)</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === entries.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Journal</TableHead>
                  <TableHead>Pièce</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Lignes</TableHead>
                  <TableHead className="text-right">Débit</TableHead>
                  <TableHead className="text-right">Crédit</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, idx) => (
                  <>
                    <TableRow
                      key={idx}
                      className={!entry.isBalanced ? "bg-destructive/5" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(idx)}
                          onCheckedChange={() => toggleSelect(idx)}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleExpand(idx)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {expanded.has(idx) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.entryDate
                          ? formatDate(new Date(entry.entryDate))
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {JOURNAL_LABELS[entry.journalCode] ?? entry.journalCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {entry.piece}
                      </TableCell>
                      <TableCell
                        className="text-sm max-w-48 truncate"
                        title={entry.label}
                      >
                        {entry.label}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.lines.length} ligne(s)
                      </TableCell>
                      <TableCell className="text-right text-sm text-green-700">
                        {formatCurrency(entry.totalDebit)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-700">
                        {formatCurrency(entry.totalCredit)}
                      </TableCell>
                      <TableCell>
                        {!entry.isBalanced && (
                          <AlertTriangle
                            className="h-4 w-4 text-destructive"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                    {expanded.has(idx) &&
                      entry.lines.map((line, li) => (
                        <TableRow
                          key={idx + "-" + li}
                          className="bg-muted/30"
                        >
                          <TableCell colSpan={2} />
                          <TableCell />
                          <TableCell />
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {line.accountCode}
                          </TableCell>
                          <TableCell
                            className="text-xs text-muted-foreground"
                            colSpan={2}
                          >
                            {line.accountLabel}
                          </TableCell>
                          <TableCell className="text-right text-xs text-green-700">
                            {line.debit > 0 ? formatCurrency(line.debit) : ""}
                          </TableCell>
                          <TableCell className="text-right text-xs text-red-700">
                            {line.credit > 0 ? formatCurrency(line.credit) : ""}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {entries.length > 0 && !result && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => {
              setEntries([]);
              setSelected(new Set());
            }}
          >
            Changer de fichier
          </Button>
          <Button onClick={doImport} disabled={isImporting || selected.size === 0}>
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Import en cours...
              </>
            ) : (
              "Importer " + selected.size + " écriture(s)"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
