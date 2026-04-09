"use client";

import { useState } from "react";
import { useSociety } from "@/providers/society-provider";
import { uploadAndAnalyzeReport, confirmManagementReport } from "@/actions/management-report";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface AnalysisResult {
  id: string;
  report: {
    id: string;
    periodStart: string;
    periodEnd: string;
    grossRent: number;
    chargesAmount: number | null;
    feeAmountHT: number;
    feeAmountTTC: number;
    netTransfer: number;
    aiConfidence: number | null;
    aiRawResponse: {
      alerts?: string[];
      [key: string]: unknown;
    } | null;
  };
}

export function CRGUploadForm({ leaseId }: { leaseId: string }) {
  const { activeSociety } = useSociety();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const societyId = activeSociety?.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !societyId) return;

    setIsUploading(true);
    setError(null);
    setAnalysis(null);

    try {
      // 1. Get signed upload URL
      const signedRes = await fetch("/api/storage/signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          societyId,
          entityFolder: `crg/${leaseId}`,
        }),
      });

      if (!signedRes.ok) {
        const err = await signedRes.json();
        throw new Error(err.error || "Erreur lors de la creation de l'URL d'upload");
      }

      const { signedUrl, token, storagePath, bucket, anonKey } = await signedRes.json();

      // 2. Upload file to Supabase Storage via signed URL
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
          Authorization: `Bearer ${anonKey}`,
          "x-upsert": "true",
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Erreur lors de l'upload du fichier");
      }

      // Build file URL for AI analysis
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const fileUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}?token=${token}`;

      // 3. Call server action for AI analysis
      const result = await uploadAndAnalyzeReport(societyId, leaseId, fileUrl, storagePath);

      if (!result.success) {
        throw new Error(result.error || "Erreur lors de l'analyse");
      }

      setAnalysis(result.data as AnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleConfirm() {
    if (!analysis || !societyId) return;

    setIsConfirming(true);
    setError(null);

    try {
      const result = await confirmManagementReport(societyId, analysis.id);

      if (!result.success) {
        throw new Error(result.error || "Erreur lors de la confirmation");
      }

      setAnalysis(null);
      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsConfirming(false);
    }
  }

  const formatPeriod = (start: string, end: string) => {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    return `${fmt(start)} - ${fmt(end)}`;
  };

  const confidenceLabel = (score: number) => {
    if (score >= 0.8) return { text: "Elevee", variant: "success" as const };
    if (score >= 0.5) return { text: "Moyenne", variant: "warning" as const };
    return { text: "Faible", variant: "destructive" as const };
  };

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" />
            Importer un compte rendu de gestion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                disabled={isUploading}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Formats acceptes : PDF, JPG, PNG
              </p>
            </div>
            <Button type="submit" disabled={!file || isUploading || !societyId}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importer et analyser
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* AI Analysis Result */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Resultat de l&apos;analyse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Period */}
            <div>
              <p className="text-sm text-muted-foreground">Periode</p>
              <p className="text-sm font-medium">
                {formatPeriod(analysis.report.periodStart, analysis.report.periodEnd)}
              </p>
            </div>

            {/* Financial details */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Loyer brut</p>
                <p className="text-sm font-medium">{formatCurrency(analysis.report.grossRent)}</p>
              </div>
              {analysis.report.chargesAmount != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Charges</p>
                  <p className="text-sm font-medium">
                    {formatCurrency(analysis.report.chargesAmount)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Honoraires TTC</p>
                <p className="text-sm font-medium">
                  {formatCurrency(analysis.report.feeAmountTTC)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Virement net</p>
                <p className="text-lg font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(analysis.report.netTransfer)}
                </p>
              </div>
            </div>

            {/* Confidence score */}
            {analysis.report.aiConfidence != null && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Confiance IA</p>
                  <Badge variant={confidenceLabel(analysis.report.aiConfidence).variant}>
                    {confidenceLabel(analysis.report.aiConfidence).text} (
                    {Math.round(analysis.report.aiConfidence * 100)}%)
                  </Badge>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round(analysis.report.aiConfidence * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Alerts */}
            {analysis.report.aiRawResponse?.alerts &&
              (analysis.report.aiRawResponse.alerts as string[]).length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 p-3">
                  <p className="text-xs font-medium text-red-800 dark:text-red-300 mb-1">
                    Alertes detectees
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {(analysis.report.aiRawResponse.alerts as string[]).map(
                      (alert: string, i: number) => (
                        <li key={i} className="text-xs text-red-700 dark:text-red-400">
                          {alert}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

            {/* Confirm button */}
            <Button onClick={handleConfirm} disabled={isConfirming} className="w-full sm:w-auto">
              {isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmation en cours...
                </>
              ) : (
                "Confirmer et creer les ecritures"
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
