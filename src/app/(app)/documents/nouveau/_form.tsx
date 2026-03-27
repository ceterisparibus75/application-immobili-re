"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, FileUp, CheckCircle2, X, Upload } from "lucide-react";
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

export function UploadDocumentForm({ societyId, buildings, lots, leases, tenants }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState<"" | "signing" | "uploading" | "saving">("");
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
  const filteredLots = buildingId ? lots.filter((l) => l.buildingId === buildingId) : lots;
  const stepLabel: Record<string, string> = {
    signing: "Preparation...", uploading: "Envoi du fichier...", saving: "Enregistrement...",
  };

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) { setError("Veuillez selectionner un fichier"); return; }
    setError(""); setIsLoading(true); setUploadProgress(0);
    try {
      setUploadStep("signing");
      const folder = entityType === "building" && buildingId ? "buildings/" + buildingId
        : entityType === "lot" && lotId ? "lots/" + lotId
        : entityType === "lease" && leaseId ? "leases/" + leaseId
        : entityType === "tenant" && tenantId ? "tenants/" + tenantId : "general";

      const sigRes = await fetch("/api/storage/signed-upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, societyId, entityFolder: folder }),
      });
      const sigJson = await sigRes.json() as { signedUrl?: string; storagePath?: string; error?: string };
      if (!sigRes.ok || !sigJson.signedUrl || !sigJson.storagePath)
        throw new Error(sigJson.error ?? "Impossible d’obtenir l’URL d’upload");

      setUploadStep("uploading"); setUploadProgress(10);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(10 + Math.round((ev.loaded / ev.total) * 80));
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("Erreur upload: " + String(xhr.status))));
        xhr.onerror = () => reject(new Error("Erreur reseau pendant l’upload"));
        xhr.open("PUT", sigJson.signedUrl!);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });
      setUploadProgress(90);

      setUploadStep("saving");
      const regRes = await fetch("/api/documents/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name, fileSize: file.size, mimeType: file.type, storagePath: sigJson.storagePath,
          category: category || "autre",
          description: description || undefined,
          expiresAt: expiresAt || undefined,
          buildingId: entityType === "building" ? buildingId || undefined : undefined,
          lotId: entityType === "lot" ? lotId || undefined : undefined,
          leaseId: entityType === "lease" ? leaseId || undefined : undefined,
          tenantId: entityType === "tenant" ? tenantId || undefined : undefined,
        }),
      });
      const regJson = await regRes.json() as { success?: boolean; error?: string };
      if (!regJson.success) throw new Error(regJson.error ?? "Erreur d’enregistrement");
      setUploadProgress(100);
      router.push("/documents");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l’upload");
    } finally {
      setIsLoading(false); setUploadStep(""); setUploadProgress(0);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/documents"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ajouter un document</h1>
          <p className="text-muted-foreground">Importer un fichier dans la GED</p>
        </div>
      </div>
      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Fichier *</CardTitle></CardHeader>
          <CardContent>
            {!file ? (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-6 py-8 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
              >
                <FileUp className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Deposez un fichier ici</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, image, Word — max 50 Mo</p>
                <Button variant="outline" size="sm" className="mt-3" type="button">Choisir un fichier</Button>
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
              </div>
            ) : (
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
        {isLoading && uploadStep === "uploading" && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Envoi en cours…</span><span>{uploadProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: String(uploadProgress) + "%" }} />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Link href="/documents"><Button variant="outline" type="button">Annuler</Button></Link>
          <Button type="submit" disabled={isLoading || !file}>
            {isLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" />{stepLabel[uploadStep] ?? "En cours..."}</>
              : <><Upload className="h-4 w-4" />Enregistrer le document</>
            }
          </Button>
        </div>
      </form>
    </div>
  );
}
