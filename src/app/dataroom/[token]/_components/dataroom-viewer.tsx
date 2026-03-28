"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, FileImage, File, Download, Eye, FolderLock,
  Clock, Building2, ExternalLink, X, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";

type DocItem = {
  id: string; fileName: string; fileSize: number | null; mimeType: string | null;
  category: string | null; description: string | null; storagePath: string | null;
  signedUrl: string | null; order: number;
};
type Dataroom = {
  id: string; name: string; description: string | null;
  expiresAt: Date | null; documents: DocItem[];
};

function FileIcon({ mimeType, className }: { mimeType: string | null; className?: string }) {
  if (mimeType === "application/pdf") return <FileText className={cn("text-red-500", className)} />;
  if (mimeType?.startsWith("image/")) return <FileImage className={cn("text-blue-500", className)} />;
  return <File className={cn("text-muted-foreground", className)} />;
}
function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
function getCategoryLabel(cat: string | null) {
  return DOCUMENT_CATEGORIES.find((c) => c.value === cat)?.label ?? "Autre";
}

function PreviewModal({ doc, onClose }: { doc: DocItem; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const url = doc.signedUrl;
  const isPdf = doc.mimeType === "application/pdf";
  const isImage = doc.mimeType?.startsWith("image/");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <FileIcon mimeType={doc.mimeType} className="h-5 w-5 shrink-0" />
            <span className="font-medium text-sm truncate">{doc.fileName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {url && (
              <a href={url} download={doc.fileName}>
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                  <Download className="h-3.5 w-3.5" />Télécharger
                </Button>
              </a>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 relative bg-muted/20">
          {!url ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-muted-foreground">Aperçu non disponible</p>
            </div>
          ) : isPdf ? (
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              <iframe src={url} title={doc.fileName} className="w-full h-full min-h-[60vh] border-0"
                onLoad={() => setLoading(false)} />
            </>
          ) : isImage ? (
            <div className="flex items-center justify-center p-4 min-h-[40vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={doc.fileName} className="max-w-full max-h-[70vh] object-contain rounded"
                onLoad={() => setLoading(false)} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <FileIcon mimeType={doc.mimeType} className="h-12 w-12" />
              <p className="text-sm text-muted-foreground">Aperçu non disponible pour ce type de fichier</p>
              <a href={url} download={doc.fileName}>
                <Button size="sm" className="gap-1.5"><Download className="h-4 w-4" />Télécharger</Button>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const NOW = Date.now();

export function DataroomViewer({ dataroom }: { dataroom: Dataroom }) {
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "GestImmo";

  const isExpiringSoon = dataroom.expiresAt &&
    new Date(dataroom.expiresAt).getTime() - NOW < 7 * 24 * 3600 * 1000;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-foreground">{appName}</span>
          <Badge variant="secondary" className="ml-auto gap-1 text-xs">
            <FolderLock className="h-3 w-3" />Dataroom sécurisée
          </Badge>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{dataroom.name}</h1>
          {dataroom.description && <p className="text-muted-foreground">{dataroom.description}</p>}
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            <span>{dataroom.documents.length} document{dataroom.documents.length !== 1 ? "s" : ""}</span>
            {dataroom.expiresAt && (
              <span className={cn("flex items-center gap-1", isExpiringSoon && "text-orange-600 font-medium")}>
                <Clock className="h-3.5 w-3.5" />
                Accès valide jusqu&apos;au {new Date(dataroom.expiresAt).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>
        </div>

        {/* Documents */}
        {dataroom.documents.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <FolderLock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun document dans cette dataroom</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
            {dataroom.documents.map((doc, i) => (
              <div key={doc.id}
                className={cn("flex items-center gap-4 px-5 py-4 border-b last:border-0 hover:bg-muted/30 transition-colors group", i % 2 === 0 ? "" : "bg-muted/10")}
              >
                <FileIcon mimeType={doc.mimeType} className="h-8 w-8 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{getCategoryLabel(doc.category)}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground">{formatSize(doc.fileSize)}</span>
                  </div>
                  {doc.description && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{doc.description}</p>}
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {(doc.mimeType === "application/pdf" || doc.mimeType?.startsWith("image/")) && (
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                      onClick={() => setPreviewDoc(doc)}>
                      <Eye className="h-3.5 w-3.5" />Aperçu
                    </Button>
                  )}
                  {doc.signedUrl && (
                    <a href={doc.signedUrl} download={doc.fileName}>
                      <Button size="sm" className="gap-1.5 h-8 text-xs">
                        <Download className="h-3.5 w-3.5" />Télécharger
                      </Button>
                    </a>
                  )}
                  {!doc.signedUrl && (
                    <Badge variant="secondary" className="text-xs">Indisponible</Badge>
                  )}
                </div>
                {/* Mobile actions always visible */}
                <div className="flex items-center gap-1.5 sm:hidden shrink-0">
                  {doc.signedUrl && (
                    <a href={doc.signedUrl} download={doc.fileName}>
                      <Button size="icon" variant="ghost" className="h-8 w-8"><Download className="h-4 w-4" /></Button>
                    </a>
                  )}
                  {(doc.mimeType === "application/pdf" || doc.mimeType?.startsWith("image/")) && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setPreviewDoc(doc)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground/60">
          Accès sécurisé fourni par {appName} · Les documents sont confidentiels
        </p>
      </main>

      {/* Preview modal */}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}
