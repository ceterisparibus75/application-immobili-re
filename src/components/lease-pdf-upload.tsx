"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Upload, ExternalLink } from "lucide-react";

interface LeasePdfUploadProps {
  leaseId: string;
  currentFileUrl: string | null;
}

function extractErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "Erreur serveur";
  const obj = body as Record<string, unknown>;
  if (typeof obj.error === "string") return obj.error;
  if (obj.error && typeof obj.error === "object") {
    const nested = obj.error as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message;
    return JSON.stringify(obj.error);
  }
  if (typeof obj.message === "string") return obj.message;
  return JSON.stringify(body);
}

export function LeasePdfUpload({ leaseId, currentFileUrl }: LeasePdfUploadProps) {
  const [fileUrl, setFileUrl] = useState(currentFileUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setError("");
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const initResponse = await fetch("/api/storage/tus-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          entityFolder: `leases/${leaseId}`,
        }),
      });

      if (!initResponse.ok) {
        const body = await initResponse.json().catch(() => ({}));
        throw new Error("Préparation : " + extractErrorMessage(body));
      }

      const { tusUrl, storagePath } = await initResponse.json() as {
        tusUrl: string;
        storagePath: string;
      };

      const chunkSize = 3_670_016;
      let offset = 0;
      while (offset < file.size) {
        const slice = file.slice(offset, Math.min(offset + chunkSize, file.size));
        const chunkResponse = await fetch("/api/storage/tus-patch", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "x-tus-url": tusUrl,
            "x-upload-offset": String(offset),
          },
          body: slice,
        });

        if (!chunkResponse.ok) {
          const body = await chunkResponse.json().catch(() => ({}));
          throw new Error("Upload : " + extractErrorMessage(body));
        }

        offset += slice.size;
        setUploadProgress(Math.round((offset / file.size) * 100));
      }

      const registerResponse = await fetch("/api/documents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          category: "bail",
          description: "PDF du bail signé",
          leaseId,
          syncLeasePdf: true,
        }),
      });

      if (!registerResponse.ok) {
        const body = await registerResponse.json().catch(() => ({}));
        throw new Error("Enregistrement : " + extractErrorMessage(body));
      }

      const result = await registerResponse.json() as {
        document?: { fileUrl?: string };
      };
      setFileUrl(result.document?.fileUrl ?? `/api/storage/view?path=${encodeURIComponent(storagePath)}`);
      setUploadProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload du fichier");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
              <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
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
