"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, FileText, Trash2, Plus, Search, Copy, Check, ExternalLink,
  Clock, Eye, EyeOff, Settings, FileImage, File, FolderLock, Loader2, X,
  CheckCircle2, XCircle, Users, Lock, Mail,
} from "lucide-react";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";
import { addDocumentToDataroom, removeDocumentFromDataroom, updateDataroom } from "@/actions/dataroom";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Doc = {
  id: string; fileName: string; fileUrl: string; fileSize: number | null;
  mimeType: string | null; category: string | null; description: string | null;
  storagePath: string | null; createdAt: Date;
};
type DataroomDoc = { id: string; documentId: string; order: number; document: Doc };
type AccessLog = { id: string; createdAt: Date; ipAddress: string | null; viewerEmail: string | null; viewerName: string | null };
type Dataroom = {
  id: string; name: string; description: string | null; token: string;
  isActive: boolean; expiresAt: Date | null; viewCount: number; createdAt: Date;
  passwordHash: string | null;
  recipientEmail: string | null; recipientName: string | null;
  documents: DataroomDoc[];
  accesses: AccessLog[];
  _count: { documents: number; accesses: number };
};

function FileTypeIcon({ mimeType, className }: { mimeType: string | null; className?: string }) {
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

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-2 text-xs h-8">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {label ?? (copied ? "Copié !" : "Copier le lien")}
    </Button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function DataroomManager({
  societyId, dataroom: initial, allDocuments,
}: {
  societyId: string;
  dataroom: Dataroom;
  allDocuments: Doc[];
}) {
  const [dataroom, setDataroom] = useState(initial);
  const [search, setSearch] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Settings form
  const [editName, setEditName] = useState(dataroom.name);
  const [editDesc, setEditDesc] = useState(dataroom.description ?? "");
  const [editExpires, setEditExpires] = useState(
    dataroom.expiresAt ? new Date(dataroom.expiresAt).toISOString().split("T")[0] : ""
  );
  const [editActive, setEditActive] = useState(dataroom.isActive);
  const [editPassword, setEditPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [editRecipientEmail, setEditRecipientEmail] = useState(dataroom.recipientEmail ?? "");
  const [editRecipientName, setEditRecipientName] = useState(dataroom.recipientName ?? "");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${origin}/dataroom/${dataroom.token}`;

  const availableDocs = useMemo(() => {
    const addedIds = new Set(dataroom.documents.map((d) => d.documentId));
    const q = search.trim().toLowerCase();
    return allDocuments.filter((d) =>
      !addedIds.has(d.id) &&
      (!q || d.fileName.toLowerCase().includes(q) || getCategoryLabel(d.category).toLowerCase().includes(q))
    );
  }, [allDocuments, dataroom.documents, search]);

  async function handleAdd(documentId: string) {
    setAddingId(documentId);
    const result = await addDocumentToDataroom(societyId, dataroom.id, documentId);
    setAddingId(null);
    if (result.success) {
      const doc = allDocuments.find((d) => d.id === documentId)!;
      setDataroom((prev) => ({
        ...prev,
        documents: [...prev.documents, { id: `tmp-${documentId}`, documentId, order: prev.documents.length, document: doc }],
        _count: { ...prev._count, documents: prev._count.documents + 1 },
      }));
      toast.success("Document ajouté");
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  async function handleRemove(documentId: string) {
    setRemovingId(documentId);
    const result = await removeDocumentFromDataroom(societyId, dataroom.id, documentId);
    setRemovingId(null);
    if (result.success) {
      setDataroom((prev) => ({
        ...prev,
        documents: prev.documents.filter((d) => d.documentId !== documentId),
        _count: { ...prev._count, documents: prev._count.documents - 1 },
      }));
      toast.success("Document retiré");
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    const result = await updateDataroom(societyId, dataroom.id, {
      name: editName,
      description: editDesc || null,
      expiresAt: editExpires || null,
      isActive: editActive,
      recipientEmail: editRecipientEmail || null,
      recipientName: editRecipientName || null,
      // empty string = remove password; non-empty = set new password; undefined = no change
      ...(editPassword !== undefined && { password: editPassword || null }),
    });
    setSavingSettings(false);
    if (result.success) {
      setDataroom((prev) => ({
        ...prev, name: editName, description: editDesc || null,
        expiresAt: editExpires ? new Date(editExpires) : null, isActive: editActive,
        recipientEmail: editRecipientEmail || null, recipientName: editRecipientName || null,
      }));
      setEditPassword("");
      toast.success("Paramètres mis à jour");
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  const isExpired = dataroom.expiresAt && new Date(dataroom.expiresAt) < new Date();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/datarooms">
          <Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{dataroom.name}</h1>
            {!dataroom.isActive
              ? <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" />Désactivée</Badge>
              : isExpired
              ? <Badge variant="destructive" className="gap-1"><Clock className="h-3 w-3" />Expirée</Badge>
              : <Badge className="gap-1 bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3" />Active</Badge>
            }
            {dataroom.passwordHash && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Protégée</Badge>}
          </div>
          {dataroom.description && <p className="text-muted-foreground text-sm mt-1">{dataroom.description}</p>}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{dataroom._count.documents} document{dataroom._count.documents !== 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{dataroom.viewCount} consultation{dataroom.viewCount !== 1 ? "s" : ""}</span>
            {dataroom.expiresAt && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Expire le {formatDate(dataroom.expiresAt)}</span>}
            {dataroom.recipientEmail && (
              <span className="flex items-center gap-1" title={`Notifications → ${dataroom.recipientEmail}`}>
                <Mail className="h-3.5 w-3.5" />{dataroom.recipientName ?? dataroom.recipientEmail}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lien de partage */}
      <div className="rounded-lg border bg-muted/30 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium mb-1 text-muted-foreground">Lien de partage</p>
          <code className="text-xs font-mono truncate block">{publicUrl}</code>
        </div>
        <div className="flex gap-2 shrink-0">
          <CopyButton text={publicUrl} />
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
              <ExternalLink className="h-3.5 w-3.5" />Aperçu
            </Button>
          </a>
        </div>
      </div>

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />Documents ({dataroom._count.documents})
          </TabsTrigger>
          <TabsTrigger value="add" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Ajouter
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />Accès ({dataroom._count.accesses})
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />Paramètres
          </TabsTrigger>
        </TabsList>

        {/* ── Documents actuels ── */}
        <TabsContent value="documents" className="mt-4">
          {dataroom.documents.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/10">
              <FolderLock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucun document dans cette dataroom</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Utilisez l&apos;onglet &laquo;&nbsp;Ajouter&nbsp;&raquo; pour y inclure des documents</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {dataroom.documents.map((dd, i) => (
                <div key={dd.id} className={cn("flex items-center gap-3 px-4 py-3 border-b last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                  <FileTypeIcon mimeType={dd.document.mimeType} className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium">{dd.document.fileName}</p>
                    <p className="text-xs text-muted-foreground">{getCategoryLabel(dd.document.category)} · {formatSize(dd.document.fileSize)}</p>
                  </div>
                  <a href={dd.document.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><ExternalLink className="h-3.5 w-3.5" /></Button>
                  </a>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => void handleRemove(dd.documentId)} disabled={removingId === dd.documentId}>
                    {removingId === dd.documentId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Ajouter des documents ── */}
        <TabsContent value="add" className="mt-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-xs" placeholder="Rechercher un document..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch("")}><X className="h-3.5 w-3.5" /></button>}
          </div>

          {availableDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? "Aucun document correspondant" : "Tous les documents sont déjà dans cette dataroom"}
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {availableDocs.map((doc, i) => (
                <div key={doc.id} className={cn("flex items-center gap-3 px-4 py-3 border-b last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                  <FileTypeIcon mimeType={doc.mimeType} className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">{getCategoryLabel(doc.category)} · {formatSize(doc.fileSize)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0"
                    onClick={() => void handleAdd(doc.id)} disabled={addingId === doc.id}>
                    {addingId === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}Ajouter
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Journal d'accès ── */}
        <TabsContent value="access" className="mt-4">
          {dataroom.accesses.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/10">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucune consultation enregistrée</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">
                <span>Visiteur</span><span>Date</span><span>IP</span>
              </div>
              {dataroom.accesses.map((a, i) => (
                <div key={a.id} className={cn("grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 border-t text-xs", i % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                  <span className="text-muted-foreground">{a.viewerName ?? a.viewerEmail ?? "Anonyme"}</span>
                  <span className="text-muted-foreground tabular-nums">{formatDateTime(a.createdAt)}</span>
                  <span className="text-muted-foreground font-mono">{a.ipAddress ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Paramètres ── */}
        <TabsContent value="settings" className="mt-4">
          <div className="max-w-md space-y-4 border rounded-lg p-5">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="resize-none text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>{"Date d'expiration"}</Label>
              <Input type="date" value={editExpires} onChange={(e) => setEditExpires(e.target.value)} />
              {editExpires && <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setEditExpires("")}>Supprimer la date</button>}
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="active" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="active" className="cursor-pointer">Dataroom active (accès public autorisé)</Label>
            </div>
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bénéficiaire (notifications)</p>
              <div className="space-y-1.5">
                <Label className="text-sm">Email du bénéficiaire</Label>
                <Input
                  type="email"
                  value={editRecipientEmail}
                  onChange={(e) => setEditRecipientEmail(e.target.value)}
                  placeholder="partenaire@exemple.com"
                  className="text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Il recevra un email à chaque ajout de document.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Nom du bénéficiaire</Label>
                <Input
                  value={editRecipientName}
                  onChange={(e) => setEditRecipientName(e.target.value)}
                  placeholder="Ex : Banque Dupont — Jean Martin"
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Mot de passe</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Laisser vide pour supprimer / ne pas changer…"
                  className="pr-9 text-sm"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">Laissez vide pour supprimer le mot de passe existant ou ne pas en définir.</p>
            </div>
            <Button onClick={() => void handleSaveSettings()} disabled={savingSettings} className="w-full">
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Enregistrer
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
