"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, X, Loader2, AlertCircle } from "lucide-react";
import { uploadSupplierInvoice } from "@/actions/supplier-invoice";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  societyId: string;
}

export function UploadForm({ societyId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, startUpload] = useTransition();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    setError(null);
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Le fichier ne doit pas dépasser 20 Mo.");
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  async function handleUpload() {
    if (!selectedFile) return;
    setError(null);

    startUpload(async () => {
      try {
        // 1. Uploader le fichier via le serveur (évite CORS)
        setUploadProgress(20);
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await fetch("/api/supplier-invoices/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({}));
          throw new Error(typeof body?.error === "string" ? body.error : "Échec de l'upload");
        }

        const { storagePath, fileUrl } = await uploadRes.json();
        setUploadProgress(70);

        // 3. Créer la facture en base
        const result = await uploadSupplierInvoice(societyId, {
          fileName: selectedFile.name,
          storagePath,
          fileUrl,
          fileSize: selectedFile.size,
        });

        if (!result.success) {
          throw new Error(result.error ?? "Erreur lors de la création de la facture");
        }

        setUploadProgress(100);
        toast.success("Facture uploadée avec succès — analyse IA en cours…");

        // 4. Rediriger vers le détail
        router.push(`/banque/factures-fournisseurs/${result.data!.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur lors de l'upload";
        setError(msg);
        toast.error(msg);
        setUploadProgress(0);
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
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-all cursor-pointer",
          isDragging
            ? "border-[var(--color-brand-blue)] bg-blue-50/50"
            : selectedFile
              ? "border-[var(--color-status-positive)] bg-[var(--color-status-positive-bg)]/50 cursor-default"
              : "border-border hover:border-[var(--color-brand-blue)] hover:bg-muted/30"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleInputChange}
          className="hidden"
        />

        {selectedFile ? (
          <div className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-status-positive-bg)]">
              <FileText className="h-6 w-6 text-[var(--color-status-positive)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-[var(--color-brand-deep)] truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} Mo · PDF
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                setError(null);
                setUploadProgress(0);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              <X className="h-4 w-4" />
            </Button>
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
              {isDragging ? "Déposez votre fichier ici" : "Glissez-déposez votre facture PDF"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              ou cliquez pour sélectionner un fichier
            </p>
            <p className="text-xs text-muted-foreground">
              PDF uniquement · 20 Mo maximum
            </p>
          </div>
        )}
      </div>

      {/* Barre de progression */}
      {uploading && uploadProgress > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Upload en cours…</span>
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
        disabled={!selectedFile || uploading}
        className="w-full gap-2"
        size="lg"
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Upload className="h-5 w-5" />
        )}
        {uploading ? "Upload en cours…" : "Uploader la facture"}
      </Button>
    </div>
  );
}
