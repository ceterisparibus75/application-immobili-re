"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle, FileText, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function InsuranceUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setError("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/portal/upload-insurance", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'upload");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      setError("Seuls les fichiers PDF sont acceptés");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("Fichier trop volumineux (max 10 Mo)");
      return;
    }
    setFile(selected);
    setError("");
    setSuccess(false);
  }

  if (success) {
    return (
      <div className="flex items-center gap-3 rounded-md bg-green-100 dark:bg-green-900/30 p-4 text-green-800 dark:text-green-200">
        <CheckCircle className="h-5 w-5" />
        <p className="text-sm font-medium">Attestation déposée avec succès</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Cliquez pour sélectionner un fichier</p>
            <p className="text-xs text-muted-foreground mt-1">PDF uniquement, 10 Mo max</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} Mo
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { setFile(null); setError(""); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {file && (
        <Button onClick={handleUpload} disabled={isUploading} className="w-full">
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Envoyer l'attestation
            </>
          )}
        </Button>
      )}
    </div>
  );
}
