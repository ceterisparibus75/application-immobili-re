"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, ExternalLink, Lock, Loader2, Download } from "lucide-react";

const PURPOSE_LABELS: Record<string, string> = {
  VENTE: "Vente",
  AUDIT: "Audit",
  FINANCEMENT: "Financement",
  DUE_DILIGENCE: "Due diligence",
  AUTRE: "Autre",
};

type Meta = {
  name: string;
  description: string | null;
  purpose: string | null;
  expiresAt: Date | null;
  hasPassword: boolean;
  accessMode: string;
  allowDownload: boolean;
  watermarkEnabled: boolean;
  ndaRequired: boolean;
  qnaEnabled: boolean;
  branding: unknown;
  society: { name: string; logoUrl: string | null };
};

type ApiDocument = {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  category: string | null;
  description: string | null;
  signedUrl: string | null;
  sortOrder: number;
  allowDownload: boolean;
  watermarkEnabled: boolean;
};

type Branding = {
  logoUrl?: string;
  accentColor?: string;
  welcomeTitle?: string;
  welcomeMessage?: string;
};

function readBranding(value: unknown): Branding {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Branding : {};
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

export function DataroomShareClient({ token, meta }: { token: string; meta: Meta }) {
  const [phase, setPhase] = useState<"form" | "loading" | "documents" | "error">("form");
  const [password, setPassword] = useState("");
  const [viewerName, setViewerName] = useState("");
  const [viewerEmail, setViewerEmail] = useState("");
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [allowDownload, setAllowDownload] = useState(meta.allowDownload);
  const [watermarkEnabled, setWatermarkEnabled] = useState(meta.watermarkEnabled);
  const branding = readBranding(meta.branding);
  const logoUrl = branding.logoUrl || meta.society.logoUrl;

  async function handleAccess() {
    setPhase("loading");
    setErrorMsg("");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (meta.hasPassword && password) headers["x-dataroom-password"] = password;
    if (viewerName.trim()) headers["x-viewer-name"] = viewerName.trim();
    if (viewerEmail.trim()) headers["x-viewer-email"] = viewerEmail.trim();

    try {
      const res = await fetch(`/api/dataroom/${token}`, { headers });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Accès refusé");
        setPhase("form");
        return;
      }

      setDocuments(data.documents ?? []);
      setAllowDownload(data.allowDownload ?? meta.allowDownload);
      setWatermarkEnabled(data.watermarkEnabled ?? meta.watermarkEnabled);
      setPhase("documents");
    } catch {
      setErrorMsg("Erreur réseau. Veuillez réessayer.");
      setPhase("form");
    }
  }

  const purposeLabel = meta.purpose ? (PURPOSE_LABELS[meta.purpose] ?? meta.purpose) : null;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="text-center mb-8">
          {logoUrl && (
            <Image
              src={logoUrl}
              alt=""
              width={160}
              height={48}
              unoptimized
              className="h-12 w-auto mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold tracking-tight">{branding.welcomeTitle || meta.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{meta.society.name}</p>
          {(branding.welcomeMessage || meta.description) && (
            <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">{branding.welcomeMessage || meta.description}</p>
          )}
          <div className="flex items-center justify-center gap-3 mt-3">
            {purposeLabel && <Badge variant="secondary" className="text-xs">{purposeLabel}</Badge>}
            {meta.hasPassword && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />Espace protégé
              </span>
            )}
          </div>
        </div>

        {/* Formulaire d'accès */}
        {phase === "form" && (
          <Card className="mb-6">
            <CardContent className="pt-6 space-y-4">
              {meta.hasPassword && (
                <div>
                  <Label htmlFor="dr-password">Mot de passe *</Label>
                  <Input
                    id="dr-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Saisir le mot de passe"
                    onKeyDown={(e) => e.key === "Enter" && handleAccess()}
                    autoFocus
                  />
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Identifiez-vous {meta.accessMode === "EMAIL_REQUIRED" ? <span>*</span> : <span className="font-normal">(optionnel)</span>}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="dr-vname" className="text-xs">Votre nom</Label>
                    <Input
                      id="dr-vname"
                      value={viewerName}
                      onChange={(e) => setViewerName(e.target.value)}
                      placeholder="Jean Dupont"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dr-vemail" className="text-xs">Votre email</Label>
                    <Input
                      id="dr-vemail"
                      type="email"
                      value={viewerEmail}
                      onChange={(e) => setViewerEmail(e.target.value)}
                      placeholder="jean@exemple.com"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
              {meta.ndaRequired && (
                <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                  <Checkbox checked={ndaAccepted} onCheckedChange={(checked) => setNdaAccepted(checked === true)} />
                  <span>
                    Je confirme accéder à cette dataroom à titre confidentiel et m'engage à ne pas diffuser les documents sans autorisation.
                  </span>
                </label>
              )}
              {errorMsg && (
                <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{errorMsg}</p>
              )}
              <Button
                onClick={handleAccess}
                className="w-full"
                style={branding.accentColor ? { backgroundColor: branding.accentColor } : undefined}
                disabled={(meta.hasPassword && !password) || (meta.accessMode === "EMAIL_REQUIRED" && !viewerEmail.trim()) || (meta.ndaRequired && !ndaAccepted)}
              >
                Accéder aux documents
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Chargement */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Chargement des documents...</p>
          </div>
        )}

        {/* Documents */}
        {phase === "documents" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {documents.length} document{documents.length !== 1 ? "s" : ""}
              </p>
              {(watermarkEnabled || documents.some((doc) => doc.watermarkEnabled)) && (
                <Badge variant="outline" className="text-xs">Filigrane activé</Badge>
              )}
            </div>
            {documents.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Aucun document dans cette dataroom</p>
                </CardContent>
              </Card>
            ) : (
              documents.map((doc, i) => (
                <Card key={doc.id}>
                  <CardContent className="flex items-center gap-3 py-3">
                    <span className="text-sm font-medium text-muted-foreground w-6 text-right shrink-0">{i + 1}</span>
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.category ?? "Document"}
                        {doc.fileSize ? " · " + formatFileSize(doc.fileSize) : ""}
                      </p>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{doc.description}</p>
                      )}
                    </div>
                    {doc.signedUrl ? (
                      <div className="flex gap-1 shrink-0">
                        <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-1 h-8">
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Voir</span>
                          </Button>
                        </a>
                        {allowDownload && doc.allowDownload && (
                          <a href={doc.signedUrl} download={doc.fileName}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Télécharger">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">Indisponible</span>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        <div className="text-center mt-8 text-xs text-muted-foreground">
          <p>Cet espace de partage est sécurisé et accessible uniquement via ce lien.</p>
        </div>
      </div>
    </div>
  );
}
