"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, X, Loader2, AlertCircle } from "lucide-react";
import { uploadSupplierInvoice } from "@/actions/supplier-invoice";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseSupplierInvoiceAnalyzeResponse } from "@/lib/supplier-invoice-analysis";

interface Props {
  societyId: string;
}

export function UploadForm({ societyId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, startUpload] = useTransition();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback((files: FileList | File[]) => {
    setError(null);
    const nextFiles = Array.from(files);
    const invalidType = nextFiles.find((file) => !file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf"));
    if (invalidType) {
      setError(`Seuls les fichiers PDF sont acceptés : ${invalidType.name}`);
      return;
    }
    const oversized = nextFiles.find((file) => file.size > 20 * 1024 * 1024);
    if (oversized) {
      setError(`Le fichier ne doit pas dépasser 20 Mo : ${oversized.name}`);
      return;
    }
    setSelectedFiles((current) => [...current, ...nextFiles]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFileSelect(files);
  };

  async function handleUpload() {
    if (selectedFiles.length === 0) return;
    setError(null);

    startUpload(async () => {
      const successes: string[] = [];
      const analyzeFailures: string[] = [];
      const uploadFailures: string[] = [];

      try {
        for (const [index, file] of selectedFiles.entries()) {
          setCurrentFileName(file.name);
          setUploadProgress(Math.max(5, Math.round((index / selectedFiles.length) * 100)));

          try {
            // 1. Uploader le fichier via le serveur (évite CORS)
            const formData = new FormData();
            formData.append("file", file);

            const uploadRes = await fetch("/api/supplier-invoices/upload", {
              method: "POST",
              body: formData,
            });

            if (!uploadRes.ok) {
              const body = await uploadRes.json().catch(() => ({}));
              throw new Error(typeof body?.error === "string" ? body.error : "Échec de l'upload");
            }

            const { storagePath, fileUrl } = await uploadRes.json();

            // 2. Créer la facture en base
            const result = await uploadSupplierInvoice(societyId, {
              fileName: file.name,
              storagePath,
              fileUrl,
              fileSize: file.size,
            });

            if (!result.success) {
              throw new Error(result.error ?? "Erreur lors de la création de la facture");
            }

            const invoiceId = result.data!.id;
            successes.push(invoiceId);

            // 3. Analyse IA
            const analyzeRes = await fetch(`/api/supplier-invoices/${invoiceId}/analyze`, { method: "POST" });
            const analyzeResult = await parseSupplierInvoiceAnalyzeResponse(analyzeRes);

            if (!analyzeResult.success) {
              analyzeFailures.push(`${file.name} : ${analyzeResult.error}`);
            }
          } catch (fileError) {
            const msg = fileError instanceof Error ? fileError.message : "Erreur lors de l'upload";
            uploadFailures.push(`${file.name} : ${msg}`);
          }
        }

        setUploadProgress(100);
        setCurrentFileName("");

        if (successes.length === 0) {
          throw new Error(uploadFailures[0] ?? "Aucune facture n'a pu être intégrée");
        }

        if (uploadFailures.length === 0 && analyzeFailures.length === 0) {
          toast.success(
            `${successes.length} facture${successes.length > 1 ? "s" : ""} intégrée${successes.length > 1 ? "s" : ""} avec succès`
          );
        } else {
          toast.warning(
            `${successes.length} facture${successes.length > 1 ? "s" : ""} intégrée${successes.length > 1 ? "s" : ""}, avec alertes`,
            { description: [...uploadFailures, ...analyzeFailures].slice(0, 2).join(" · ") }
          );
        }

        if (successes.length === 1 && selectedFiles.length === 1) {
          router.push(`/banque/factures-fournisseurs/${successes[0]}`);
        } else {
          router.push("/banque/factures-fournisseurs");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur lors de l'upload";
        setError(msg);
        toast.error(msg);
        setUploadProgress(0);
        setCurrentFileName("");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Zone de dépôt */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-all cursor-pointer",
          isDragging
            ? "border-[var(--color-brand-blue)] bg-blue-50/50"
            : selectedFiles.length > 0
              ? "border-[var(--color-status-positive)] bg-[var(--color-status-positive-bg)]/50 cursor-default"
              : "border-border hover:border-[var(--color-brand-blue)] hover:bg-muted/30"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf,.pdf"
          onChange={handleInputChange}
          className="hidden"
        />

        {selectedFiles.length > 0 ? (
          <div className="space-y-3 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm text-[var(--color-brand-deep)]">
                  {selectedFiles.length} facture{selectedFiles.length > 1 ? "s" : ""} sélectionnée{selectedFiles.length > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cliquez dans la zone pour ajouter d&apos;autres PDF.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive shrink-0"
                disabled={uploading}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFiles([]);
                  setError(null);
                  setUploadProgress(0);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
                Tout retirer
              </Button>
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-[var(--color-status-positive)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-brand-deep)]">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} Mo · PDF</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={uploading}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFiles((current) => current.filter((_, i) => i !== index));
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-xl mb-4 transition-colors",
                isDragging ? "bg-blue-100" : "bg-muted/60"
              )}
            >
              <Upload className={cn("h-7 w-7", isDragging ? "text-[var(--color-brand-blue)]" : "text-muted-foreground")} />
            </div>
            <p className="text-sm font-medium text-[var(--color-brand-deep)] mb-1">
              {isDragging ? "Déposez vos fichiers ici" : "Glissez-déposez vos factures PDF"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              ou cliquez pour sélectionner un ou plusieurs fichiers
            </p>
            <p className="text-xs text-muted-foreground">
              PDF uniquement · 20 Mo maximum par fichier
            </p>
          </div>
        )}
      </div>

      {/* Barre de progression */}
      {uploading && uploadProgress > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{currentFileName ? `Traitement de ${currentFileName}` : "Traitement en cours…"}</span>
            <span>{uploadProgress} %</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-brand-blue)] transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-status-negative-bg)] border border-[var(--color-status-negative)]/20 px-3 py-2.5 text-sm text-[var(--color-status-negative)]">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Info IA */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-[var(--color-brand-deep)]">Traitement IA automatique :</strong>{" "}
            après l&apos;upload, l&apos;IA analysera le PDF pour extraire le nom du fournisseur,
            le montant, la date et le numéro de facture. Vous pourrez vérifier et corriger ces
            données sur la page suivante avant de valider.
          </p>
        </CardContent>
      </Card>

      {/* Bouton d'upload */}
      <Button
        onClick={handleUpload}
        disabled={selectedFiles.length === 0 || uploading}
        className="w-full gap-2"
        size="lg"
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Upload className="h-5 w-5" />
        )}
        {uploading
          ? uploadProgress >= 80
            ? "Analyse IA en cours…"
            : "Upload en cours…"
          : `Uploader ${selectedFiles.length > 1 ? `${selectedFiles.length} factures` : "la facture"}`}
      </Button>
    </div>
  );
}
