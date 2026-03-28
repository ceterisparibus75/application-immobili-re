"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  FileText, ExternalLink, FolderOpen, Building2, AlertTriangle,
  Search, X, Sparkles, Loader2, Plus, FileImage,
  File, List, LayoutGrid, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check,
  Download, Eye, Filter, FolderLock, Trash2, FileDown,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";
import { DeleteDocumentButton } from "./delete-button";
import { AiBadge } from "./ai-badge";
import { DocumentChat } from "./document-chat";
import { updateDocument, deleteDocument } from "@/actions/document";
import { getDatarooms, addDocumentToDataroom } from "@/actions/dataroom";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type DocumentItem = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  category: string | null;
  description: string | null;
  expiresAt: Date | null;
  storagePath: string | null;
  aiSummary: string | null;
  aiTags: string[];
  aiMetadata: unknown;
  aiStatus: string | null;
  aiAnalyzedAt: Date | null;
  buildingId: string | null;
  lotId: string | null;
  leaseId: string | null;
  tenantId: string | null;
  createdAt: Date;
  building: { id: string; name: string; city: string } | null;
  lot: { id: string; number: string; building: { name: string } | null } | null;
  lease: {
    id: string;
    lot: { number: string; building: { name: string } | null } | null;
    tenant: { firstName: string | null; lastName: string | null; companyName: string | null; entityType: string } | null;
  } | null;
  tenant: { id: string; firstName: string | null; lastName: string | null; companyName: string | null; entityType: string } | null;
};
type SortKey = "name" | "date" | "category" | "size";
type ViewMode = "list" | "grid";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCategoryLabel(cat: string | null): string {
  return DOCUMENT_CATEGORIES.find((c) => c.value === cat)?.label ?? "Autre";
}
function getBuildingKey(doc: DocumentItem): string | null {
  if (doc.buildingId) return doc.buildingId;
  if (doc.lot?.building) return "name:" + doc.lot.building.name;
  if (doc.lease?.lot?.building) return "name:" + doc.lease.lot.building.name;
  return null;
}
function getBuildingLabel(doc: DocumentItem): string {
  if (doc.building) return doc.building.name;
  if (doc.lot?.building) return doc.lot.building.name;
  if (doc.lease?.lot?.building) return doc.lease.lot.building.name;
  return "";
}
function getTenantLabel(doc: DocumentItem): string | null {
  const t = doc.tenant ?? doc.lease?.tenant ?? null;
  if (!t) return null;
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "Locataire")
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || null;
}
function isExpired(d: Date | null): boolean { return d ? new Date(d).getTime() < Date.now() : false; }
function isExpiringSoon(d: Date | null): boolean {
  if (!d) return false;
  const diff = new Date(d).getTime() - Date.now();
  return diff > 0 && diff < 60 * 24 * 3600 * 1000;
}
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
function FileTypeIcon({ mimeType, className }: { mimeType: string | null; className?: string }) {
  if (mimeType === "application/pdf") return <FileText className={cn("text-red-500", className)} />;
  if (mimeType?.startsWith("image/")) return <FileImage className={cn("text-blue-500", className)} />;
  return <File className={cn("text-muted-foreground", className)} />;
}
// ─── Tree Sidebar ─────────────────────────────────────────────────────────────
type TreeData = {
  total: number;
  buildings: { key: string; name: string; count: number }[];
  generalCount: number;
};

