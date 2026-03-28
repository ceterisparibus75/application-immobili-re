"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft, Share2, FileText, Eye, Trash2, Lock, Calendar,
  Plus, Copy, Check, Archive, Send, ExternalLink,
} from "lucide-react";
import {
  updateDataroom, deleteDataroom, activateDataroom, archiveDataroom,
  addDocumentToDataroom, removeDocumentFromDataroom,
} from "@/actions/dataroom";

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
    visitorName: string | null;
    visitorEmail: string | null;
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
    ARCHIVE: { label: "Archive", variant: "outline" },
  };
  const c = config[status] ?? { label: status, variant: "outline" };
  return <Badge variant={c.variant}>{c.label}</Badge>;
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
  const [editPurpose, setEditPurpose] = useState(dataroom.purpose ?? "");
  const [editPassword, setEditPassword] = useState(dataroom.password ?? "");
  const [editExpires, setEditExpires] = useState(dataroom.expiresAt ? new Date(dataroom.expiresAt).toISOString().split("T")[0] : "");
  const [selectedDocId, setSelectedDocId] = useState("");

  const existingDocIds = new Set(dataroom.documents.map((d) => d.document.id));
  const availableDocs = allDocuments.filter((d) => !existingDocIds.has(d.id));

  const shareUrl = dataroom.shareToken ? (typeof window !== "undefined" ? window.location.origin : "") + "/dataroom/share/" + dataroom.shareToken : null;

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Lien de partage copie");
  }

  function handleUpdate() {
    startTransition(async () => {
      const result = await updateDataroom(societyId, dataroom.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        purpose: (editPurpose.trim() || undefined) as "VENTE" | "AUDIT" | "FINANCEMENT" | "DUE_DILIGENCE" | "AUTRE" | undefined,
        password: editPassword.trim() || undefined,
        expiresAt: editExpires || undefined,
      });
      if (result.success) {
        toast.success("Dataroom mise a jour");
        setEditOpen(false);
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleActivate() {
    startTransition(async () => {
      const result = await activateDataroom(societyId, dataroom.id);
      if (result.success) {
        toast.success("Dataroom activee");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleArchive() {
    if (!confirm("Archiver cette dataroom ? Le lien de partage sera desactive.")) return;
    startTransition(async () => {
      const result = await archiveDataroom(societyId, dataroom.id);
      if (result.success) {
        toast.success("Dataroom archivee");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Supprimer definitivement cette dataroom ?")) return;
    startTransition(async () => {
      const result = await deleteDataroom(societyId, dataroom.id);
      if (result.success) {
        toast.success("Dataroom supprimee");
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
        toast.success("Document ajoute");
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
        toast.success("Document retire");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  return (
    <div className="space-y-6">
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifier la dataroom</DialogTitle>
                <DialogDescription>Mettez a jour les informations de la dataroom.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>Nom *</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
                <div><Label>Description</Label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} /></div>
                <div><Label>Objectif</Label><Input value={editPurpose} onChange={(e) => setEditPurpose(e.target.value)} /></div>
                <div><Label>Mot de passe</Label><Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Laisser vide pour aucun" /></div>
                <div><Label>Date expiration</Label><Input type="date" value={editExpires} onChange={(e) => setEditExpires(e.target.value)} /></div>
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

      {/* Stats + Share */}
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
                <p className="text-xs text-muted-foreground">Acces total</p>
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
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Share2 className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Pas encore active</p>
                  <p className="text-xs text-muted-foreground">Activez pour generer le lien</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                <DialogDescription>Selectionnez un document de la GED a ajouter.</DialogDescription>
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
                {availableDocs.length === 0 && <p className="text-xs text-muted-foreground mt-2">Tous les documents sont deja dans cette dataroom.</p>}
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
                  <TableHead className="hidden sm:table-cell">Categorie</TableHead>
                  <TableHead className="hidden md:table-cell">Taille</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
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
                      <div className="flex gap-1">
                        <a href={dd.document.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
                        </a>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveDoc(dd.document.id)} disabled={pending}>
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

      {/* Access Log */}
      {dataroom.accesses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historique des acces</CardTitle>
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
                    <TableCell className="text-xs">{a.visitorName ?? "Anonyme"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs">{a.visitorEmail ?? "-"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-mono">{a.ipAddress ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Info card */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>Cree le {formatDate(dataroom.createdAt)}</span>
          {dataroom.creator && <span>Par {dataroom.creator.name ?? dataroom.creator.email}</span>}
          {dataroom.purpose && <span>Objectif : {dataroom.purpose}</span>}
          {dataroom.password && <span className="flex items-center gap-1"><Lock className="h-3 w-3" />Protege par mot de passe</span>}
          {dataroom.expiresAt && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Expire le {formatDate(dataroom.expiresAt)}</span>}
          {dataroom.lastAccessedAt && <span>Dernier acces : {formatDate(dataroom.lastAccessedAt)}</span>}
        </CardContent>
      </Card>
    </div>
  );
}
