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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { ArrowRight, Calendar, Eye, FileText, Lock, Plus, Share2, Trash2 } from "lucide-react";
import { createDataroom, deleteDataroom } from "@/actions/dataroom";

const PURPOSE_OPTIONS = [
  { value: "VENTE", label: "Vente" },
  { value: "AUDIT", label: "Audit" },
  { value: "FINANCEMENT", label: "Financement" },
  { value: "DUE_DILIGENCE", label: "Due diligence" },
  { value: "AUTRE", label: "Autre" },
] as const;

const NO_PURPOSE_VALUE = "__NO_PURPOSE__";

type PurposeValue = (typeof PURPOSE_OPTIONS)[number]["value"];

function getPurposeLabel(value: string | null): string {
  if (!value) return "";
  return PURPOSE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

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
    ARCHIVE: { label: "Archivé", variant: "outline" },
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
  const [purpose, setPurpose] = useState<string>(NO_PURPOSE_VALUE);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");

  function resetForm() {
    setName("");
    setDescription("");
    setPurpose(NO_PURPOSE_VALUE);
    setRecipientEmail("");
    setRecipientName("");
  }

  function handleCreate() {
    if (!name.trim()) return;
    startCreating(async () => {
      const result = await createDataroom(societyId, {
        name: name.trim(),
        description: description.trim() || null,
        purpose: purpose === NO_PURPOSE_VALUE ? null : (purpose as PurposeValue),
        recipientEmail: recipientEmail.trim() || null,
        recipientName: recipientName.trim() || null,
      });
      if (result.success) {
        toast.success("Dataroom créée");
        setDialogOpen(false);
        resetForm();
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleDelete(dataroomId: string, dataroomName: string) {
    if (!confirm("Supprimer la dataroom « " + dataroomName + " » ?")) return;
    startDeleting(async () => {
      const result = await deleteDataroom(societyId, dataroomId);
      if (result.success) {
        toast.success("Dataroom supprimée");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />Nouvelle dataroom</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouvelle dataroom</DialogTitle>
              <DialogDescription>Créez un espace de partage de documents sécurisé.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="dr-name">Nom *</Label>
                <Input
                  id="dr-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Due diligence Immeuble Lyon"
                />
              </div>
              <div>
                <Label htmlFor="dr-desc">Description</Label>
                <Textarea
                  id="dr-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description optionnelle..."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="dr-purpose">Objectif</Label>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger id="dr-purpose">
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
                  <Label htmlFor="dr-email">Email destinataire</Label>
                  <Input
                    id="dr-email"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="contact@exemple.com"
                  />
                </div>
                <div>
                  <Label htmlFor="dr-rname">Nom destinataire</Label>
                  <Input
                    id="dr-rname"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Jean Dupont"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Optionnel — le destinataire sera notifié par email à chaque ajout de document.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                {creating ? "Création..." : "Créer"}
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
                {dr.description && (
                  <CardDescription className="line-clamp-2 text-xs">{dr.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {dr._count.documents} doc{dr._count.documents !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {dr.accessCount} accès
                  </span>
                  {dr.password && (
                    <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" />Protégé</span>
                  )}
                  {dr.expiresAt && (
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(dr.expiresAt)}</span>
                  )}
                </div>
                {dr.purpose && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Objectif :</span> {getPurposeLabel(dr.purpose)}
                  </p>
                )}
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="text-xs text-muted-foreground">{formatDate(dr.createdAt)}</span>
                  <div className="flex gap-1">
                    <Link href={"/dataroom/" + dr.id}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">Ouvrir</Button>
                    </Link>
                    {(dr.status === "BROUILLON" || dr.status === "ARCHIVE") && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(dr.id, dr.name)}
                        disabled={deleting}
                      >
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
