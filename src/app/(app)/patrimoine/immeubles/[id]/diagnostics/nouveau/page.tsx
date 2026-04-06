"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createDiagnostic } from "@/actions/diagnostic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DIAGNOSTIC_TYPES } from "@/lib/constants";
import { ArrowLeft, Bot, CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { AiConfirmDialog } from "@/components/ai-confirm-dialog";

export default function NouveauDiagnosticPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { activeSociety } = useSociety();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [fileStoragePath, setFileStoragePath] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDiag, setPendingDiag] = useState<Parameters<typeof createDiagnostic>[1] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    // Reset analysis if file changes
    setAiAnalysis("");
    setFileUrl("");
    setFileStoragePath("");
  }

  async function handleAnalyze() {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setError("");

    const fd = new FormData();
    fd.append("file", selectedFile);

    const res = await fetch("/api/diagnostics/analyze", { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'analyse");
    } else {
      setFileUrl(data.fileUrl ?? "");
      setFileStoragePath(data.fileStoragePath ?? "");
      setAiAnalysis(data.aiAnalysis ?? "");
    }
    setIsAnalyzing(false);
  }

  const doSaveDiag = useCallback(async (input: Parameters<typeof createDiagnostic>[1]) => {
    if (!activeSociety) return;
    setIsLoading(true);
    const result = await createDiagnostic(activeSociety.id, input);
    setIsLoading(false);
    if (result.success) {
      router.push(`/patrimoine/immeubles/${params.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }, [activeSociety, params.id, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) { setError("Aucune société sélectionnée"); return; }
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const input = {
      buildingId: params.id,
      type: data.type,
      performedAt: data.performedAt,
      expiresAt: data.expiresAt || null,
      result: data.result,
      fileUrl: fileUrl || null,
      aiAnalysis: aiAnalysis || null,
      fileStoragePath: fileStoragePath || null,
    } as Parameters<typeof createDiagnostic>[1];

    // Si l'IA a analysé le document, demander confirmation avant sauvegarde
    if (aiAnalysis) {
      setPendingDiag(input);
      setConfirmOpen(true);
      return;
    }

    await doSaveDiag(input);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <AiConfirmDialog
        open={confirmOpen}
        description="L'analyse IA sera enregistrée avec ce diagnostic"
        lines={[
          { label: "Type", value: pendingDiag?.type },
          { label: "Date réalisation", value: pendingDiag?.performedAt },
          { label: "Expiration", value: pendingDiag?.expiresAt ?? undefined },
          { label: "Résultat", value: pendingDiag?.result ?? undefined },
          { label: "Analyse IA", value: aiAnalysis ? `${aiAnalysis.slice(0, 80)}…` : undefined },
        ]}
        onConfirm={async () => {
          setConfirmOpen(false);
          if (pendingDiag) await doSaveDiag(pendingDiag);
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <div className="flex items-center gap-4">
        <Link href={`/patrimoine/immeubles/${params.id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveau diagnostic</h1>
          <p className="text-muted-foreground">Enregistrer un diagnostic technique</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Diagnostic technique</CardTitle>
            <CardDescription>DPE, amiante, plomb, électricité, gaz...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type de diagnostic *</Label>
              <NativeSelect id="type" name="type" options={[...DIAGNOSTIC_TYPES]} required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="performedAt">Date de réalisation *</Label>
                <Input id="performedAt" name="performedAt" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Date d'expiration</Label>
                <Input id="expiresAt" name="expiresAt" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="result">Résultat / Classement</Label>
              <Input id="result" name="result" placeholder="Ex: Classe D, Conforme, Non-conforme..." />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea name="notes" rows={2} placeholder="Observations complémentaires..." />
            </div>
          </CardContent>
        </Card>

        {/* PDF + Analyse IA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Document PDF + Analyse IA
            </CardTitle>
            <CardDescription>
              Importez le PDF du diagnostic pour une analyse automatique par intelligence artificielle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Zone de dépôt */}
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setAiAnalysis(""); setFileUrl(""); }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Cliquez pour sélectionner un PDF (max 10 Mo)
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Bouton analyse */}
            {selectedFile && !aiAnalysis && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4" />
                    Analyser avec Claude IA
                  </>
                )}
              </Button>
            )}

            {/* Résultat de l'analyse */}
            {aiAnalysis && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-status-positive)]">
                  <CheckCircle2 className="h-4 w-4" />
                  Analyse IA complétée — document uploadé
                </div>
                <div className="text-sm whitespace-pre-wrap text-muted-foreground max-h-64 overflow-y-auto">
                  {aiAnalysis}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={handleAnalyze}
                >
                  Relancer l'analyse
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/patrimoine/immeubles/${params.id}`}>
            <Button variant="outline" type="button">Annuler</Button>
          </Link>
          <Button type="submit" disabled={isLoading || isAnalyzing}>
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</> : "Enregistrer le diagnostic"}
          </Button>
        </div>
      </form>
    </div>
  );
}
