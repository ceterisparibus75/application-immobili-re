"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Upload, X, ExternalLink } from "lucide-react";

interface LeasePdfUploadProps {
  leaseId: string;
  currentFileUrl: string | null;
}

export function LeasePdfUpload({ leaseId, currentFileUrl }: LeasePdfUploadProps) {
  const [fileUrl, setFileUrl] = useState(currentFileUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setError("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("leaseId", leaseId);

      const response = await fetch("/api/leases/upload-pdf", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Erreur lors de l'upload");
        return;
      }

      setFileUrl(result.fileUrl);
    } catch {
      setError("Erreur lors de l'upload du fichier");
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Seuls les fichiers PDF sont acceptés");
      return;
    }
    handleUpload(file);
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {fileUrl ? (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Bail PDF déposé</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3.5 w-3.5" />
                Voir
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Remplacer
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Upload en cours...</p>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Déposer le PDF du bail</p>
              <p className="text-xs text-muted-foreground">PDF, max 20 Mo</p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
