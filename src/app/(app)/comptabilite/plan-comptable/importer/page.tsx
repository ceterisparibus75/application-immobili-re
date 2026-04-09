"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/providers/society-provider";
import { bulkImportAccounts } from "@/actions/accounting";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet, FileText, Loader2, CheckCircle2, AlertTriangle, ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type ParsedAccount = { code: string; label: string; type: string };

const CLASS_LABELS: Record<string, string> = {
  "1": "Capitaux", "2": "Immobilisations", "3": "Stocks",
  "4": "Tiers", "5": "Financiers", "6": "Charges", "7": "Produits",
};

const CLASS_COLORS: Record<string, string> = {
  "1": "bg-purple-100 text-purple-800", "2": "bg-blue-100 text-blue-800",
  "3": "bg-cyan-100 text-cyan-800", "4": "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]",
  "5": "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]", "6": "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]",
  "7": "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]",
};

export default function ImporterPlanComptablePage() {
  const { activeSociety } = useSociety();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parseSource, setParseSource] = useState<"excel" | "pdf-ai" | null>(null);
  const [accounts, setAccounts] = useState<ParsedAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  async function handleFile(file: File) {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls") && !ext.endsWith(".ods") && !ext.endsWith(".pdf")) {
      toast.error("Format non supporté. Utilisez Excel (.xlsx, .xls) ou PDF.");
      return;
    }

    setIsUploading(true);
    setAccounts([]);
    setSelected(new Set());
    setImportResult(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/comptabilite/import-plan", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de l'analyse du fichier");
        return;
      }

      setAccounts(data.accounts);
      setParseSource(data.source);
      // Select all by default
      setSelected(new Set(data.accounts.map((a: ParsedAccount) => a.code)));
      toast.success(`${data.total} compte(s) détecté(s)`);
    } catch {
      toast.error("Impossible de contacter le serveur");
    } finally {
      setIsUploading(false);
    }
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(accounts.map(a => a.code)) : new Set());
  }

  function toggleOne(code: string, checked: boolean) {
    setSelected(s => {
      const next = new Set(s);
      checked ? next.add(code) : next.delete(code);
      return next;
    });
  }

  function handleImport() {
    if (!activeSociety?.id) return;
    const toImport = accounts.filter(a => selected.has(a.code));
    if (!toImport.length) { toast.error("Sélectionnez au moins un compte"); return; }

    startTransition(async () => {
      const res = await bulkImportAccounts(activeSociety.id, toImport);
      if (res.success && res.data) {
        setImportResult(res.data);
        toast.success(`Import terminé : ${res.data.imported} compte(s) ajouté(s), ${res.data.skipped} ignoré(s)`);
      } else {
        toast.error(res.error ?? "Erreur lors de l'import");
      }
    });
  }

  const byClass = accounts.reduce<Record<string, ParsedAccount[]>>((acc, a) => {
    if (!acc[a.type]) acc[a.type] = [];
    acc[a.type].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/comptabilite/plan-comptable"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Importer un plan comptable</h1>
          <p className="text-sm text-muted-foreground">Depuis un fichier Excel ou PDF — les comptes existants sont conservés</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4 flex gap-3">
            <FileSpreadsheet className="h-8 w-8 text-blue-600 flex-shrink-0" />
            <div>
              <div className="font-medium text-sm">Fichier Excel (.xlsx, .xls, .ods)</div>
              <div className="text-xs text-muted-foreground mt-1">
                Colonnes recommandées : <strong>N° compte</strong>, <strong>Libellé</strong>, <strong>Classe</strong> (optionnel).
                La première ligne doit être l&apos;en-tête.
              </div>
              <Button variant="link" size="sm" className="h-6 p-0 text-xs text-blue-600" asChild>
                <a href="/exemples/plan-comptable-exemple.xlsx" download>
                  <Download className="h-3 w-3 mr-1" />Télécharger le modèle Excel
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--color-status-caution)]/30 bg-[var(--color-status-caution-bg)]/50">
          <CardContent className="pt-4 flex gap-3">
            <FileText className="h-8 w-8 text-[var(--color-status-caution)] flex-shrink-0" />
            <div>
              <div className="font-medium text-sm">Fichier PDF — Analyse IA</div>
              <div className="text-xs text-muted-foreground mt-1">
                Claude AI extrait automatiquement les comptes depuis n&apos;importe quel plan comptable PDF.
                Fonctionne avec les plans comptables officiels, extraits de logiciels comptables, etc.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Zone de dépôt */}
      {!importResult && (
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
        >
          <CardContent className="py-12 flex flex-col items-center gap-3">
            {isUploading
              ? <><Loader2 className="h-10 w-10 text-primary animate-spin" /><p className="text-sm font-medium">Analyse en cours…</p><p className="text-xs text-muted-foreground">L&apos;analyse IA peut prendre quelques secondes pour les PDF</p></>
              : <><Upload className="h-10 w-10 text-muted-foreground" /><p className="text-sm font-medium">Déposez votre fichier ici</p><p className="text-xs text-muted-foreground">ou cliquez pour parcourir — Excel (.xlsx, .xls, .ods) ou PDF</p></>
            }
          </CardContent>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.ods,.pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </Card>
      )}

      {/* Résultat d'import */}
      {importResult && (
        <Card className="border-[var(--color-status-positive)] bg-[var(--color-status-positive-bg)]/50">
          <CardContent className="py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-[var(--color-status-positive)]" />
              <div>
                <div className="font-semibold">{importResult.imported} compte(s) importé(s) avec succès</div>
                {importResult.skipped > 0 && (
                  <div className="text-sm text-muted-foreground">{importResult.skipped} compte(s) ignoré(s) — déjà présents dans le plan comptable</div>
                )}
              </div>
            </div>
            <Button asChild>
              <Link href="/comptabilite/plan-comptable">Voir le plan comptable</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Aperçu des comptes */}
      {accounts.length > 0 && !importResult && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <div>
              <CardTitle className="text-base">{accounts.length} compte(s) détecté(s)</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {parseSource === "pdf-ai" && <span className="flex items-center gap-1"><span className="text-[var(--color-status-caution)] font-medium">Extrait par IA</span> — vérifiez les numéros et libellés</span>}
                {parseSource === "excel" && "Extrait depuis votre fichier Excel"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selected.size} sélectionné(s)</span>
              <Button onClick={handleImport} disabled={isPending || selected.size === 0} size="sm">
                {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Import…</> : `Importer ${selected.size} compte(s)`}
              </Button>
            </div>
          </CardHeader>

          {parseSource === "pdf-ai" && (
            <div className="mx-4 mb-3 flex items-start gap-2 p-3 bg-[var(--color-status-caution-bg)] border border-[var(--color-status-caution)]/30 rounded-lg text-xs text-[var(--color-status-caution)]">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Vérifiez les comptes extraits par l&apos;IA avant d&apos;importer. Décochez les lignes incorrectes.</span>
            </div>
          )}

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === accounts.length}
                        onCheckedChange={v => toggleAll(!!v)}
                      />
                    </TableHead>
                    <TableHead className="w-28">N° Compte</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="w-36">Classe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(byClass).sort((a, b) => a[0].localeCompare(b[0])).flatMap(([cl, clAccounts]) => [
                    <TableRow key={`class-${cl}`} className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={4} className="py-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${CLASS_COLORS[cl] ?? "bg-gray-100 text-gray-800"}`}>
                          Classe {cl} — {CLASS_LABELS[cl] ?? "Autres"}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">{clAccounts.length} compte(s)</span>
                      </TableCell>
                    </TableRow>,
                    ...clAccounts.map(a => (
                      <TableRow key={a.code} className={selected.has(a.code) ? "" : "opacity-50"}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(a.code)}
                            onCheckedChange={v => toggleOne(a.code, !!v)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold">{a.code}</TableCell>
                        <TableCell className="text-sm">{a.label}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${CLASS_COLORS[a.type] ?? ""}`}>
                            {a.type} — {CLASS_LABELS[a.type] ?? "?"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )),
                  ])}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 border-t flex justify-between items-center">
              <Button variant="outline" onClick={() => { setAccounts([]); setSelected(new Set()); inputRef.current && (inputRef.current.value = ""); }}>
                Changer de fichier
              </Button>
              <Button onClick={handleImport} disabled={isPending || selected.size === 0}>
                {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Import en cours…</> : `Importer ${selected.size} compte(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
