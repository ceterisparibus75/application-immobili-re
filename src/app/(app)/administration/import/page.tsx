"use client";

import { useState, useCallback, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { useSociety } from "@/providers/society-provider";
import {
  parseImportFileAction,
  importEntities,
  type BulkImportResult,
  type ParsedFileResult,
} from "@/actions/import";
import type { ImportEntityType } from "@/validations/import";

export default function ImportPage() {
  const { activeSociety } = useSociety();
  const [entityType, setEntityType] = useState<ImportEntityType>("tenants");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedFileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [isParsing, startParsing] = useTransition();
  const [isImporting, startImporting] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const expectedColumns: Record<ImportEntityType, string[]> = {
    tenants: ["nom", "prenom", "email", "telephone"],
    buildings: ["name", "address", "postalCode", "city", "type"],
    lots: ["reference", "type", "surface", "etage", "buildingId"],
  };

  const entityLabels: Record<ImportEntityType, string> = {
    tenants: "Locataires",
    buildings: "Immeubles",
    lots: "Lots",
  };

  const resetState = useCallback(() => {
    setFileName(null);
    setParsedData(null);
    setError(null);
    setResult(null);
  }, []);

  const handleFile = useCallback(
    (selectedFile: File) => {
      resetState();
      setFileName(selectedFile.name);

      const formData = new FormData();
      formData.append("file", selectedFile);

      startParsing(async () => {
        const res = await parseImportFileAction(formData);
        if (res.success && res.data) {
          setParsedData(res.data);
        } else {
          setError(res.error ?? "Erreur lors de la lecture du fichier");
        }
      });
    },
    [resetState]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleImport = () => {
    if (!activeSociety?.id || !parsedData) return;

    startImporting(async () => {
      const res = await importEntities(
        activeSociety.id,
        entityType,
        parsedData.rows
      );
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error ?? "Erreur inconnue");
      }
    });
  };

  const previewRows = parsedData?.rows.slice(0, 5) ?? [];
  const previewHeaders = parsedData?.headers ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import en masse</h1>
        <p className="text-muted-foreground mt-1">
          Importez des locataires, immeubles ou lots depuis un fichier CSV ou Excel.
        </p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Choisissez le type d&apos;entite et deposez votre fichier.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entity-type">Type d&apos;entite</Label>
              <NativeSelect
                id="entity-type"
                value={entityType}
                onChange={(e) => {
                  setEntityType(e.target.value as ImportEntityType);
                  resetState();
                }}
                options={[
                  { value: "tenants", label: "Locataires" },
                  { value: "lots", label: "Lots" },
                  { value: "buildings", label: "Immeubles" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Colonnes attendues</Label>
              <div className="flex flex-wrap gap-1 pt-1">
                {expectedColumns[entityType].map((col) => (
                  <Badge key={col} variant="secondary">
                    {col}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {isParsing ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : fileName ? (
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
                <span className="font-medium">{fileName}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetState();
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="ml-2 rounded-full p-1 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Glissez-deposez un fichier CSV ou Excel, ou cliquez pour
                  parcourir
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {parsedData && !result && (
        <Card>
          <CardHeader>
            <CardTitle>
              Apercu ({parsedData.rows.length} ligne
              {parsedData.rows.length > 1 ? "s" : ""})
            </CardTitle>
            <CardDescription>
              Les 5 premieres lignes du fichier sont affichees ci-dessous.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {previewHeaders.map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      {previewHeaders.map((h) => (
                        <TableCell key={h}>{row[h] ?? ""}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importer {parsedData.rows.length}{" "}
                  {entityLabels[entityType].toLowerCase()}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Import termine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="rounded-md bg-green-50 px-4 py-2 dark:bg-green-950/30">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {result.imported}
                </p>
                <p className="text-sm text-green-600 dark:text-green-500">
                  importe{result.imported > 1 ? "s" : ""}
                </p>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-md bg-red-50 px-4 py-2 dark:bg-red-950/30">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {result.errors.length}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-500">
                    erreur{result.errors.length > 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Detail des erreurs</h4>
                <div className="max-h-60 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Ligne</TableHead>
                        <TableHead>Erreur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((err, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Badge variant="destructive">{err.row}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {err.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <Button variant="outline" onClick={resetState}>
              Nouvel import
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
