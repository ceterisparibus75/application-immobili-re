"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { getChecklistScore, getDataroomTemplate, PERMISSION_LABELS, type DataroomChecklistItem, type DataroomGroupPreset } from "@/lib/dataroom-templates";
import {
  ArrowLeft, Share2, FileText, Eye, Trash2, Lock, Calendar,
  Plus, Copy, Check, Archive, Send, ExternalLink, ChevronUp, ChevronDown, Mail, User, ShieldCheck, ListChecks, Users,
} from "lucide-react";
import {
  updateDataroom, deleteDataroom, activateDataroom, archiveDataroom,
  addDocumentToDataroom, removeDocumentFromDataroom, reorderDocument,
} from "@/actions/dataroom";

const PURPOSE_OPTIONS = [
  { value: "VENTE", label: "Vente" },
  { value: "AUDIT", label: "Audit" },
  { value: "FINANCEMENT", label: "Financement" },
  { value: "DUE_DILIGENCE", label: "Due diligence" },
  { value: "AUTRE", label: "Autre" },
];

const NO_PURPOSE_VALUE = "__NO_PURPOSE__";

function getPurposeLabel(value: string | null): string {
  if (!value) return "";
  return PURPOSE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

type DataroomFull = {
  id: string;
  name: string;
  description: string | null;
  purpose: string | null;
  status: string;
  shareToken: string | null;
  password: string | null;
  expiresAt: Date | null;
  accessCount: number;
  lastAccessedAt: Date | null;
  createdAt: Date;
  createdBy: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  templateKey: string | null;
  accessMode: string;
  allowDownload: boolean;
  allowPrint: boolean;
  watermarkEnabled: boolean;
  ndaRequired: boolean;
  groups: unknown;
  checklist: unknown;
  creator: { name: string | null; email: string | null } | null;
  documents: {
    id: string;
    sortOrder: number;
    section: string | null;
    document: {
      id: string;
      fileName: string;
      fileUrl: string;
      fileSize: number | null;
      mimeType: string | null;
      category: string | null;
      createdAt: Date;
    };
  }[];
  accesses: {
    id: string;
    createdAt: Date;
    viewerName: string | null;
    viewerEmail: string | null;
    ipAddress: string | null;
  }[];
  _count: { documents: number; accesses: number };
};

type AllDoc = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  category: string | null;
  createdAt: Date;
  [key: string]: unknown;
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    BROUILLON: { label: "Brouillon", variant: "secondary" },
    ACTIF: { label: "Actif", variant: "default" },
    ARCHIVE: { label: "Archivé", variant: "outline" },
  };
  const c = config[status] ?? { label: status, variant: "outline" };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function readGroups(value: unknown, templateKey: string | null): DataroomGroupPreset[] {
  if (Array.isArray(value)) return value as DataroomGroupPreset[];
  return getDataroomTemplate(templateKey).groups;
}

