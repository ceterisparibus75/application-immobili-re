"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/providers/society-provider";
import {
  createLeaseTemplate,
  deleteLeaseTemplate,
  getLeaseTemplates,
} from "@/actions/lease-template";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, FileText, Trash2, Loader2, Star } from "lucide-react";
import Link from "next/link";
import type { LeaseType } from "@/validations/lease";

const LEASE_TYPE_LABELS: Record<string, string> = {
  HABITATION: "Habitation vide",
  MEUBLE: "Meuble",
  ETUDIANT: "Etudiant",
  MOBILITE: "Mobilite",
  COLOCATION: "Colocation",
  SAISONNIER: "Saisonnier",
  LOGEMENT_FONCTION: "Logement fonction",
  ANAH: "ANAH",
  CIVIL: "Civil",
  GLISSANT: "Glissant",
  SOUS_LOCATION: "Sous-location",
  COMMERCIAL_369: "Commercial 3/6/9",
  DEROGATOIRE: "Derogatoire",
  PRECAIRE: "Precaire",
  BAIL_PROFESSIONNEL: "Professionnel",
  MIXTE: "Mixte",
  EMPHYTEOTIQUE: "Emphyteotique",
  CONSTRUCTION: "Construction",
  REHABILITATION: "Rehabilitation",
  BRS: "BRS",
  RURAL: "Rural",
};

const LEASE_TYPE_OPTIONS = [
  { group: "Habitation", items: [
    { value: "HABITATION", label: "Bail d'habitation vide (loi 1989)" },
    { value: "MEUBLE", label: "Bail meuble (ALUR)" },
    { value: "ETUDIANT", label: "Bail etudiant meuble (9 mois)" },
    { value: "MOBILITE", label: "Bail mobilite (ELAN)" },
    { value: "COLOCATION", label: "Bail colocation" },
    { value: "COMMERCIAL_369", label: "Bail commercial 3/6/9" },
    { value: "BAIL_PROFESSIONNEL", label: "Bail professionnel (6 ans)" },
  ]},
];

type Template = {
  id: string;
  name: string;
  leaseType: string;
  isDefault: boolean;
  description?: string | null;
  _count: { leases: number };
};

export default function ModelesPage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const didMount = useRef(false);

  async function refreshTemplates() {
    if (!activeSociety) return;
    setLoading(true);
    const data = await getLeaseTemplates(activeSociety.id);
    setTemplates(data as Template[]);
    setLoading(false);
  }

  useEffect(() => {
    if (didMount.current || !activeSociety) return;
    didMount.current = true;

    let cancelled = false;
    (async () => {
      const data = await getLeaseTemplates(activeSociety.id);
      if (!cancelled) {
        setTemplates(data as Template[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeSociety]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) return;

    setCreating(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await createLeaseTemplate(activeSociety.id, {
      name: data.name,
      leaseType: data.leaseType as LeaseType,
      description: data.description || null,
      isDefault: data.isDefault === "on",
      headerContent: data.headerContent || null,
      partiesClause: data.partiesClause || null,
      premisesClause: data.premisesClause || null,
      durationClause: data.durationClause || null,
      rentClause: data.rentClause || null,
      depositClause: data.depositClause || null,
      specialConditions: data.specialConditions || null,
      signatureClause: data.signatureClause || null,
      defaultDurationMonths: data.defaultDurationMonths ? parseInt(data.defaultDurationMonths) : null,
    });

    setCreating(false);
    if (result.success) {
      setDialogOpen(false);
      void refreshTemplates();
    } else {
      setError(result.error ?? "Erreur");
    }
  }

  async function handleDelete(templateId: string) {
    if (!activeSociety) return;
    if (!confirm("Supprimer ce modele ?")) return;
    await deleteLeaseTemplate(activeSociety.id, templateId);
    void refreshTemplates();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/baux">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Modeles de bail</h1>
            <p className="text-muted-foreground">
              Gerez vos modeles de bail reutilisables
            </p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau modele
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Creer un modele de bail</DialogTitle>
              <DialogDescription>
                Definissez les clauses et parametres par defaut pour vos baux.
                Les variables disponibles : {"{{bailleur.nom}}"}, {"{{locataire.nom}}"}, {"{{lot.adresse}}"}, {"{{bail.loyer}}"}, {"{{bail.duree}}"}.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom du modele *</Label>
                  <Input id="name" name="name" required placeholder="Bail habitation standard" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leaseType">Type de bail *</Label>
                  <select
                    id="leaseType"
                    name="leaseType"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {LEASE_TYPE_OPTIONS.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.items.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="Description du modele..." />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="isDefault" name="isDefault" className="h-4 w-4" />
                <Label htmlFor="isDefault">Modele par defaut pour ce type de bail</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultDurationMonths">Duree par defaut (mois)</Label>
                <Input id="defaultDurationMonths" name="defaultDurationMonths" type="number" min={1} placeholder="36" />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Clauses du bail</h3>
                <div className="space-y-2">
                  <Label htmlFor="headerContent">En-tete / Titre</Label>
                  <Textarea id="headerContent" name="headerContent" rows={3} placeholder="BAIL D'HABITATION\nLoi n 89-462 du 6 juillet 1989" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partiesClause">Designation des parties</Label>
                  <Textarea id="partiesClause" name="partiesClause" rows={4} placeholder="Entre les soussignes :\n\nLe bailleur : {{bailleur.nom}}..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="premisesClause">Designation des locaux</Label>
                  <Textarea id="premisesClause" name="premisesClause" rows={3} placeholder="Le bailleur loue au preneur le bien situe a {{lot.adresse}}..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="durationClause">Duree et renouvellement</Label>
                  <Textarea id="durationClause" name="durationClause" rows={3} placeholder="Le present bail est consenti pour une duree de {{bail.duree}} mois..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rentClause">Loyer et charges</Label>
                  <Textarea id="rentClause" name="rentClause" rows={3} placeholder="Le loyer mensuel est fixe a {{bail.loyer}} euros HT..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depositClause">Depot de garantie</Label>
                  <Textarea id="depositClause" name="depositClause" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialConditions">Conditions particulieres</Label>
                  <Textarea id="specialConditions" name="specialConditions" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signatureClause">Clause de signature</Label>
                  <Textarea id="signatureClause" name="signatureClause" rows={3} placeholder="Fait en deux exemplaires, a {{societe.ville}}, le {{bail.date}}." />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Creer le modele
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-2">Aucun modele de bail</p>
            <p className="text-sm text-muted-foreground mb-4">
              Creez un modele pour standardiser vos baux et gagner du temps.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Creer un modele
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((tpl) => (
            <Card key={tpl.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {tpl.name}
                      {tpl.isDefault && (
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {tpl.description || "Pas de description"}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {LEASE_TYPE_LABELS[tpl.leaseType] || tpl.leaseType}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {tpl._count.leases} bail{tpl._count.leases > 1 ? "x" : ""} utilisant ce modele
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/baux/modeles/${tpl.id}`)}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(tpl.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
