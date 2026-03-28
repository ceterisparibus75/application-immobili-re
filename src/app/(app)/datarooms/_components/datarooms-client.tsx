"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FolderLock, Plus, ExternalLink, Trash2, Eye, FileText,
  Clock, CheckCircle2, XCircle, Copy, Check, Loader2, Lock,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { createDataroom, deleteDataroom } from "@/actions/dataroom";
import { toast } from "sonner";

type DataroomItem = {
  id: string;
  name: string;
  description: string | null;
  token: string;
  isActive: boolean;
  expiresAt: Date | null;
  viewCount: number;
  createdAt: Date;
  passwordHash: string | null;
  _count: { documents: number; accesses: number };
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function StatusBadge({ dataroom }: { dataroom: DataroomItem }) {
  const expired = dataroom.expiresAt && new Date(dataroom.expiresAt) < new Date();
  if (!dataroom.isActive) return <Badge variant="secondary" className="text-xs gap-1"><XCircle className="h-3 w-3" />Désactivée</Badge>;
  if (expired) return <Badge variant="destructive" className="text-xs gap-1"><Clock className="h-3 w-3" />Expirée</Badge>;
  return (
    <div className="flex items-center gap-1.5">
      <Badge className="text-xs gap-1 bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3" />Active</Badge>
      {dataroom.passwordHash && <Badge variant="outline" className="text-xs gap-1"><Lock className="h-3 w-3" />Protégée</Badge>}
    </div>
  );
}

export function DataroomsClient({
  societyId,
  datarooms: initialDatarooms,
}: {
  societyId: string;
  datarooms: DataroomItem[];
}) {
  const [datarooms, setDatarooms] = useState(initialDatarooms);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    const result = await createDataroom(societyId, {
      name,
      description: description || null,
      expiresAt: expiresAt || null,
      recipientEmail: recipientEmail || null,
      recipientName: recipientName || null,
    });
    setSaving(false);
    if (result.success) {
      toast.success("Dataroom créée");
      setCreateOpen(false);
      setName(""); setDescription(""); setExpiresAt(""); setRecipientEmail(""); setRecipientName("");
      // Refresh — router.refresh() is better but requires useRouter
      window.location.reload();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteDataroom(societyId, deleteId);
    setDeleting(false);
    setDeleteId(null);
    if (result.success) {
      toast.success("Dataroom supprimée");
      setDatarooms((prev) => prev.filter((d) => d.id !== deleteId));
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />Nouvelle dataroom
        </Button>
      </div>

      {datarooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center border rounded-lg py-20 text-center bg-muted/10">
          <FolderLock className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium mb-1">Aucune dataroom</p>
          <p className="text-xs text-muted-foreground mb-4">Créez une dataroom pour partager des documents avec vos partenaires</p>
          <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" />Créer une dataroom</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datarooms.map((dr) => {
            const publicUrl = `${origin}/dataroom/${dr.token}`;
            return (
              <div key={dr.id} className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FolderLock className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold text-sm truncate">{dr.name}</span>
                    </div>
                    {dr.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{dr.description}</p>}
                  </div>
                  <StatusBadge dataroom={dr} />
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{dr._count.documents} doc{dr._count.documents !== 1 ? "s" : ""}</span>
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{dr.viewCount} vue{dr.viewCount !== 1 ? "s" : ""}</span>
                  {dr.expiresAt && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Expire {formatDate(dr.expiresAt)}</span>}
                </div>

                <div className="flex items-center gap-1 rounded bg-muted/50 px-2 py-1.5 text-xs font-mono text-muted-foreground min-w-0">
                  <span className="flex-1 truncate">{publicUrl}</span>
                  <CopyButton text={publicUrl} />
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground ml-1">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="flex gap-2 pt-1">
                  <Link href={`/datarooms/${dr.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs">Gérer</Button>
                  </Link>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteId(dr.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground/60">Créée le {formatDate(dr.createdAt)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog création */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FolderLock className="h-5 w-5" />Nouvelle dataroom</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Due diligence Immeuble Voltaire" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Documents pour la cession…" rows={3} className="resize-none text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>{"Date d'expiration"}</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              <p className="text-xs text-muted-foreground">Laisser vide pour un accès sans limite de durée</p>
            </div>
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bénéficiaire (notifications)</p>
              <div className="space-y-1.5">
                <Label className="text-sm">Email du bénéficiaire</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="partenaire@exemple.com"
                />
                <p className="text-xs text-muted-foreground">Il recevra un email à chaque ajout de document.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Nom du bénéficiaire</Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ex : Banque Dupont — Jean Martin"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button onClick={() => void handleCreate()} disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Créer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm suppression */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la dataroom ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le lien de partage ne fonctionnera plus.
              Les documents de la GED ne sont pas supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
