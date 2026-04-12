"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, CheckCircle2, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UploadResult {
  fileName: string;
  category?: string;
  summary?: string;
  tags?: string[];
}

interface DocumentUploadProps {
  endpoint: string;
  accept?: string;
  maxSizeMB?: number;
  enableAI?: boolean;
  onSuccess?: (result: UploadResult) => void;
  label?: string;
  description?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bail: "Bail",
  avenant: "Avenant",
  quittance: "Quittance",
  facture: "Facture",
  diagnostic: "Diagnostic",
  assurance: "Assurance",
  titre_propriete: "Titre de propriété",
  contrat: "Contrat",
  etat_des_lieux: "État des lieux",
  autre: "Autre",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DocumentUpload({
  endpoint,
  accept = ".pdf,.jpg,.jpeg,.png",
  maxSizeMB = 10,
  enableAI = false,
  onSuccess,
  label = "Déposer un document",
  description = "PDF, JPG ou PNG — max 10 Mo",
}: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setError(null);
    setResult(null);

    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`Le fichier dépasse la taille maximale de ${maxSizeMB} Mo`);
      return;
    }

    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const allowed = accept.split(",").map((a) => a.trim().replace(".", ""));
    if (!allowed.includes(ext)) {
      setError(`Format non accepté. Formats autorisés : ${allowed.join(", ")}`);
      return;
    }

    setFile(f);
  }, [accept, maxSizeMB]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (enableAI) formData.append("analyze", "true");

      const res = await fetch(endpoint, { method: "POST", body: formData });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? `Erreur ${res.status}`);
      }

      const json = await res.json();

      if (enableAI && json.analysis) {
        setAnalyzing(true);
        // Brief delay to show analysis state
        await new Promise((r) => setTimeout(r, 800));
        setAnalyzing(false);
      }

      const uploadResult: UploadResult = {
        fileName: file.name,
        category: json.analysis?.category,
        summary: json.analysis?.summary,
        tags: json.analysis?.tags,
      };

      setResult(uploadResult);
      onSuccess?.(uploadResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Success state
  if (result) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 animate-fade-in">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">Document envoyé avec succès</p>
            <p className="text-xs text-emerald-700 mt-0.5">{result.fileName}</p>

            {result.category && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs font-medium text-violet-700">Analyse IA</span>
                </div>
                <div className="bg-white rounded-lg p-3 border border-emerald-200/60 space-y-1.5">
                  <p className="text-xs">
                    <span className="text-muted-foreground">Catégorie :</span>{" "}
                    <span className="font-medium">{CATEGORY_LABELS[result.category] ?? result.category}</span>
                  </p>
                  {result.summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{result.summary}</p>
                  )}
                  {result.tags && result.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {result.tags.map((tag) => (
                        <span key={tag} className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={reset}>
              Envoyer un autre document
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className={cn(
          "relative rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer",
          dragOver
            ? "border-[var(--color-brand-cyan)] bg-[var(--color-brand-light)]/50"
            : file
            ? "border-[var(--color-brand-blue)]/40 bg-blue-50/30"
            : "border-border hover:border-[var(--color-brand-cyan)]/50 hover:bg-accent/30"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="h-8 w-8 text-[var(--color-brand-blue)]" />
            <div className="text-left">
              <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} Mo
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="ml-2 p-1 rounded-full hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
            {enableAI && (
              <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] text-violet-600 font-medium">
                <Sparkles className="h-3 w-3" />
                Analyse automatique par IA
              </div>
            )}
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-xs">{error}</p>
        </div>
      )}

      {/* Upload button */}
      {file && !error && (
        <Button
          onClick={handleUpload}
          disabled={uploading || analyzing}
          className="w-full bg-brand-gradient-soft hover:opacity-90 text-white"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Envoi en cours…
            </>
          ) : analyzing ? (
            <>
              <Sparkles className="h-4 w-4 animate-pulse mr-2" />
              Analyse IA en cours…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Envoyer le document
            </>
          )}
        </Button>
      )}
    </div>
  );
}
