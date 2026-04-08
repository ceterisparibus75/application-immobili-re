"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { ArrowRight, Calendar, Eye, FileText, Lock, Plus, Share2, Trash2 } from "lucide-react";
import { createDataroom, deleteDataroom } from "@/actions/dataroom";

type DataroomItem = {
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
  creator: { name: string | null; email: string | null } | null;
  _count: { documents: number; accesses: number };
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

export function DataroomList({ societyId, datarooms }: { societyId: string; datarooms: DataroomItem[] }) {
  
  const [creating, startCreating] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState("");

  function handleCreate() {
    if (!name.trim()) return;
    startCreating(async () => {
      const result = await createDataroom(societyId, {
        name: name.trim(),
        description: description.trim() || undefined,
        purpose: (purpose.trim() || undefined) as "VENTE" | "AUDIT" | "FINANCEMENT" | "DUE_DILIGENCE" | "AUTRE" | undefined,
      });
      if (result.success) {
        toast.success("Dataroom creee: La dataroom a ete creee avec succes.");
        setDialogOpen(false);
        setName("");
        setDescription("");
        setPurpose("");
      } else {
        toast.error("Erreur: " + result.error);
      }
    });
  }

  function handleDelete(dataroomId: string, dataroomName: string) {
    if (!confirm("Supprimer la dataroom " + dataroomName + " ?")) return;
    startDeleting(async () => {
      const result = await deleteDataroom(societyId, dataroomId);
      if (result.success) {
        toast.success("Supprimee: La dataroom a ete supprimee.");
      } else {
        toast.error("Erreur: " + result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />Nouvelle dataroom</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle dataroom</DialogTitle>
              <DialogDescription>Creez un espace de partage de documents securise.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="dr-name">Nom *</Label>
                <Input id="dr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Due diligence Immeuble Lyon" />
              </div>
              <div>
                <Label htmlFor="dr-desc">Description</Label>
                <Textarea id="dr-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description optionnelle..." rows={2} />
              </div>
              <div>
                <Label htmlFor="dr-purpose">Objectif</Label>
                <Input id="dr-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Ex: Vente, Audit, Financement" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                {creating ? "Creation..." : "Creer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {datarooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Share2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium mb-1">Aucune dataroom pour l'instant</p>
            <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
              Créez un espace prêt à partager quand vous préparez une vente, un audit, un financement ou une revue documentaire.
            </p>
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Créer ma première dataroom
              </Button>
              <Link href="/documents">
                <Button variant="outline" className="gap-1.5">
                  Voir la GED
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {datarooms.map((dr) => (
            <Card key={dr.id} className="group hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Link href={"/dataroom/" + dr.id} className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate hover:text-primary transition-colors">{dr.name}</CardTitle>
                  </Link>
                  <StatusBadge status={dr.status} />
                </div>
                {dr.description && <CardDescription className="line-clamp-2 text-xs">{dr.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{dr._count.documents} doc{dr._count.documents !== 1 ? "s" : ""}</span>
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{dr.accessCount} acces</span>
                  {dr.password && <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" />Protege</span>}
                  {dr.expiresAt && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(dr.expiresAt)}</span>}
                </div>
                {dr.purpose && <p className="text-xs text-muted-foreground"><span className="font-medium">Objectif :</span> {dr.purpose}</p>}
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="text-xs text-muted-foreground">{formatDate(dr.createdAt)}</span>
                  <div className="flex gap-1">
                    <Link href={"/dataroom/" + dr.id}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">Ouvrir</Button>
                    </Link>
                    {(dr.status === "BROUILLON" || dr.status === "ARCHIVE") && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(dr.id, dr.name)} disabled={deleting}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
