"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  FileText, FileSpreadsheet, FileArchive, FileImage, File, Grid3X3,
  Search, X, Loader2, Tag, Clock, AlertTriangle,
  FolderOpen, Building2, List, ArrowUpDown, ArrowUp, ArrowDown,
  Download, Trash2, FileDown, Maximize2, Database, Save,
  History, Upload,
} from "lucide-react";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";
import { updateDocument, deleteDocument, bulkUpdateCategory } from "@/actions/document";
import { Checkbox } from "@/components/ui/checkbox";

// ─── Types ─────────────────────────────────────────────────────────────────────────────────
type DocumentVersion = {
  id: string;
  fileName: string;
  versionNumber: number;
  createdAt: Date | string;
  fileUrl: string;
  storagePath: string | null;
};

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
  userTags: string[];
  versionOf: string | null;
  versionNumber: number;
  versions: DocumentVersion[];
  fullText?: string | null;
  aiCategory?: string | null;
  building: { id: string; name: string; city: string } | null;
  lot: { id: string; number: string; building: { name: string } | null } | null;
  lease: {
    id: string;
    lot: { number: string; building: { name: string } | null } | null;
    tenant: { firstName: string | null; lastName: string | null; companyName: string | null; entityType: string } | null;
  } | null;
  tenant: { id: string; firstName: string | null; lastName: string | null; companyName: string | null; entityType: string } | null;
};
type SortKey = "fileName" | "fileSize" | "expiresAt" | "createdAt";
type ExpirationFilter = "all" | "expired" | "expiring";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getCategoryLabel(cat: string | null): string {
  return DOCUMENT_CATEGORIES.find((c) => c.value === cat)?.label ?? "Autre";
}
function getBuildingKey(doc: DocumentItem): string | null {
  const name = getBuildingLabel(doc);
  return name || null;
}
function getBuildingLabel(doc: DocumentItem): string {
  if (doc.building) return doc.building.name;
  if (doc.lot?.building) return doc.lot.building.name;
  if (doc.lease?.lot?.building) return doc.lease.lot.building.name;
  return "";
}
function getTenantLabel(docOrTenant: DocumentItem | { firstName?: string | null; lastName?: string | null; companyName?: string | null; entityType?: string } | null): string | null {
  if (!docOrTenant) return null;
  const t = "tenant" in docOrTenant ? (docOrTenant.tenant ?? docOrTenant.lease?.tenant ?? null) : docOrTenant;
  if (!t) return null;
  return (t.entityType === "PERSONNE_MORALE" || t.entityType == null)
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
function FileTypeIcon({ mimeType, fileName, className }: { mimeType: string | null; fileName?: string; className?: string }) {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  if (mimeType === "application/pdf" || ext === "pdf")
    return <FileText className={cn("text-red-500 dark:text-red-400", className)} />;
  if (mimeType?.startsWith("image/"))
    return <FileImage className={cn("text-violet-500 dark:text-violet-400", className)} />;
  if (mimeType?.includes("word") || ext === "doc" || ext === "docx")
    return <FileText className={cn("text-blue-600 dark:text-blue-400", className)} />;
  if (mimeType?.includes("excel") || mimeType?.includes("spreadsheet") || ext === "xls" || ext === "xlsx")
    return <FileSpreadsheet className={cn("text-green-600 dark:text-green-400", className)} />;
  if (mimeType?.includes("zip") || ext === "zip" || ext === "rar" || ext === "7z")
    return <FileArchive className={cn("text-yellow-500 dark:text-yellow-400", className)} />;
  return <File className={cn("text-slate-400 dark:text-slate-300", className)} />;
}

const CATEGORY_BADGE: Record<string, string> = {
  bail: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  avenant: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  titre_propriete: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  acte_acquisition: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  reglement_copro: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  facture: "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)] border border-[var(--color-status-caution)]/25",
  quittance: "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)] border border-[var(--color-status-positive)]/25",
  diagnostic: "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)] border border-[var(--color-status-positive)]/25",
  plan: "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)] border border-[var(--color-status-positive)]/25",
  etat_des_lieux: "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)] border border-[var(--color-status-positive)]/25",
  assurance: "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)] border border-[var(--color-status-positive)]/25",
  courrier: "bg-[var(--color-brand-light)] text-[var(--color-brand-cyan)] border border-[var(--color-brand-cyan)]/25",
  contrat: "bg-[var(--color-brand-light)] text-[var(--color-brand-cyan)] border border-[var(--color-brand-cyan)]/25",
  autre: "bg-muted text-muted-foreground border border-border",
};

const CATEGORIES_OPTIONS = DOCUMENT_CATEGORIES.map(c => ({ value: c.value, label: c.label }));

function findDocumentById(documents: DocumentItem[], documentId?: string): DocumentItem | null {
  if (!documentId) return null;
  return documents.find((doc) => doc.id === documentId) ?? null;
}

// ─── Tree Sidebar ─────────────────────────────────────────────────────────────
type TreeData = {
  total: number;
  buildings: { key: string; name: string; count: number }[];
  generalCount: number;
  expiredCount: number;
  expiringCount: number;
  allTags: { tag: string; count: number }[];
};

function buildTree(documents: DocumentItem[]): TreeData {
  const map = new Map<string, { name: string; count: number }>();
  let generalCount = 0;
  let expiredCount = 0;
  let expiringCount = 0;
  const tagMap = new Map<string, number>();
  for (const doc of documents) {
    const key = getBuildingKey(doc);
    if (key) {
      if (!map.has(key)) map.set(key, { name: getBuildingLabel(doc), count: 0 });
      map.get(key)!.count++;
    } else { generalCount++; }
    if (isExpired(doc.expiresAt)) expiredCount++;
    else if (isExpiringSoon(doc.expiresAt)) expiringCount++;
    for (const tag of (doc.userTags ?? [])) { tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1); }
  }
  const buildings = Array.from(map.entries())
    .map(([key, { name, count }]) => ({ key, name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const allTags = Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
  return { total: documents.length, buildings, generalCount, expiredCount, expiringCount, allTags };
}

function TreeSidebar({ tree, selected, onSelect, expirationFilter, onExpirationFilter, tagFilter, onTagFilter }: {
  tree: TreeData; selected: string; onSelect: (key: string) => void;
  expirationFilter: ExpirationFilter; onExpirationFilter: (f: ExpirationFilter) => void;
  tagFilter: string; onTagFilter: (t: string) => void;
}) {
  const item = (key: string, label: string, count: number, icon: React.ReactNode) => (
    <button key={key} onClick={() => onSelect(key)}
      className={cn(
        "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left transition-colors",
        selected === key
          ? "bg-[#F0F7FF] text-[var(--color-brand-deep)] font-medium border-l-[3px] border-l-[var(--color-brand-blue)]"
          : "hover:bg-[#F9FAFB] text-[#64748B] hover:text-[var(--color-brand-deep)]"
      )}
    >
      {icon}
      <span className={cn("text-xs tabular-nums", selected === key ? "text-[var(--color-brand-blue)]" : "text-[#94A3B8]")}>
        {count}
      </span>
    </button>
  );
  return (
    <nav className="p-1.5 space-y-0.5">
      {item("all", "Tous les documents", tree.total, <FolderOpen className="h-4 w-4 shrink-0" />)}
      {tree.buildings.length > 0 && (
        <div className="pt-2">
          <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Immeubles</p>
          {tree.buildings.map((b) => item(b.key, b.name, b.count, <Building2 className="h-4 w-4 shrink-0" />))}
        </div>
      )}
      {tree.generalCount > 0 && (
        <div className="pt-2">
          {item("general", "General", tree.generalCount, <FolderOpen className="h-4 w-4 shrink-0" />)}
        </div>
      )}
      {(tree.expiredCount > 0 || tree.expiringCount > 0) && (
        <div className="pt-2">
          <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Expiration</p>
          {tree.expiredCount > 0 && (
            <button onClick={() => onExpirationFilter(expirationFilter === "expired" ? "all" : "expired")}
              className={cn("w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left transition-colors",
                expirationFilter === "expired"
                  ? "bg-red-50 text-red-700 font-medium border-l-[3px] border-l-red-500"
                  : "hover:bg-[#F9FAFB] text-[#64748B] hover:text-red-600")}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">Expires</span>
              <span className="text-xs tabular-nums text-red-400">{tree.expiredCount}</span>
            </button>
          )}
          {tree.expiringCount > 0 && (
            <button onClick={() => onExpirationFilter(expirationFilter === "expiring" ? "all" : "expiring")}
              className={cn("w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left transition-colors",
                expirationFilter === "expiring"
                  ? "bg-amber-50 text-amber-700 font-medium border-l-[3px] border-l-amber-500"
                  : "hover:bg-[#F9FAFB] text-[#64748B] hover:text-amber-600")}>
              <Clock className="h-4 w-4 shrink-0" />
              <span className="flex-1">Expirent bientot</span>
              <span className="text-xs tabular-nums text-amber-400">{tree.expiringCount}</span>
            </button>
          )}
        </div>
      )}
      {tree.allTags.length > 0 && (
        <div className="pt-2">
          <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Tags</p>
          <div className="flex flex-wrap gap-1 px-2 py-1">
            {tree.allTags.slice(0, 12).map(({ tag, count }) => (
              <button key={tag} onClick={() => onTagFilter(tagFilter === tag ? "" : tag)}
                className={cn("text-[10px] px-1.5 py-0.5 rounded-full border transition-colors",
                  tagFilter === tag
                    ? "bg-[var(--color-brand-blue)] text-white border-[var(--color-brand-blue)]"
                    : "bg-background text-muted-foreground border-border hover:border-[var(--color-brand-blue)]/50")}>
                {tag} <span className="opacity-60">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

function SortHeader({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey; current: SortKey;
  dir: "asc" | "desc"; onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button onClick={() => onSort(sortKey)}
      className={cn("flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors",
        active ? "text-foreground" : "text-muted-foreground")}>
      {label}
      {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
        : <ArrowUpDown className="h-3 w-3 opacity-40" />}
    </button>
  );
}

function FileRow({ doc, selected, onSelect, onOpen }: {
  doc: DocumentItem; selected: boolean;
  onSelect: (id: string) => void; onOpen: (doc: DocumentItem) => void;
}) {
  const exp = isExpired(doc.expiresAt);
  const soon = isExpiringSoon(doc.expiresAt);
  return (
    <tr className={cn("border-b last:border-0 hover:bg-muted/40 transition-colors cursor-pointer text-sm",
      selected && "bg-blue-50/60")} onClick={() => onOpen(doc)}>
      <td className="w-8 px-3 py-2.5" onClick={e => { e.stopPropagation(); onSelect(doc.id); }}>
        <Checkbox checked={selected} onCheckedChange={() => onSelect(doc.id)} />
      </td>
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2">
          <FileTypeIcon mimeType={doc.mimeType} className="flex-shrink-0 text-muted-foreground" />
          <span className="truncate max-w-[220px] font-medium">{doc.fileName}</span>
          {doc.versions.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex-shrink-0">
              v{doc.versionNumber + doc.versions.length}
            </span>
          )}
        </div>
        {doc.userTags && doc.userTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {doc.userTags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">{tag}</span>
            ))}
          </div>
        )}
      </td>
      <td className="py-2.5 pr-3 hidden md:table-cell"><span className={cn("text-xs px-1.5 py-0.5 rounded", CATEGORY_BADGE[doc.category ?? "autre"] ?? CATEGORY_BADGE.autre)}>{getCategoryLabel(doc.category)}</span></td>
      <td className="py-2.5 pr-3 hidden lg:table-cell text-muted-foreground text-xs">{doc.building?.name ?? "—"}</td>
      <td className="py-2.5 pr-3 hidden xl:table-cell text-muted-foreground text-xs">{doc.fileSize ? formatFileSize(doc.fileSize) : "—"}</td>
      <td className="py-2.5 pr-3 text-xs">
        {doc.expiresAt ? (
          <span className={cn("flex items-center gap-1", exp ? "text-red-600" : soon ? "text-amber-600" : "text-muted-foreground")}>
            {(exp || soon) && <Clock className="h-3 w-3" />}
            {new Date(doc.expiresAt).toLocaleDateString("fr-FR")}
          </span>
        ) : "—"}
      </td>
      <td className="py-2.5 pr-3 text-muted-foreground text-xs hidden sm:table-cell">{new Date(doc.createdAt).toLocaleDateString("fr-FR")}</td>
    </tr>
  );
}

function FileGridCard({ doc, selected, onSelect, onOpen }: {
  doc: DocumentItem; selected: boolean;
  onSelect: (id: string) => void; onOpen: (doc: DocumentItem) => void;
}) {
  const exp = isExpired(doc.expiresAt);
  const soon = isExpiringSoon(doc.expiresAt);
  return (
    <div className={cn("border rounded-lg p-3 flex flex-col gap-2 cursor-pointer hover:shadow-sm transition-shadow bg-card",
      selected && "ring-2 ring-blue-400")}
      onClick={() => onOpen(doc)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative" onClick={e => { e.stopPropagation(); onSelect(doc.id); }}>
            <Checkbox checked={selected} onCheckedChange={() => onSelect(doc.id)} />
          </div>
          <FileTypeIcon mimeType={doc.mimeType} className="flex-shrink-0 text-muted-foreground" />
        </div>
        {doc.versions.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">v{doc.versionNumber + doc.versions.length}</span>
        )}
      </div>
      <p className="text-sm font-medium truncate">{doc.fileName}</p>
      <div className="flex items-center justify-between gap-1">
        <span className={cn("text-xs px-1.5 py-0.5 rounded", CATEGORY_BADGE[doc.category ?? "autre"] ?? CATEGORY_BADGE.autre)}>{getCategoryLabel(doc.category)}</span>
        {doc.expiresAt && (exp || soon) && (
          <span className={cn("text-[10px] flex items-center gap-0.5", exp ? "text-red-600" : "text-amber-600")}>
            <Clock className="h-3 w-3" />{new Date(doc.expiresAt).toLocaleDateString("fr-FR")}
          </span>
        )}
      </div>
      {doc.userTags && doc.userTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {doc.userTags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function extractStoragePath(fileUrl: string): string | null {
  if (!fileUrl) return null;
  try {
    const url = new URL(fileUrl);
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/[^/]+\/(.+?)(?:\?|$)/);
    if (match) return decodeURIComponent(match[1]);
    const match2 = url.pathname.match(/\/object\/sign\/[^/]+\/(.+?)(?:\?|$)/);
    if (match2) return decodeURIComponent(match2[1]);
  } catch { /* not a URL */ }
  if (!fileUrl.startsWith("http")) return fileUrl;
  return null;
}

function PreviewContent({ doc }: { doc: DocumentItem }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  useEffect(() => {
    const sp = doc.storagePath ?? extractStoragePath(doc.fileUrl);
    if (!sp) {
      // No storage path: use fileUrl directly (async via callback to satisfy linter)
      void Promise.resolve().then(() => setSignedUrl(doc.fileUrl));
      return;
    }
    fetch("/api/storage/view", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath: sp }) })
      .then(r => r.ok ? r.json() : null)
      .then(d => setSignedUrl(d?.url ?? doc.fileUrl))
      .catch(() => setSignedUrl(doc.fileUrl));
  }, [doc.storagePath, doc.fileUrl]);
  if (!signedUrl) return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  const mt = doc.mimeType ?? "";
  if (mt.startsWith("image/")) return <img src={signedUrl} alt={doc.fileName} className="max-w-full max-h-full object-contain mx-auto" />;
  if (mt === "application/pdf") return <iframe src={signedUrl} className="w-full h-full border-0 rounded" title={doc.fileName} />;
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
      <FileTypeIcon mimeType={doc.mimeType} className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Prévisualisation non disponible pour ce type de fichier.</p>
      <a href={signedUrl} download={doc.fileName} target="_blank" rel="noopener noreferrer">
        <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1.5" />Télécharger</Button>
      </a>
    </div>
  );
}

function FullscreenPreviewDialog({ doc, open, onClose }: { doc: DocumentItem; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <DialogTitle className="text-sm flex items-center gap-2">
            <FileTypeIcon mimeType={doc.mimeType} className="text-muted-foreground" />
            {doc.fileName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden p-2">
          <PreviewContent doc={doc} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ doc, societyId, onSuccess }: { doc: DocumentItem; societyId: string; onSuccess: () => void }) {
  const [category, setCategory] = useState(doc.category ?? "autre");
  const [description, setDescription] = useState(doc.description ?? "");
  const [expiresAt, setExpiresAt] = useState(doc.expiresAt ? new Date(doc.expiresAt).toISOString().split("T")[0] : "");
  const [userTags, setUserTags] = useState<string[]>(doc.userTags ?? []);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTag = useCallback(() => {
    const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9à-ɏ\-_]/g, "");
    if (t && !userTags.includes(t) && userTags.length < 10) {
      setUserTags(prev => [...prev, t]);
      setTagInput("");
      tagInputRef.current?.focus();
    }
  }, [tagInput, userTags]);

  const removeTag = useCallback((tag: string) => setUserTags(prev => prev.filter(t => t !== tag)), []);

  const handleSave = async () => {
    setSaving(true); setError(null);
    const result = await updateDocument(societyId, doc.id, { category, description: description || null, expiresAt: expiresAt || null, userTags });
    setSaving(false);
    if (result.success) onSuccess();
    else setError(result.error ?? "Erreur");
  };
  return (
    <div className="space-y-4 p-4">
      {error && <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</p>}
      <div className="space-y-1.5">
        <Label className="text-xs">Catégorie</Label>
        <NativeSelect options={CATEGORIES_OPTIONS} value={category} onChange={e => setCategory(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Description optionnelle…" className="text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Date d'expiration</Label>
        <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Tags <span className="text-muted-foreground">({userTags.length}/10)</span></Label>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {userTags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              <Tag className="h-3 w-3" />{tag}
              <button onClick={() => removeTag(tag)} className="hover:text-red-600 ml-0.5">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Input ref={tagInputRef} value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Ajouter un tag…" className="text-sm h-8" disabled={userTags.length >= 10} />
          <Button size="sm" variant="outline" onClick={addTag} disabled={!tagInput.trim() || userTags.length >= 10} className="h-8 px-2">+</Button>
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full gap-1.5">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {saving ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
}

function VersionsTab({ doc, societyId, onRefresh }: { doc: DocumentItem; societyId: string; onRefresh: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("societyId", societyId);
    fd.append("parentDocumentId", doc.id);
    const res = await fetch("/api/documents/upload-version", { method: "POST", body: fd }).catch(() => null);
    setUploading(false);
    if (!res?.ok) { setError("Erreur lors de l'upload"); return; }
    onRefresh();
  };

  const allVersions = [
    { id: doc.id, fileName: doc.fileName, versionNumber: doc.versionNumber, createdAt: doc.createdAt, fileUrl: doc.fileUrl, storagePath: doc.storagePath },
    ...doc.versions,
  ].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div className="p-4 space-y-3">
      {error && <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</p>}
      <div className="flex justify-end">
        <input type="file" ref={fileRef} className="hidden" onChange={handleUpload} />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Upload…" : "Nouvelle version"}
        </Button>
      </div>
      <div className="space-y-1">
        {allVersions.map((v, i) => (
          <div key={v.id} className={cn("flex items-center justify-between gap-2 p-2 rounded border text-sm",
            i === 0 ? "bg-blue-50 border-blue-200" : "bg-background")}>
            <div className="flex items-center gap-2 min-w-0">
              <History className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{v.fileName}</span>
              {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white">Actuel</span>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground">v{v.versionNumber}</span>
              <span className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleDateString("fr-FR")}</span>
              <a href={v.fileUrl} download={v.fileName} target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="ghost" className="h-6 w-6"><Download className="h-3.5 w-3.5" /></Button>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BulkRecategorizeDialog({ open, onOpenChange, docIds, societyId, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  docIds: string[]; societyId: string; onSuccess: () => void;
}) {
  const [category, setCategory] = useState("autre");
  const [saving, setSaving] = useState(false);

  const handleApply = async () => {
    setSaving(true);
    const result = await bulkUpdateCategory(societyId, docIds, category);
    setSaving(false);
    if (result.success) { onOpenChange(false); onSuccess(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Catégoriser {docIds.length} document{docIds.length > 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>Attribuer une catégorie à tous les documents sélectionnés</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <NativeSelect options={CATEGORIES_OPTIONS} value={category} onChange={e => setCategory(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleApply} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DataroomPickerDialog({ open, onOpenChange, document, societyId, datarooms, onAdded }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  document: DocumentItem; societyId: string;
  datarooms: { id: string; name: string }[]; onAdded: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/datarooms/${selected}/documents`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: document.id, societyId }),
    });
    setSaving(false);
    onOpenChange(false); onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajouter à une dataroom</DialogTitle>
          <DialogDescription>Sélectionner la dataroom cible</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <NativeSelect
            options={[{ value: "", label: "Choisir une dataroom…" }, ...datarooms.map(d => ({ value: d.id, label: d.name }))]}
            value={selected ?? ""} onChange={e => setSelected(e.target.value || null)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleAdd} disabled={!selected || saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkDataroomPickerDialog({ open, onOpenChange, docIds, societyId, datarooms, onAdded }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  docIds: string[]; societyId: string;
  datarooms: { id: string; name: string }[]; onAdded: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!selected) return;
    setSaving(true);
    await Promise.all(docIds.map(docId =>
      fetch(`/api/datarooms/${selected}/documents`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId, societyId }),
      })
    ));
    setSaving(false); onOpenChange(false); onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajouter {docIds.length} document{docIds.length > 1 ? "s" : ""} à une dataroom</DialogTitle>
          <DialogDescription>Sélectionner la dataroom cible</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <NativeSelect
            options={[{ value: "", label: "Choisir une dataroom…" }, ...datarooms.map(d => ({ value: d.id, label: d.name }))]}
            value={selected ?? ""} onChange={e => setSelected(e.target.value || null)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleAdd} disabled={!selected || saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailsPanel({ doc, societyId, datarooms, onClose, onRefresh }: {
  doc: DocumentItem; societyId: string;
  datarooms: { id: string; name: string }[];
  onClose: () => void; onRefresh: () => void;
}) {
  const [tab, setTab] = useState<"preview" | "versions" | "ai" | "chat" | "info" | "edit">("preview");
  const [fullscreen, setFullscreen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dataroomOpen, setDataroomOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Supprimer ce document ?")) return;
    setDeleting(true);
    await deleteDocument(societyId, doc.id);
    setDeleting(false);
    onRefresh(); onClose();
  };

  const tabs = [
    { key: "preview", label: "Aperçu" },
    { key: "versions", label: "Versions", badge: doc.versions.length > 0 ? String(doc.versions.length + 1) : undefined },
    { key: "ai", label: "IA" },
    { key: "chat", label: "Chat" },
    { key: "info", label: "Infos" },
    { key: "edit", label: "Éditer" },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileTypeIcon mimeType={doc.mimeType} className="flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{doc.fileName}</p>
            {doc.userTags && doc.userTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {doc.userTags.slice(0, 5).map(tag => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={onClose} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex border-b flex-shrink-0 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("px-3 py-2 text-xs font-medium whitespace-nowrap flex items-center gap-1 border-b-2 transition-colors",
              tab === t.key ? "border-[var(--color-brand-blue)] text-[var(--color-brand-blue)]" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
            {("badge" in t && t.badge) ? <span className="text-[10px] px-1 py-0.5 rounded-full bg-blue-100 text-blue-700">{String((t as {badge?: string}).badge)}</span> : null}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === "preview" && (
          <div className="relative h-full">
            <button onClick={() => setFullscreen(true)} className="absolute top-2 right-2 z-10 p-1 bg-background/80 rounded border hover:bg-muted">
              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <PreviewContent doc={doc} />
          </div>
        )}
        {tab === "versions" && <VersionsTab doc={doc} societyId={societyId} onRefresh={onRefresh} />}
        {tab === "ai" && (
          <div className="p-4 space-y-3">
            {doc.aiStatus === "done" && doc.aiTags && doc.aiTags.length > 0 ? (
              <>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags IA</p>
                <div className="flex flex-wrap gap-1.5">
                  {doc.aiTags.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">{t}</span>)}
                </div>
                {doc.aiSummary && <><p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Résumé</p><p className="text-sm">{doc.aiSummary}</p></>}
                {doc.aiCategory && <><p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Catégorie suggérée</p><p className="text-sm">{doc.aiCategory}</p></>}
              </>
            ) : doc.aiStatus === "pending" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analyse en cours…</div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune analyse IA disponible pour ce document.</p>
            )}
          </div>
        )}
        {tab === "chat" && <div className="p-4"><p className="text-sm text-muted-foreground">Assistant IA bientôt disponible.</p></div>}
        {tab === "info" && (
          <div className="p-4 space-y-2 text-sm">
            <InfoRow label="Catégorie" value={getCategoryLabel(doc.category)} />
            <InfoRow label="Immeuble" value={doc.building?.name ?? "—"} />
            <InfoRow label="Lot" value={doc.lot?.number ?? "—"} />
            <InfoRow label="Locataire" value={getTenantLabel(doc) ?? "—"} />
            <InfoRow label="Taille" value={doc.fileSize ? formatFileSize(doc.fileSize) : "—"} />
            <InfoRow label="Expiration" value={doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString("fr-FR") : "—"} />
            <InfoRow label="Ajouté le" value={new Date(doc.createdAt).toLocaleDateString("fr-FR")} />
            {doc.userTags && doc.userTags.length > 0 && (
              <div className="flex items-start gap-2 py-1">
                <span className="text-muted-foreground w-28 flex-shrink-0">Tags</span>
                <div className="flex flex-wrap gap-1">{doc.userTags.map(tag => <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full bg-muted border border-border">{tag}</span>)}</div>
              </div>
            )}
          </div>
        )}
        {tab === "edit" && <EditForm doc={doc} societyId={societyId} onSuccess={onRefresh} />}
      </div>
      <div className="flex items-center gap-2 px-4 py-2 border-t flex-shrink-0 flex-wrap">
        <a href={doc.fileUrl} download={doc.fileName} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
          <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs"><Download className="h-3 w-3" />Télécharger</Button>
        </a>
        {datarooms.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setDataroomOpen(true)}>
            <Database className="h-3 w-3" />Dataroom
          </Button>
        )}
        <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive ml-auto"
          onClick={handleDelete} disabled={deleting}>
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}Supprimer
        </Button>
      </div>

      {fullscreen && <FullscreenPreviewDialog doc={doc} open={fullscreen} onClose={() => setFullscreen(false)} />}
      {dataroomOpen && (
        <DataroomPickerDialog open={dataroomOpen} onOpenChange={setDataroomOpen}
          document={doc} societyId={societyId} datarooms={datarooms} onAdded={onRefresh} />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-muted-foreground w-28 flex-shrink-0 text-xs">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export function DocumentsClient({ initialDocuments, societyId, datarooms, buildingId: initBuildingId, lotId: _initLotId, leaseId: _initLeaseId, tenantId: _initTenantId }: {
  initialDocuments: DocumentItem[];
  societyId: string;
  datarooms: { id: string; name: string }[];
  buildingId?: string; lotId?: string; leaseId?: string; tenantId?: string;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [building, setBuilding] = useState(initBuildingId ?? "all");
  const [category, setCategory] = useState("all");
  const [expirationFilter, setExpirationFilter] = useState<ExpirationFilter>("all");
  const [tagFilter, setTagFilter] = useState("");
  const [bulkRecatOpen, setBulkRecatOpen] = useState(false);
  const [bulkDataroomOpen, setBulkDataroomOpen] = useState(false);

  const tree = useMemo(() => buildTree(documents), [documents]);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/documents?societyId=${societyId}`).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data?.data)) setDocuments(data.data);
      else if (Array.isArray(data)) setDocuments(data);
    }
  }, [societyId]);
  const handleSort = useCallback((key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }, [sortKey]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  const selectAll = useCallback((docs: DocumentItem[]) => {
    setSelectedIds(new Set(docs.map(d => d.id)));
  }, []);

  const sorted = useMemo(() => {
    const filtered = documents.filter(d => {
      if (building !== "all" && building !== "general") {
        if (getBuildingKey(d) !== building) return false;
      }
      if (building === "general" && d.buildingId) return false;
      if (category !== "all" && d.category !== category) return false;
      if (expirationFilter === "expired" && !isExpired(d.expiresAt)) return false;
      if (expirationFilter === "expiring" && !isExpiringSoon(d.expiresAt)) return false;
      if (tagFilter && !(d.userTags ?? []).includes(tagFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const inName = d.fileName.toLowerCase().includes(q);
        const inDesc = d.description?.toLowerCase().includes(q) ?? false;
        const inTags = (d.userTags ?? []).some(t => t.includes(q));
        const inFull = d.fullText?.toLowerCase().includes(q) ?? false;
        if (!inName && !inDesc && !inTags && !inFull) return false;
      }
      return true;
    });
    filtered.sort((a, b) => {
      let v = 0;
      if (sortKey === "fileName") v = a.fileName.localeCompare(b.fileName);
      else if (sortKey === "fileSize") v = (a.fileSize ?? 0) - (b.fileSize ?? 0);
      else if (sortKey === "expiresAt") v = (a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity) - (b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity);
      else v = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? v : -v;
    });
    return filtered;
  }, [documents, building, category, search, sortKey, sortDir, expirationFilter, tagFilter]);
  const handleBulkDelete = async () => {
    if (!confirm(`Supprimer ${selectedIds.size} document(s) ?`)) return;
    await Promise.all([...selectedIds].map(id => deleteDocument(societyId, id)));
    setSelectedIds(new Set());
    await refresh();
  };

  const handleBulkDownload = () => {
    const ids = [...selectedIds];
    const docs = ids.map(id => findDocumentById(documents, id)).filter(Boolean) as DocumentItem[];
    docs.forEach(d => { const a = document.createElement("a"); a.href = d.fileUrl; a.download = d.fileName; a.click(); });
  };

  const exportCsv = () => {
    const header = ["Nom", "Catégorie", "Immeuble", "Lot", "Locataire", "Taille", "Expiration", "Ajouté le", "Tags"];
    const rows = sorted.map(d => [
      d.fileName, getCategoryLabel(d.category),
      d.building?.name ?? "", d.lot?.number ?? "", getTenantLabel(d),
      d.fileSize ? formatFileSize(d.fileSize) : "",
      d.expiresAt ? new Date(d.expiresAt).toLocaleDateString("fr-FR") : "",
      new Date(d.createdAt).toLocaleDateString("fr-FR"),
      (d.userTags ?? []).join(", "),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "documents.csv"; a.click();
  };
  const allSelected = sorted.length > 0 && sorted.every(d => selectedIds.has(d.id));

  return (
    <div className="flex h-full gap-0">
      <TreeSidebar tree={tree} selected={building} onSelect={setBuilding}
        expirationFilter={expirationFilter} onExpirationFilter={setExpirationFilter}
        tagFilter={tagFilter} onTagFilter={setTagFilter} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher dans les documents…" className="pl-8 h-8 text-sm" />
          </div>
          <NativeSelect options={[{ value: "all", label: "Toutes catégories" }, ...CATEGORIES_OPTIONS]}
            value={category} onChange={e => setCategory(e.target.value)} className="w-44 h-8 text-sm" />
          <div className="flex items-center gap-1">
            <Button size="icon" variant={viewMode === "list" ? "secondary" : "ghost"} className="h-8 w-8" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
            <Button size="icon" variant={viewMode === "grid" ? "secondary" : "ghost"} className="h-8 w-8" onClick={() => setViewMode("grid")}><Grid3X3 className="h-4 w-4" /></Button>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5 h-8 text-xs hidden sm:flex"><FileDown className="h-3.5 w-3.5" />CSV</Button>
        </div>
        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b text-sm flex-wrap">
            <span className="font-medium text-blue-800">{selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}</span>
            <Button size="sm" variant="outline" onClick={() => setBulkRecatOpen(true)} className="h-7 text-xs gap-1"><Tag className="h-3 w-3" />Catégoriser</Button>
            <Button size="sm" variant="outline" onClick={handleBulkDownload} className="h-7 text-xs gap-1"><Download className="h-3 w-3" />Télécharger</Button>
            {datarooms.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setBulkDataroomOpen(true)} className="h-7 text-xs gap-1"><Database className="h-3 w-3" />Dataroom</Button>
            )}
            <Button size="sm" variant="outline" onClick={handleBulkDelete} className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"><Trash2 className="h-3 w-3" />Supprimer</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="h-7 text-xs ml-auto">Désélectionner</Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">Aucun document trouvé</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sorted.map(doc => (
                <FileGridCard key={doc.id} doc={doc} selected={selectedIds.has(doc.id)}
                  onSelect={toggleSelect} onOpen={setActiveDoc} />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background z-10 border-b">
                <tr>
                  <th className="w-8 px-3 py-2.5">
                    <Checkbox checked={allSelected} onCheckedChange={() => allSelected ? setSelectedIds(new Set()) : selectAll(sorted)} />
                  </th>
                  <th className="py-2.5 pr-3 text-left"><SortHeader label="Nom" sortKey="fileName" current={sortKey} dir={sortDir} onSort={handleSort} /></th>
                  <th className="py-2.5 pr-3 text-left hidden md:table-cell"><span className="text-xs font-medium text-muted-foreground">Catégorie</span></th>
                  <th className="py-2.5 pr-3 text-left hidden lg:table-cell"><span className="text-xs font-medium text-muted-foreground">Immeuble</span></th>
                  <th className="py-2.5 pr-3 text-left hidden xl:table-cell"><SortHeader label="Taille" sortKey="fileSize" current={sortKey} dir={sortDir} onSort={handleSort} /></th>
                  <th className="py-2.5 pr-3 text-left"><SortHeader label="Expiration" sortKey="expiresAt" current={sortKey} dir={sortDir} onSort={handleSort} /></th>
                  <th className="py-2.5 pr-3 text-left hidden sm:table-cell"><SortHeader label="Ajouté" sortKey="createdAt" current={sortKey} dir={sortDir} onSort={handleSort} /></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(doc => (
                  <FileRow key={doc.id} doc={doc} selected={selectedIds.has(doc.id)}
                    onSelect={toggleSelect} onOpen={setActiveDoc} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {activeDoc && (
        <div className="w-[360px] flex-shrink-0 border-l flex flex-col overflow-hidden">
          <DetailsPanel
            doc={findDocumentById(documents, activeDoc.id) ?? activeDoc}
            societyId={societyId}
            datarooms={datarooms}
            onClose={() => setActiveDoc(null)}
            onRefresh={async () => { await refresh(); if (activeDoc) { const updated = findDocumentById(documents, activeDoc.id); if (updated) setActiveDoc(updated); } }}
          />
        </div>
      )}

      {bulkRecatOpen && (
        <BulkRecategorizeDialog open={bulkRecatOpen} onOpenChange={setBulkRecatOpen}
          docIds={[...selectedIds]} societyId={societyId}
          onSuccess={async () => { setSelectedIds(new Set()); await refresh(); }} />
      )}

      {bulkDataroomOpen && (
        <BulkDataroomPickerDialog open={bulkDataroomOpen} onOpenChange={setBulkDataroomOpen}
          docIds={[...selectedIds]} societyId={societyId} datarooms={datarooms}
          onAdded={async () => { setSelectedIds(new Set()); await refresh(); }} />
      )}
    </div>
  );
}