function buildTree(documents: DocumentItem[]): TreeData {
  const map = new Map<string, { name: string; count: number }>();
  let generalCount = 0;
  for (const doc of documents) {
    const key = getBuildingKey(doc);
    if (key) {
      if (!map.has(key)) map.set(key, { name: getBuildingLabel(doc), count: 0 });
      map.get(key)!.count++;
    } else { generalCount++; }
  }
  const buildings = Array.from(map.entries())
    .map(([key, { name, count }]) => ({ key, name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return { total: documents.length, buildings, generalCount };
}

function TreeSidebar({ tree, selected, onSelect }: { tree: TreeData; selected: string; onSelect: (key: string) => void; }) {
  const item = (key: string, label: string, count: number, icon: React.ReactNode) => (
    <button key={key} onClick={() => onSelect(key)}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
        selected === key ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      <span className={cn("text-xs tabular-nums", selected === key ? "text-primary-foreground/70" : "text-muted-foreground/60")}>
        {count}
      </span>
    </button>
  );
  return (
    <nav className="p-1.5 space-y-0.5">
      {item("all", "Tous les documents", tree.total, <FolderOpen className="h-4 w-4 shrink-0" />)}
      {tree.buildings.length > 0 && (
        <div className="pt-2">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Immeubles</p>
          {tree.buildings.map((b) => item(b.key, b.name, b.count, <Building2 className="h-4 w-4 shrink-0" />))}
        </div>
      )}
      {tree.generalCount > 0 && (
        <div className="pt-2">
          {item("general", "Général", tree.generalCount, <FolderOpen className="h-4 w-4 shrink-0" />)}
        </div>
      )}
    </nav>
  );
}

function SortHeader({ label, sortKey, current, dir, onSort }: { label: string; sortKey: SortKey; current: SortKey; dir: "asc" | "desc"; onSort: (k: SortKey) => void; }) {
  const active = current === sortKey;
  return (
    <button onClick={() => onSort(sortKey)}
      className={cn("flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors", active ? "text-foreground" : "text-muted-foreground")}
    >
      {label}
      {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
    </button>
  );
}

function FileRow({ doc, selected, onSelect, societyId, checked, onCheckedChange }: { doc: DocumentItem; selected: boolean; onSelect: (d: DocumentItem) => void; societyId: string; checked: boolean; onCheckedChange: (id: string) => void; }) {
  const expired = isExpired(doc.expiresAt);
  const expiringSoon = !expired && isExpiringSoon(doc.expiresAt);
  return (
    <div onClick={() => onSelect(doc)}
      className={cn("flex items-center gap-2 px-3 py-2 cursor-pointer select-none border-b border-border/50 last:border-0 hover:bg-accent/40 transition-colors group", selected && "bg-primary/10 hover:bg-primary/15")}
    >
      <div
        className={cn("shrink-0 opacity-0 group-hover:opacity-100 transition-opacity", checked && "opacity-100")}
        onClick={(e) => { e.stopPropagation(); onCheckedChange(doc.id); }}
      >
        <Checkbox checked={checked} aria-label={`Sélectionner ${doc.fileName}`} />
      </div>
      <FileTypeIcon mimeType={doc.mimeType} className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm truncate", selected && "font-medium")}>{doc.fileName}</span>
          <AiBadge status={doc.aiStatus} id={doc.id} />
          {expired && <span title="Expiré"><AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" aria-label="Expiré" /></span>}
          {expiringSoon && <span title="Expire bientôt"><AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" aria-label="Expire bientôt" /></span>}
        </div>
        {doc.description && <p className="text-xs text-muted-foreground truncate">{doc.description}</p>}
      </div>
      <span className="hidden md:block text-xs text-muted-foreground w-28 shrink-0 truncate">{getCategoryLabel(doc.category)}</span>
      <span className="hidden sm:block text-xs text-muted-foreground w-24 shrink-0 tabular-nums">{formatDate(doc.createdAt)}</span>
      <span className="hidden lg:block text-xs text-muted-foreground w-16 shrink-0 text-right tabular-nums">{formatFileSize(doc.fileSize ?? 0)}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
        </a>
        <DeleteDocumentButton societyId={societyId} documentId={doc.id} fileName={doc.fileName} />
      </div>
    </div>
  );
}

function FileGridCard({ doc, selected, onSelect, societyId, checked, onCheckedChange }: { doc: DocumentItem; selected: boolean; onSelect: (d: DocumentItem) => void; societyId: string; checked: boolean; onCheckedChange: (id: string) => void; }) {
  return (
    <div onClick={() => onSelect(doc)}
      className={cn("flex flex-col items-center gap-1.5 p-3 rounded-lg border cursor-pointer select-none hover:bg-accent/40 transition-colors group relative", selected && "border-primary bg-primary/10")}
    >
      <div
        className={cn("absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-10", checked && "opacity-100")}
        onClick={(e) => { e.stopPropagation(); onCheckedChange(doc.id); }}
      >
        <Checkbox checked={checked} aria-label={`Sélectionner ${doc.fileName}`} />
      </div>
      <FileTypeIcon mimeType={doc.mimeType} className="h-10 w-10" />
      <p className="text-xs text-center truncate w-full font-medium leading-tight">{doc.fileName}</p>
      <AiBadge status={doc.aiStatus} id={doc.id} />
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-0.5" onClick={(e) => e.stopPropagation()}>
        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="icon" className="h-6 w-6"><ExternalLink className="h-3 w-3" /></Button>
        </a>
        <DeleteDocumentButton societyId={societyId} documentId={doc.id} fileName={doc.fileName} />
      </div>
    </div>
  );
}
// ─── Preview Panel ────────────────────────────────────────────────────────────
function PreviewContent({ doc }: { doc: DocumentItem }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isImage = doc.mimeType?.startsWith("image/");
  const isPdf = doc.mimeType === "application/pdf";
  const previewUrl = doc.storagePath
    ? `/api/storage/view?path=${encodeURIComponent(doc.storagePath)}`
    : null;

  if (!previewUrl || (!isImage && !isPdf)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-8">
        <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-xs text-muted-foreground">Aperçu non disponible</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">PDF et images uniquement</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-8">
        <AlertTriangle className="h-8 w-8 text-orange-400 mx-auto mb-3" />
        <p className="text-xs text-muted-foreground">Impossible de charger l&apos;aperçu</p>
        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="mt-3 text-xs gap-1">
            <ExternalLink className="h-3.5 w-3.5" />Ouvrir
          </Button>
        </a>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="flex items-center justify-center h-full p-2 bg-muted/20 rounded">
        {loading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground absolute" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={doc.fileName}
          className="max-w-full max-h-full object-contain rounded"
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <iframe
        src={previewUrl}
        title={doc.fileName}
        className="w-full h-full border-0 rounded"
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
      />
    </div>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────
function EditForm({ doc, societyId, onSaved }: { doc: DocumentItem; societyId: string; onSaved: (updated: Partial<DocumentItem>) => void }) {
  const [category, setCategory] = useState(doc.category ?? "autre");
  const [description, setDescription] = useState(doc.description ?? "");
  const [expiresAt, setExpiresAt] = useState(
    doc.expiresAt ? new Date(doc.expiresAt).toISOString().split("T")[0] : ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateDocument(societyId, doc.id, {
      category,
      description: description || null,
      expiresAt: expiresAt || null,
    });
    setSaving(false);
    if (result.success) {
      toast.success("Document mis à jour");
      onSaved({ category, description: description || null, expiresAt: expiresAt ? new Date(expiresAt) : null });
    } else {
      toast.error(result.error ?? "Erreur lors de la mise à jour");
    }
  }

  const isDirty =
    category !== (doc.category ?? "autre") ||
    description !== (doc.description ?? "") ||
    expiresAt !== (doc.expiresAt ? new Date(doc.expiresAt).toISOString().split("T")[0] : "");

  return (
    <div className="space-y-4 py-1">
      <div className="space-y-1.5">
        <Label className="text-xs">Catégorie</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description optionnelle…"
          rows={3}
          className="text-xs resize-none"
          maxLength={500}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Date d&apos;expiration</Label>
        <Input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="h-8 text-xs"
        />
        {expiresAt && (
          <button
            type="button"
            onClick={() => setExpiresAt("")}
            className="text-[10px] text-muted-foreground hover:text-destructive"
          >
            Supprimer la date
          </button>
        )}
      </div>
      <Button
        onClick={() => void handleSave()}
        disabled={saving || !isDirty}
        size="sm"
        className="w-full h-8 text-xs gap-1"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Enregistrer
      </Button>
    </div>
  );
}

// ─── Dataroom Picker ─────────────────────────────────────────────────────────
function DataroomPickerDialog({ doc, societyId, onClose }: { doc: DocumentItem; societyId: string; onClose: () => void }) {
  const [datarooms, setDatarooms] = useState<{ id: string; name: string; _count: { documents: number } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    void getDatarooms(societyId).then((drs) => {
      setDatarooms(drs as { id: string; name: string; _count: { documents: number } }[]);
      setLoading(false);
    });
  }, [societyId]);

  async function handleAdd(dataroomId: string) {
    setAddingId(dataroomId);
    const result = await addDocumentToDataroom(societyId, dataroomId, doc.id);
    setAddingId(null);
    if (result.success) {
      setDone((prev) => new Set(prev).add(dataroomId));
      toast.success("Document ajouté à la dataroom");
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderLock className="h-4 w-4" />Ajouter à une dataroom
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1 mb-2 truncate">{doc.fileName}</p>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : datarooms.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">Aucune dataroom disponible</p>
            <Link href="/datarooms"><Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" />Créer une dataroom</Button></Link>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {datarooms.map((dr) => (
              <div key={dr.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{dr.name}</p>
                  <p className="text-xs text-muted-foreground">{dr._count.documents} document{dr._count.documents !== 1 ? "s" : ""}</p>
                </div>
                {done.has(dr.id) ? (
                  <Badge className="gap-1 text-xs bg-green-100 text-green-700 border-green-200"><Check className="h-3 w-3" />Ajouté</Badge>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0"
                    onClick={() => void handleAdd(dr.id)} disabled={addingId === dr.id}>
                    {addingId === dr.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}Ajouter
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Dataroom Picker ─────────────────────────────────────────────────────
function BulkDataroomPickerDialog({ selectedIds, societyId, onClose }: { selectedIds: string[]; societyId: string; onClose: () => void }) {
  const [datarooms, setDatarooms] = useState<{ id: string; name: string; _count: { documents: number } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ [dataroomId: string]: { done: number; total: number } }>({});

  useEffect(() => {
    void getDatarooms(societyId).then((drs) => {
      setDatarooms(drs as { id: string; name: string; _count: { documents: number } }[]);
      setLoading(false);
    });
  }, [societyId]);

  async function handleAddAll(dataroomId: string) {
    setAddingId(dataroomId);
    setProgress((prev) => ({ ...prev, [dataroomId]: { done: 0, total: selectedIds.length } }));
    let done = 0;
    for (const docId of selectedIds) {
      await addDocumentToDataroom(societyId, dataroomId, docId);
      done++;
      setProgress((prev) => ({ ...prev, [dataroomId]: { done, total: selectedIds.length } }));
    }
    setAddingId(null);
    toast.success(`${done} document${done !== 1 ? "s" : ""} ajouté${done !== 1 ? "s" : ""} à la dataroom`);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderLock className="h-4 w-4" />Ajouter à une dataroom
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1 mb-2">{selectedIds.length} élément{selectedIds.length !== 1 ? "s" : ""} sélectionné{selectedIds.length !== 1 ? "s" : ""}</p>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : datarooms.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">Aucune dataroom disponible</p>
            <Link href="/datarooms"><Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" />Créer une dataroom</Button></Link>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {datarooms.map((dr) => {
              const prog = progress[dr.id];
              const isDone = prog && prog.done === prog.total && prog.total > 0;
              return (
                <div key={dr.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{dr.name}</p>
                    <p className="text-xs text-muted-foreground">{dr._count.documents} document{dr._count.documents !== 1 ? "s" : ""}</p>
                  </div>
                  {isDone ? (
                    <Badge className="gap-1 text-xs bg-green-100 text-green-700 border-green-200"><Check className="h-3 w-3" />{prog.done}/{prog.total} ajoutés</Badge>
                  ) : prog && addingId === dr.id ? (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />{prog.done}/{prog.total}
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0"
                      onClick={() => void handleAddAll(dr.id)} disabled={addingId !== null}>
                      <Plus className="h-3 w-3" />Ajouter
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Details Panel ────────────────────────────────────────────────────────────
function DetailsPanel({ doc: initialDoc, societyId, onClose }: { doc: DocumentItem; societyId: string; onClose: () => void; }) {
  const [doc, setDoc] = useState(initialDoc);
  const [dataroomDoc, setDataroomDoc] = useState<DocumentItem | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    summary?: string; tags?: string[]; metadata?: unknown; status: string;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastId, setLastId] = useState(initialDoc.id);

  if (initialDoc.id !== lastId) {
    setDoc(initialDoc);
    setAnalysisResult(null);
    setAnalyzing(false);
    setLastId(initialDoc.id);
  }

  const display = analysisResult
    ? { ...doc, aiSummary: analysisResult.summary ?? doc.aiSummary, aiTags: analysisResult.tags ?? doc.aiTags, aiMetadata: analysisResult.metadata ?? doc.aiMetadata, aiStatus: analysisResult.status }
    : doc;

  const hasAnalysis = display.aiStatus === "done" && (!!display.aiSummary || display.aiTags.length > 0);
  const canAnalyze = !!display.storagePath && display.aiStatus !== "pending" && display.aiStatus !== "done";

  async function triggerAnalysis() {
    setAnalyzing(true);
    try {
      const r = await fetch(`/api/documents/${doc.id}/analyze`, { method: "POST" });
      if (r.ok) {
        const data = (await r.json()) as { summary?: string; tags?: string[]; metadata?: unknown };
        setAnalysisResult({ summary: data.summary, tags: data.tags, metadata: data.metadata, status: "done" });
      } else { setAnalysisResult({ status: "error" }); }
    } catch { setAnalysisResult({ status: "error" }); }
    finally { setAnalyzing(false); }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b flex items-start gap-2 shrink-0">
        <FileTypeIcon mimeType={doc.mimeType} className="h-8 w-8 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold break-words leading-tight">{doc.fileName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatFileSize(doc.fileSize ?? 0)} · {getCategoryLabel(doc.category)}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <AiBadge status={display.aiStatus} id={doc.id} />
            {isExpired(doc.expiresAt) && <Badge variant="destructive" className="text-[10px] py-0">Expiré</Badge>}
            {isExpiringSoon(doc.expiresAt) && <Badge className="text-[10px] py-0 bg-orange-100 text-orange-700">Expire bientôt</Badge>}
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground mt-0.5"><X className="h-4 w-4" /></button>
      </div>
      <div className="px-3 py-2 flex gap-2 border-b shrink-0">
        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1"><ExternalLink className="h-3.5 w-3.5" />Ouvrir</Button>
        </a>
        <a
          href={doc.storagePath ? `/api/storage/view?path=${encodeURIComponent(doc.storagePath)}&dl=1` : doc.fileUrl}
          download={doc.fileName}
          className="shrink-0"
        >
          <Button variant="outline" size="icon" className="h-7 w-7" title="Télécharger">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </a>
        <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" title="Ajouter à une dataroom"
          onClick={() => setDataroomDoc(doc)}>
          <FolderLock className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Tabs defaultValue="preview" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-2 mt-2 shrink-0">
          <TabsTrigger value="preview" className="flex-1 text-xs"><Eye className="h-3 w-3 mr-1" />Aperçu</TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 text-xs"><Sparkles className="h-3.5 w-3.5 mr-1" />IA</TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 text-xs">Chat</TabsTrigger>
          <TabsTrigger value="info" className="flex-1 text-xs">Infos</TabsTrigger>
          <TabsTrigger value="edit" className="flex-1 text-xs"><Pencil className="h-3 w-3 mr-1" />Éditer</TabsTrigger>
        </TabsList>
        <TabsContent value="preview" className="flex-1 min-h-0 px-3 pb-3 mt-2 h-full">
          <div className="h-full min-h-[300px]">
            <PreviewContent doc={doc} />
          </div>
        </TabsContent>
        <TabsContent value="ai" className="flex-1 overflow-y-auto px-3 pb-3 space-y-3 mt-2">
          {display.aiStatus === "pending" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />Analyse en cours…
            </div>
          )}
          {hasAnalysis && (
            <>
              {display.aiSummary && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Résumé</p>
                  <p className="text-xs leading-relaxed">{display.aiSummary}</p>
                </div>
              )}
              {display.aiTags.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Mots-clés</p>
                  <div className="flex flex-wrap gap-1">
                    {display.aiTags.map((tag) => <Badge key={tag} variant="secondary" className="text-[10px] py-0">{tag}</Badge>)}
                  </div>
                </div>
              )}
              {display.aiMetadata && typeof display.aiMetadata === "object" && Object.keys(display.aiMetadata as Record<string, unknown>).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Informations extraites</p>
                  <dl className="space-y-1">
                    {Object.entries(display.aiMetadata as Record<string, unknown>)
                      .filter(([, v]) => v !== null && v !== undefined && v !== "")
                      .map(([k, v]) => (
                        <div key={k} className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
                          <dt className="text-muted-foreground capitalize whitespace-nowrap">{k.replace(/_/g, " ")}:</dt>
                          <dd className="font-medium break-words">{String(v)}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
              )}
            </>
          )}
          {(!display.aiStatus || display.aiStatus === "error") && (
            <div className="text-center py-6">
              <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground mb-3">
                {display.aiStatus === "error" ? "L’analyse a échoué." : "Pas encore analysé par l’IA."}
              </p>
              {canAnalyze ? (
                <Button onClick={() => void triggerAnalysis()} disabled={analyzing} variant="outline" size="sm" className="text-xs">
                  {analyzing ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Analyse…</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Analyser</>}
                </Button>
              ) : <p className="text-xs text-muted-foreground/60">Disponible pour PDF et images récents.</p>}
            </div>
          )}
        </TabsContent>
        <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 px-3 pb-3 mt-2">
          <DocumentChat documentId={doc.id} />
        </TabsContent>
        <TabsContent value="info" className="overflow-y-auto px-3 pb-3 mt-2 space-y-2">
          <dl className="space-y-2 text-xs">
            {([
              ["Nom", doc.fileName],
              ["Catégorie", getCategoryLabel(doc.category)],
              ["Taille", formatFileSize(doc.fileSize ?? 0)],
              ["Ajouté le", formatDate(doc.createdAt)],
              ...(doc.expiresAt ? [["Expiration", formatDate(doc.expiresAt)]] : []),
              ...(doc.description ? [["Description", doc.description]] : []),
              ...(getTenantLabel(doc) ? [["Locataire", getTenantLabel(doc)!]] : []),
              ...(getBuildingLabel(doc) ? [["Immeuble", getBuildingLabel(doc)]] : []),
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="text-muted-foreground w-20 shrink-0">{label}</dt>
                <dd className="font-medium break-words flex-1">{value}</dd>
              </div>
            ))}
          </dl>
        </TabsContent>
        <TabsContent value="edit" className="overflow-y-auto px-3 pb-3 mt-2">
          <EditForm
            doc={doc}
            societyId={societyId}
            onSaved={(updated) => setDoc((prev) => ({ ...prev, ...updated }))}
          />
        </TabsContent>
      </Tabs>
      {dataroomDoc && (
        <DataroomPickerDialog
          doc={dataroomDoc}
          societyId={societyId}
          onClose={() => setDataroomDoc(null)}
        />
      )}
    </div>
  );
}
// ─── Main Component ───────────────────────────────────────────────────────────
export function DocumentsClient({ societyId, documents }: { societyId: string; documents: DocumentItem[]; }) {
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDataroomOpen, setBulkDataroomOpen] = useState(false);

  const usedCategories = useMemo(() => {
    const set = new Set<string>();
    for (const d of documents) { if (d.category) set.add(d.category); }
    return DOCUMENT_CATEGORIES.filter((c) => set.has(c.value));
  }, [documents]);

  const tree = useMemo(() => buildTree(documents), [documents]);

  const folderFiltered = useMemo(() => {
    if (selectedFolder === "all") return documents;
    if (selectedFolder === "general") return documents.filter((d) => !getBuildingKey(d));
    return documents.filter((d) => getBuildingKey(d) === selectedFolder);
  }, [documents, selectedFolder]);

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const categoryFiltered = categoryFilter === "all" ? folderFiltered : folderFiltered.filter((d) => d.category === categoryFilter);
    const filtered = !q ? categoryFiltered : categoryFiltered.filter((d) =>
      d.fileName.toLowerCase().includes(q) ||
      (d.description?.toLowerCase().includes(q) ?? false) ||
      getCategoryLabel(d.category).toLowerCase().includes(q) ||
      (d.aiSummary?.toLowerCase().includes(q) ?? false) ||
      d.aiTags.some((t) => t.toLowerCase().includes(q)) ||
      getBuildingLabel(d).toLowerCase().includes(q) ||
      (getTenantLabel(d) ?? "").toLowerCase().includes(q)
    );
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.fileName.localeCompare(b.fileName, "fr");
      else if (sortBy === "date") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortBy === "category") cmp = (a.category ?? "").localeCompare(b.category ?? "", "fr");
      else if (sortBy === "size") cmp = (a.fileSize ?? 0) - (b.fileSize ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [folderFiltered, categoryFilter, search, sortBy, sortDir]);

  function handleSort(key: SortKey) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
  }

  function selectDoc(doc: DocumentItem) { setSelectedDoc(doc); setMobileDetailsOpen(true); }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    let successCount = 0;
    let errorCount = 0;
    for (const id of Array.from(selectedIds)) {
      const result = await deleteDocument(societyId, id);
      if (result.success) successCount++;
      else errorCount++;
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    if (successCount > 0) toast.success(`${successCount} document${successCount !== 1 ? "s" : ""} supprimé${successCount !== 1 ? "s" : ""}`);
    if (errorCount > 0) toast.error(`${errorCount} document${errorCount !== 1 ? "s" : ""} n'ont pas pu être supprimé${errorCount !== 1 ? "s" : ""}`);
  }

  function handleExportCsv() {
    const header = ["Nom", "Catégorie", "Taille (Ko)", "Ajouté le", "Description", "Immeuble", "Locataire"];
    const rows = sorted.map((doc) => [
      doc.fileName,
      getCategoryLabel(doc.category),
      doc.fileSize !== null ? String(Math.round(doc.fileSize / 1024)) : "",
      new Date(doc.createdAt).toLocaleDateString("fr-FR"),
      doc.description ?? "",
      getBuildingLabel(doc),
      getTenantLabel(doc) ?? "",
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escape).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `documents_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex border rounded-lg overflow-hidden bg-background" style={{ height: "calc(100vh - 220px)", minHeight: "480px" }}>
      <div className="hidden md:flex flex-col w-52 shrink-0 border-r overflow-y-auto bg-muted/20">
        <div className="flex-1 overflow-y-auto">
          <TreeSidebar tree={tree} selected={selectedFolder} onSelect={(k) => { setSelectedFolder(k); setSelectedDoc(null); }} />
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/10 shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input className="pl-8 h-7 text-xs" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch("")}><X className="h-3.5 w-3.5" /></button>}
          </div>
          {usedCategories.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-7 text-xs w-36 border-0 bg-transparent shadow-none focus:ring-0 px-1">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Toutes catégories</SelectItem>
                  {usedCategories.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoryFilter !== "all" && (
                <button onClick={() => setCategoryFilter("all")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Exporter en CSV" onClick={handleExportCsv}><FileDown className="h-3.5 w-3.5" /></Button>
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewMode("list")}><List className="h-3.5 w-3.5" /></Button>
            <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewMode("grid")}><LayoutGrid className="h-3.5 w-3.5" /></Button>
          </div>
          <Link href="/documents/nouveau"><Button size="sm" className="h-7 text-xs gap-1 shrink-0"><Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Nouveau</span></Button></Link>
        </div>
        {viewMode === "list" && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 border-b shrink-0">
            <div className="w-4 shrink-0" />
            <div className="flex-1"><SortHeader label="Nom" sortKey="name" current={sortBy} dir={sortDir} onSort={handleSort} /></div>
            <div className="hidden md:block w-28 shrink-0"><SortHeader label="Catégorie" sortKey="category" current={sortBy} dir={sortDir} onSort={handleSort} /></div>
            <div className="hidden sm:block w-24 shrink-0"><SortHeader label="Ajouté" sortKey="date" current={sortBy} dir={sortDir} onSort={handleSort} /></div>
            <div className="hidden lg:block w-16 shrink-0 text-right"><SortHeader label="Taille" sortKey="size" current={sortBy} dir={sortDir} onSort={handleSort} /></div>
            <div className="w-16 shrink-0" />
          </div>
        )}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b shrink-0 flex-wrap">
            <span className="text-xs font-medium text-primary">{selectedIds.size} élément{selectedIds.size !== 1 ? "s" : ""} sélectionné{selectedIds.size !== 1 ? "s" : ""}</span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs gap-1"
              disabled={bulkDeleting}
              onClick={() => void handleBulkDelete()}
            >
              {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Supprimer la sélection
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => setBulkDataroomOpen(true)}
            >
              <FolderLock className="h-3.5 w-3.5" />
              Ajouter à une dataroom
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs ml-auto"
              onClick={() => setSelectedIds(new Set())}
            >
              Désélectionner tout
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium mb-1">Aucun document</p>
              <Link href="/documents/nouveau"><Button size="sm"><Plus className="h-4 w-4" />Ajouter</Button></Link>
            </div>
          ) : viewMode === "list" ? (
            <div>{sorted.map((doc) => <FileRow key={doc.id} doc={doc} selected={selectedDoc?.id === doc.id} onSelect={selectDoc} societyId={societyId} checked={selectedIds.has(doc.id)} onCheckedChange={toggleSelection} />)}</div>
          ) : (
            <div className="p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {sorted.map((doc) => <FileGridCard key={doc.id} doc={doc} selected={selectedDoc?.id === doc.id} onSelect={selectDoc} societyId={societyId} checked={selectedIds.has(doc.id)} onCheckedChange={toggleSelection} />)}
            </div>
          )}
        </div>
        <div className="border-t px-3 py-1 text-xs text-muted-foreground bg-muted/10 shrink-0 flex items-center gap-2">
          <span>{sorted.length} élément{sorted.length !== 1 ? "s" : ""}</span>
          {categoryFilter !== "all" && (
            <Badge variant="secondary" className="text-[10px] py-0 gap-1">
              {getCategoryLabel(categoryFilter)}
              <button onClick={() => setCategoryFilter("all")}><X className="h-2.5 w-2.5" /></button>
            </Badge>
          )}
          {search && (
            <Badge variant="secondary" className="text-[10px] py-0 gap-1">
              &ldquo;{search}&rdquo;
              <button onClick={() => setSearch("")}><X className="h-2.5 w-2.5" /></button>
            </Badge>
          )}
        </div>
      </div>
      {selectedDoc && (
        <div className="hidden lg:flex flex-col w-72 shrink-0 border-l overflow-hidden">
          <DetailsPanel doc={selectedDoc} societyId={societyId} onClose={() => setSelectedDoc(null)} />
        </div>
      )}
      <Sheet open={mobileDetailsOpen} onOpenChange={(open) => { setMobileDetailsOpen(open); if (!open) setSelectedDoc(null); }}>
        <SheetContent side="right" className="w-[90vw] sm:max-w-sm p-0 flex flex-col overflow-hidden lg:hidden">
          {selectedDoc && (
            <>
              <SheetHeader className="sr-only"><SheetTitle>{selectedDoc.fileName}</SheetTitle></SheetHeader>
              <div className="flex-1 overflow-hidden"><DetailsPanel doc={selectedDoc} societyId={societyId} onClose={() => { setMobileDetailsOpen(false); setSelectedDoc(null); }} /></div>
            </>
          )}
        </SheetContent>
      </Sheet>
      {bulkDataroomOpen && (
        <BulkDataroomPickerDialog
          selectedIds={Array.from(selectedIds)}
          societyId={societyId}
          onClose={() => setBulkDataroomOpen(false)}
        />
      )}
    </div>
  );
}