function readChecklist(value: unknown, templateKey: string | null): DataroomChecklistItem[] {
  if (Array.isArray(value)) return value as DataroomChecklistItem[];
  return getDataroomTemplate(templateKey).checklist;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

export function DataroomDetail({ societyId, dataroom, allDocuments }: { societyId: string; dataroom: DataroomFull; allDocuments: AllDoc[] }) {
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addDocOpen, setAddDocOpen] = useState(false);

  const [editName, setEditName] = useState(dataroom.name);
  const [editDesc, setEditDesc] = useState(dataroom.description ?? "");
  const [editPurpose, setEditPurpose] = useState(dataroom.purpose ?? NO_PURPOSE_VALUE);
  const [editPassword, setEditPassword] = useState("");
  const [editExpires, setEditExpires] = useState(dataroom.expiresAt ? new Date(dataroom.expiresAt).toISOString().split("T")[0] : "");
  const [editRecipientEmail, setEditRecipientEmail] = useState(dataroom.recipientEmail ?? "");
  const [editRecipientName, setEditRecipientName] = useState(dataroom.recipientName ?? "");
  const [editAccessMode, setEditAccessMode] = useState<"LINK" | "EMAIL_REQUIRED">(dataroom.accessMode === "EMAIL_REQUIRED" ? "EMAIL_REQUIRED" : "LINK");
  const [editAllowDownload, setEditAllowDownload] = useState(dataroom.allowDownload);
  const [editAllowPrint, setEditAllowPrint] = useState(dataroom.allowPrint);
  const [editWatermarkEnabled, setEditWatermarkEnabled] = useState(dataroom.watermarkEnabled);
  const [editNdaRequired, setEditNdaRequired] = useState(dataroom.ndaRequired);
  const [detailChecklist, setDetailChecklist] = useState<DataroomChecklistItem[]>(readChecklist(dataroom.checklist, dataroom.templateKey));

  const [selectedDocId, setSelectedDocId] = useState("");

  const existingDocIds = new Set(dataroom.documents.map((d) => d.document.id));
  const availableDocs = allDocuments.filter((d) => !existingDocIds.has(d.id));

  const shareUrl = dataroom.shareToken ? (typeof window !== "undefined" ? window.location.origin : "") + "/dataroom/share/" + dataroom.shareToken : null;
  const groups = readGroups(dataroom.groups, dataroom.templateKey);
  const template = getDataroomTemplate(dataroom.templateKey);
  const checklistScore = getChecklistScore(detailChecklist);

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Lien copié");
  }

  function handleUpdate() {
    startTransition(async () => {
      const result = await updateDataroom(societyId, dataroom.id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        purpose: editPurpose === NO_PURPOSE_VALUE ? null : (editPurpose as "VENTE" | "AUDIT" | "FINANCEMENT" | "DUE_DILIGENCE" | "AUTRE"),
        password: editPassword || null,
        expiresAt: editExpires || null,
        recipientEmail: editRecipientEmail.trim() || null,
        recipientName: editRecipientName.trim() || null,
        accessMode: editAccessMode,
        allowDownload: editAllowDownload,
        allowPrint: editAllowPrint,
        watermarkEnabled: editWatermarkEnabled,
        ndaRequired: editNdaRequired,
      });
      if (result.success) {
        toast.success("Dataroom mise à jour");
        setEditOpen(false);
        setEditPassword("");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleChecklistToggle(itemId: string) {
    const next = detailChecklist.map((item) => item.id === itemId ? { ...item, done: !item.done } : item);
    setDetailChecklist(next);
    startTransition(async () => {
      const result = await updateDataroom(societyId, dataroom.id, { checklist: next });
      if (!result.success) toast.error(result.error ?? "Erreur");
    });
  }

  function handleActivate() {
    startTransition(async () => {
      const result = await activateDataroom(societyId, dataroom.id);
      if (result.success) {
        toast.success("Dataroom activée — le lien de partage est maintenant disponible");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleArchive() {
    if (!confirm("Archiver cette dataroom ? Le lien de partage sera désactivé.")) return;
    startTransition(async () => {
      const result = await archiveDataroom(societyId, dataroom.id);
      if (result.success) {
        toast.success("Dataroom archivée");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Supprimer définitivement cette dataroom ?")) return;
    startTransition(async () => {
      const result = await deleteDataroom(societyId, dataroom.id);
      if (result.success) {
        toast.success("Dataroom supprimée");
        router.push("/dataroom");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleAddDoc() {
    if (!selectedDocId) return;
    startTransition(async () => {
      const result = await addDocumentToDataroom(societyId, dataroom.id, selectedDocId);
      if (result.success) {
        toast.success("Document ajouté");
        setAddDocOpen(false);
        setSelectedDocId("");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleRemoveDoc(documentId: string) {
    if (!confirm("Retirer ce document de la dataroom ?")) return;
    startTransition(async () => {
      const result = await removeDocumentFromDataroom(societyId, dataroom.id, documentId);
      if (result.success) {
        toast.success("Document retiré");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleReorder(documentId: string, direction: "up" | "down") {
    startTransition(async () => {
      const result = await reorderDocument(societyId, dataroom.id, documentId, direction);
      if (!result.success) toast.error(result.error ?? "Erreur");
    });
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/dataroom">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight truncate">{dataroom.name}</h1>
            <StatusBadge status={dataroom.status} />
          </div>
          {dataroom.description && <p className="text-sm text-muted-foreground mt-1">{dataroom.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Modifier</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Modifier la dataroom</DialogTitle>
                <DialogDescription>Mettez à jour les informations de la dataroom.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nom *</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
                </div>
                <div>
                  <Label>Objectif</Label>
                  <Select value={editPurpose} onValueChange={setEditPurpose}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un objectif..." />
                    </SelectTrigger>
                  <SelectContent>
                      <SelectItem value={NO_PURPOSE_VALUE}>Aucun</SelectItem>
                      {PURPOSE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Email destinataire</Label>
                    <Input
                      type="email"
                      value={editRecipientEmail}
                      onChange={(e) => setEditRecipientEmail(e.target.value)}
                      placeholder="contact@exemple.com"
                    />
                  </div>
                  <div>
                    <Label>Nom destinataire</Label>
                    <Input
                      value={editRecipientName}
                      onChange={(e) => setEditRecipientName(e.target.value)}
                      placeholder="Jean Dupont"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Le destinataire reçoit un email à chaque ajout de document.
                </p>
                <div>
                  <Label>Mot de passe</Label>
                  <Input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder={dataroom.password ? "Laisser vide pour conserver" : "Laisser vide pour aucun"}
                  />
                </div>
                <div>
                  <Label>Date d'expiration</Label>
                  <Input type="date" value={editExpires} onChange={(e) => setEditExpires(e.target.value)} />
                </div>
                <div>
                  <Label>Mode d'accès</Label>
                  <Select value={editAccessMode} onValueChange={(value) => setEditAccessMode(value as "LINK" | "EMAIL_REQUIRED")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LINK">Lien simple</SelectItem>
                      <SelectItem value="EMAIL_REQUIRED">Email visiteur obligatoire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { label: "Téléchargement autorisé", checked: editAllowDownload, onChange: setEditAllowDownload },
                    { label: "Impression autorisée", checked: editAllowPrint, onChange: setEditAllowPrint },
                    { label: "Filigrane dynamique", checked: editWatermarkEnabled, onChange: setEditWatermarkEnabled },
                    { label: "Confidentialité à accepter", checked: editNdaRequired, onChange: setEditNdaRequired },
                  ].map((option) => (
                    <label key={option.label} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <Checkbox checked={option.checked} onCheckedChange={(checked) => option.onChange(checked === true)} />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
                <Button onClick={handleUpdate} disabled={pending}>Enregistrer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {dataroom.status === "BROUILLON" && (
            <Button size="sm" onClick={handleActivate} disabled={pending}>
              <Send className="h-4 w-4 mr-1" />Activer
            </Button>
          )}
          {dataroom.status === "ACTIF" && (
            <Button variant="outline" size="sm" onClick={handleArchive} disabled={pending}>
              <Archive className="h-4 w-4 mr-1" />Archiver
            </Button>
          )}
          {(dataroom.status === "BROUILLON" || dataroom.status === "ARCHIVE") && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={pending}>
              <Trash2 className="h-4 w-4 mr-1" />Supprimer
            </Button>
          )}
        </div>
      </div>

      {/* Stats + Lien de partage */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{dataroom._count.documents}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Eye className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{dataroom.accessCount}</p>
                <p className="text-xs text-muted-foreground">Accès total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            {shareUrl ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Lien de partage</p>
                <div className="flex gap-1">
                  <Input value={shareUrl} readOnly className="text-xs h-8" />
                  <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={copyLink}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="h-8 shrink-0">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Share2 className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Pas encore activée</p>
                  <p className="text-xs text-muted-foreground">Activez pour générer le lien</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" />
              Préparation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{template.label}</span>
                <span className="font-semibold">{checklistScore}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${checklistScore}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              {detailChecklist.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune checklist sur ce modèle.</p>
              ) : (
                detailChecklist.slice(0, 6).map((item) => (
                  <label key={item.id} className="flex items-start gap-2 text-sm">
                    <Checkbox checked={item.done === true} onCheckedChange={() => handleChecklistToggle(item.id)} disabled={pending} />
                    <span className={item.done ? "text-muted-foreground line-through" : ""}>
                      {item.label}
                      <span className="ml-1 text-xs text-muted-foreground">· {item.section}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Accès</span>
              <Badge variant="outline">{dataroom.accessMode === "EMAIL_REQUIRED" ? "Email requis" : "Lien simple"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Téléchargement</span>
              <Badge variant={dataroom.allowDownload ? "default" : "secondary"}>{dataroom.allowDownload ? "Autorisé" : "Bloqué"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Impression</span>
              <Badge variant={dataroom.allowPrint ? "default" : "secondary"}>{dataroom.allowPrint ? "Autorisée" : "Bloquée"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Filigrane</span>
              <Badge variant={dataroom.watermarkEnabled ? "default" : "secondary"}>{dataroom.watermarkEnabled ? "Actif" : "Inactif"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Confidentialité</span>
              <Badge variant={dataroom.ndaRequired ? "default" : "secondary"}>{dataroom.ndaRequired ? "Acceptation requise" : "Simple"}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Groupes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{group.name}</span>
                <Badge variant="outline" className="shrink-0">{PERMISSION_LABELS[group.permission]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Destinataire externe */}
      {(dataroom.recipientEmail || dataroom.recipientName) && (
        <Card>
          <CardContent className="pt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4 shrink-0" />
              <span>{dataroom.recipientName ?? "Destinataire"}</span>
            </div>
            {dataroom.recipientEmail && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span>{dataroom.recipientEmail}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground ml-auto">Notifié à chaque ajout de document</p>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Documents</CardTitle>
          <Dialog open={addDocOpen} onOpenChange={setAddDocOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Ajouter un document</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un document</DialogTitle>
                <DialogDescription>Sélectionnez un document de la GED à ajouter à cette dataroom.</DialogDescription>
              </DialogHeader>
              <div>
                <Label>Document</Label>
                <Select value={selectedDocId} onValueChange={setSelectedDocId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un document..." /></SelectTrigger>
                  <SelectContent>
                    {availableDocs.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.fileName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableDocs.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">Tous les documents sont déjà dans cette dataroom.</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDocOpen(false)}>Annuler</Button>
                <Button onClick={handleAddDoc} disabled={pending || !selectedDocId}>Ajouter</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {dataroom.documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucun document dans cette dataroom</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
                  <TableHead className="hidden md:table-cell">Taille</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataroom.documents.map((dd, i) => (
                  <TableRow key={dd.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{dd.document.fileName}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{dd.document.category ?? "Autre"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{formatFileSize(dd.document.fileSize ?? 0)}</TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => handleReorder(dd.document.id, "up")}
                          disabled={pending || i === 0}
                          title="Monter"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => handleReorder(dd.document.id, "down")}
                          disabled={pending || i === dataroom.documents.length - 1}
                          title="Descendre"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <a href={dd.document.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Ouvrir">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => handleRemoveDoc(dd.document.id)}
                          disabled={pending}
                          title="Retirer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Historique des accès */}
      {dataroom.accesses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historique des accès</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Visiteur</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataroom.accesses.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{formatDate(a.createdAt)}</TableCell>
                    <TableCell className="text-xs">{a.viewerName ?? "Anonyme"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs">{a.viewerEmail ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-mono">{a.ipAddress ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Informations */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>Créée le {formatDate(dataroom.createdAt)}</span>
          {dataroom.creator && <span>Par {dataroom.creator.name ?? dataroom.creator.email}</span>}
          {dataroom.purpose && <span>Objectif : {getPurposeLabel(dataroom.purpose)}</span>}
          {dataroom.password && (
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" />Protégée par mot de passe</span>
          )}
          {dataroom.expiresAt && (
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Expire le {formatDate(dataroom.expiresAt)}</span>
          )}
          {dataroom.lastAccessedAt && (
            <span>Dernier accès : {formatDate(dataroom.lastAccessedAt)}</span>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
