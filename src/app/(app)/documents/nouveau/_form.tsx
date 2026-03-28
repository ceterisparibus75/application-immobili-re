"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, FileUp, FolderOpen, CheckCircle2, X, Upload, File as FileIcon } from "lucide-react";
import Link from "next/link";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";
import { cn } from "@/lib/utils";

type Props = {
  societyId: string;
  buildings: { id: string; name: string; city: string }[];
  lots: { id: string; label: string; buildingId: string }[];
  leases: { id: string; label: string }[];
  tenants: { id: string; label: string }[];
};

const ALLOWED_TYPES = [
  "application/pdf", "image/jpeg", "image/png", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function UploadDocumentForm({ societyId, buildings, lots, leases, tenants }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState<"building" | "lot" | "lease" | "tenant" | "">("");
  const [buildingId, setBuildingId] = useState("");
  const [lotId, setLotId] = useState("");
  const [leaseId, setLeaseId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [mode, setMode] = useState<"file" | "folder">("file");
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState("");
  const [currentFileIdx, setCurrentFileIdx] = useState(0);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filteredLots = buildingId ? lots.filter((l) => l.buildingId === buildingId) : lots;
  const totalFiles = mode === "folder" ? folderFiles.length : (file ? 1 : 0);

  function handleFolderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => ALLOWED_TYPES.includes(f.type));
    if (files.length > 0) {
      setFolderFiles(files);
      const first = files[0] as File & { webkitRelativePath: string };
      setFolderName(first.webkitRelativePath?.split("/")[0] ?? "Dossier");
    }
  }
  async function uploadOne(f: File, baseFolder: string) {
    const relPath = (f as File & { webkitRelativePath: string }).webkitRelativePath;
    let entityFolder = baseFolder;
    if (relPath) {
      const parts = relPath.split("/");
      const subs = parts.slice(1, -1).map((p) => p.replace(/[^a-zA-Z0-9._-]/g, "_"));
      if (subs.length > 0) entityFolder = baseFolder + "/" + subs.join("/");
    }
    const signRes = await fetch("/api/storage/signed-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: f.name, contentType: f.type, societyId, entityFolder }),
    });
    if (!signRes.ok) {
      const err = await signRes.json() as { error?: string };
      throw new Error("[préparation] " + (err.error ?? "Erreur serveur"));
    }
    const { signedUrl, token, storagePath, anonKey } = await signRes.json() as {
      signedUrl: string; token: string; storagePath: string; bucket: string; anonKey: string;
    };
    const uploadHeaders: Record<string, string> = {
      "Content-Type": f.type,
      "Authorization": `Bearer ${token}`,
    };
    if (anonKey) uploadHeaders["apikey"] = anonKey;
    let putRes: Response;
    try {
      putRes = await fetch(signedUrl, { method: "PUT", headers: uploadHeaders, body: f });
    } catch (netErr) {
      throw new Error("[upload] Impossible de joindre le serveur de stockage. Vérifiez votre connexion. (" + String(netErr) + ")");
    }
    if (!putRes.ok) {
      const msg = await putRes.text().catch(() => String(putRes.status));
      throw new Error("[upload] Erreur " + putRes.status + " : " + msg.substring(0, 200));
    }
    const regRes = await fetch("/api/documents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storagePath, fileName: f.name, fileSize: f.size, mimeType: f.type,
        category: category || "autre", description: description || null,
        expiresAt: expiresAt || null,
        buildingId: entityType === "building" ? (buildingId || null) : null,
        lotId: entityType === "lot" ? (lotId || null) : null,
        leaseId: entityType === "lease" ? (leaseId || null) : null,
        tenantId: entityType === "tenant" ? (tenantId || null) : null,
      }),
    });
    if (!regRes.ok) {
      const err = await regRes.json() as { error?: string };
      throw new Error("[enregistrement] " + (err.error ?? "Erreur serveur"));
    }
    const regData = await regRes.json() as { document?: { id: string }; success?: boolean };
    const docId = regData.document?.id;
    if (docId) {
      void fetch("/api/documents/" + docId + "/analyze", { method: "POST" }).catch(() => null);
    }
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const filesToUpload = mode === "folder" ? folderFiles : (file ? [file] : []);
    if (filesToUpload.length === 0) { setError("Veuillez sélectionner un fichier ou un dossier"); return; }
    setError(""); setIsLoading(true); setUploadProgress(0); setCurrentFileIdx(0);
    const baseFolder = entityType === "building" && buildingId ? "buildings/" + buildingId
      : entityType === "lot" && lotId ? "lots/" + lotId
      : entityType === "lease" && leaseId ? "leases/" + leaseId
      : entityType === "tenant" && tenantId ? "tenants/" + tenantId : "general";
    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        setCurrentFileIdx(i + 1);
        setUploadProgress(Math.round((i / filesToUpload.length) * 100));
        await uploadOne(filesToUpload[i], baseFolder);
      }
      setUploadProgress(100);
      router.push("/documents");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setIsLoading(false); setUploadProgress(0);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/documents"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ajouter des documents</h1>
          <p className="text-muted-foreground">Importer un fichier ou un dossier entier dans la GED</p>
        </div>
      </div>
      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex gap-2">
          <Button type="button" variant={mode === "file" ? "default" : "outline"} size="sm"
            onClick={() => { setMode("file"); setFolderFiles([]); setFolderName(""); }}>
            <FileUp className="h-4 w-4 mr-1" />Fichier unique
          </Button>
          <Button type="button" variant={mode === "folder" ? "default" : "outline"} size="sm"
            onClick={() => { setMode("folder"); setFile(null); }}>
            <FolderOpen className="h-4 w-4 mr-1" />Dossier entier
          </Button>
        </div>
        <Card>
          <CardHeader><CardTitle>{mode === "folder" ? "Dossier *" : "Fichier *"}</CardTitle></CardHeader>
          <CardContent>
            {mode === "file" && !file && (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-6 py-8 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
              >
                <FileUp className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Déposez un fichier ici</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, image, Word — max 50 Mo</p>
                <Button variant="outline" size="sm" className="mt-3" type="button">Choisir un fichier</Button>
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
              </div>
            )}
            {mode === "file" && file && (
              <div className={cn("flex items-center gap-3 rounded-lg bg-green-500/10 px-4 py-3")}>
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} Ko</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" type="button"
                  onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            {mode === "folder" && folderFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-6 py-8 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-colors"
                onClick={() => folderInputRef.current?.click()}
              >
                <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Cliquez pour sélectionner un dossier</p>
                <p className="text-xs text-muted-foreground mt-1">Tous les PDF, images et Word seront importés</p>
                <Button variant="outline" size="sm" className="mt-3" type="button">Choisir un dossier</Button>
                <input
                  ref={(el) => { if (el) { (folderInputRef as React.MutableRefObject<HTMLInputElement>).current = el; el.setAttribute("webkitdirectory", ""); } }}
                  type="file" className="hidden" multiple onChange={handleFolderChange} />
              </div>
            )}
            {mode === "folder" && folderFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">{folderName}</span>
                    <span className="text-xs text-muted-foreground">({folderFiles.length} fichier{folderFiles.length > 1 ? "s" : ""})</span>
                  </div>
                  <Button variant="ghost" size="sm" type="button"
                    onClick={() => { setFolderFiles([]); setFolderName(""); if (folderInputRef.current) folderInputRef.current.value = ""; }}>
                    <X className="h-3 w-3 mr-1" />Changer
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-2 space-y-1">
                  {folderFiles.slice(0, 50).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                      <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate text-muted-foreground">
                        {(f as File & { webkitRelativePath: string }).webkitRelativePath || f.name}
                      </span>
                      <span className="ml-auto text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} Ko</span>
                    </div>
                  ))}
                  {folderFiles.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center py-1">{'...et '}{folderFiles.length - 50}{' autres'}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Classement</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Catégorie *</Label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Choisir une catégorie...</option>
                {DOCUMENT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entityType">Rattacher à</Label>
              <select id="entityType" value={entityType}
                onChange={(e) => { setEntityType(e.target.value as typeof entityType); setBuildingId(""); setLotId(""); setLeaseId(""); setTenantId(""); }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value="">— Aucun rattachement —</option>
                <option value="building">Un immeuble</option>
                <option value="lot">Un lot</option>
                <option value="lease">Un bail</option>
                <option value="tenant">Un locataire</option>
              </select>
            </div>
            {entityType === "building" && (
              <div className="space-y-2">
                <Label htmlFor="buildingId">Immeuble *</Label>
                <select id="buildingId" value={buildingId} onChange={(e) => setBuildingId(e.target.value)} required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="">Sélectionner un immeuble...</option>
                  {buildings.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.city}</option>)}
                </select>
              </div>
            )}
            {entityType === "lot" && (
              <>
                <div className="space-y-2">
                  <Label>Immeuble (filtre)</Label>
                  <select value={buildingId} onChange={(e) => { setBuildingId(e.target.value); setLotId(""); }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                    <option value="">Tous les immeubles</option>
                    {buildings.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.city}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lotId">Lot *</Label>
                  <select id="lotId" value={lotId} onChange={(e) => setLotId(e.target.value)} required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                    <option value="">Sélectionner un lot...</option>
                    {filteredLots.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
              </>
            )}
            {entityType === "lease" && (
              <div className="space-y-2">
                <Label htmlFor="leaseId">Bail *</Label>
                <select id="leaseId" value={leaseId} onChange={(e) => setLeaseId(e.target.value)} required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="">Sélectionner un bail...</option>
                  {leases.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
            )}
            {entityType === "tenant" && (
              <div className="space-y-2">
                <Label htmlFor="tenantId">Locataire *</Label>
                <select id="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="">Sélectionner un locataire...</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Informations complémentaires</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Acte notarié signé le 12/03/2024" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">{"Date d’expiration"}</Label>
              <Input id="expiresAt" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              <p className="text-xs text-muted-foreground">Pour les diagnostics, assurances, contrats à renouveler…</p>
            </div>
          </CardContent>
        </Card>
        {isLoading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{mode === "folder" ? `Fichier ${currentFileIdx}/${totalFiles}…` : "Envoi en cours…"}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: String(uploadProgress) + "%" }} />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Link href="/documents"><Button variant="outline" type="button">Annuler</Button></Link>
          <Button type="submit" disabled={isLoading || totalFiles === 0}>
            {isLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" />{mode === "folder" ? `${currentFileIdx}/${totalFiles}…` : "En cours…"}</>
              : <><Upload className="h-4 w-4" />{mode === "folder" && totalFiles > 0 ? `Importer ${totalFiles} fichier${totalFiles > 1 ? "s" : ""}` : "Enregistrer le document"}</>
            }
          </Button>
        </div>
      </form>
    </div>
  );
}
