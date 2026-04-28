"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { DATAROOM_TEMPLATES, getDataroomTemplate, PERMISSION_LABELS, type DataroomChecklistItem, type DataroomGroupPreset, type DataroomTemplateKey } from "@/lib/dataroom-templates";
import { ArrowRight, Calendar, CheckCircle2, Eye, FileText, ListChecks, Lock, Plus, Share2, ShieldCheck, Trash2, Users } from "lucide-react";
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

const STEPS = [
  { label: "Modèle", icon: ListChecks },
  { label: "Projet", icon: FileText },
  { label: "Sécurité", icon: ShieldCheck },
  { label: "Accès", icon: Users },
  { label: "Validation", icon: CheckCircle2 },
];

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
  const router = useRouter();
  const [creating, startCreating] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState(0);
  const defaultTemplate = DATAROOM_TEMPLATES[0];
  const [templateKey, setTemplateKey] = useState<DataroomTemplateKey>(defaultTemplate.key);
  const [name, setName] = useState("");
  const [description, setDescription] = useState(defaultTemplate.description);
  const [purpose, setPurpose] = useState<string>(defaultTemplate.purpose ?? NO_PURPOSE_VALUE);
  const [expiresAt, setExpiresAt] = useState("");
  const [password, setPassword] = useState("");
  const [accessMode, setAccessMode] = useState<"LINK" | "EMAIL_REQUIRED">("LINK");
  const [allowDownload, setAllowDownload] = useState(true);
  const [allowPrint, setAllowPrint] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [ndaRequired, setNdaRequired] = useState(false);
  const [groups, setGroups] = useState<DataroomGroupPreset[]>(defaultTemplate.groups);
  const [checklist, setChecklist] = useState<DataroomChecklistItem[]>(defaultTemplate.checklist);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const selectedTemplate = getDataroomTemplate(templateKey);

  function resetForm() {
    const template = DATAROOM_TEMPLATES[0];
    setStep(0);
    setTemplateKey(template.key);
    setName("");
    setDescription(template.description);
    setPurpose(template.purpose ?? NO_PURPOSE_VALUE);
    setExpiresAt("");
    setPassword("");
    setAccessMode("LINK");
    setAllowDownload(true);
    setAllowPrint(false);
    setWatermarkEnabled(false);
    setNdaRequired(false);
    setGroups(template.groups);
    setChecklist(template.checklist);
    setRecipientEmail("");
    setRecipientName("");
  }

  function applyTemplate(key: DataroomTemplateKey) {
    const template = getDataroomTemplate(key);
    setTemplateKey(key);
    setPurpose(template.purpose ?? NO_PURPOSE_VALUE);
    setDescription(template.description);
    setGroups(template.groups);
    setChecklist(template.checklist);
  }

  function updateGroupPermission(groupId: string, permission: DataroomGroupPreset["permission"]) {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, permission } : group));
  }

  function toggleChecklistItem(itemId: string) {
    setChecklist((current) => current.map((item) => item.id === itemId ? { ...item, done: !item.done } : item));
  }

  function handleCreate() {
    if (!name.trim()) return;
    startCreating(async () => {
      const result = await createDataroom(societyId, {
        name: name.trim(),
        description: description.trim() || null,
        purpose: purpose === NO_PURPOSE_VALUE ? null : (purpose as PurposeValue),
        templateKey,
        expiresAt: expiresAt || null,
        password: password || null,
        accessMode,
        allowDownload,
        allowPrint,
        watermarkEnabled,
        ndaRequired,
        groups,
        checklist,
        recipientEmail: recipientEmail.trim() || null,
        recipientName: recipientName.trim() || null,
      });
      if (result.success) {
        toast.success("Dataroom créée");
        setDialogOpen(false);
        resetForm();
        if (result.data?.id) router.push(`/dataroom/${result.data.id}`);
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
            <Button><Plus className="h-4 w-4 mr-1" />Créer une dataroom</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer une dataroom professionnelle</DialogTitle>
              <DialogDescription>Choisissez un modèle, sécurisez l'accès et préparez la checklist avant de partager.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 lg:grid-cols-[180px_1fr]">
              <div className="space-y-2">
                {STEPS.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setStep(index)}
                      className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${step === index ? "border-primary bg-primary/5 text-primary" : "bg-background text-muted-foreground"}`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <div className="min-h-[430px] space-y-4">
                {step === 0 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold">Modèle documentaire</h3>
                      <p className="text-sm text-muted-foreground">Le modèle pré-remplit les sections, groupes et points de contrôle.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {DATAROOM_TEMPLATES.map((template) => (
                        <button
                          key={template.key}
                          type="button"
                          onClick={() => applyTemplate(template.key)}
                          className={`rounded-md border p-4 text-left transition-colors ${templateKey === template.key ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
                        >
                          <p className="font-medium">{template.label}</p>
                          <p className="mt-1 min-h-10 text-sm text-muted-foreground">{template.description}</p>
                          <p className="mt-3 text-xs text-muted-foreground">{template.sections.length} sections · {template.checklist.length} contrôles</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold">Identité du projet</h3>
                      <p className="text-sm text-muted-foreground">Nommez la dataroom et donnez le contexte au destinataire.</p>
                    </div>
                    <div>
                      <Label htmlFor="dr-name">Nom *</Label>
                      <Input id="dr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Due diligence Immeuble Lyon" />
                    </div>
                    <div>
                      <Label htmlFor="dr-desc">Message d'accueil / description</Label>
                      <Textarea id="dr-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                    </div>
                    <div>
                      <Label htmlFor="dr-purpose">Objectif</Label>
                      <Select value={purpose} onValueChange={setPurpose}>
                        <SelectTrigger id="dr-purpose"><SelectValue placeholder="Sélectionner un objectif..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_PURPOSE_VALUE}>Aucun</SelectItem>
                          {PURPOSE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="dr-expiry">Expiration</Label>
                      <Input id="dr-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold">Sécurité globale</h3>
                      <p className="text-sm text-muted-foreground">Ces réglages s'appliquent à toute la dataroom en Lot 1.</p>
                    </div>
                    <div>
                      <Label htmlFor="dr-password">Mot de passe</Label>
                      <Input id="dr-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Optionnel" />
                    </div>
                    <div>
                      <Label>Mode d'accès</Label>
                      <Select value={accessMode} onValueChange={(value) => setAccessMode(value as "LINK" | "EMAIL_REQUIRED")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LINK">Lien simple</SelectItem>
                          <SelectItem value="EMAIL_REQUIRED">Email visiteur obligatoire</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        { label: "Téléchargement autorisé", checked: allowDownload, onChange: setAllowDownload },
                        { label: "Impression autorisée", checked: allowPrint, onChange: setAllowPrint },
                        { label: "Filigrane dynamique", checked: watermarkEnabled, onChange: setWatermarkEnabled },
                        { label: "Engagement de confidentialité", checked: ndaRequired, onChange: setNdaRequired },
                      ].map((option) => (
                        <label key={option.label} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                          <Checkbox checked={option.checked} onCheckedChange={(checked) => option.onChange(checked === true)} />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold">Invités et groupes</h3>
                      <p className="text-sm text-muted-foreground">Les groupes restent globaux dans ce premier lot.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="dr-email">Email destinataire principal</Label>
                        <Input id="dr-email" type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="contact@exemple.com" />
                      </div>
                      <div>
                        <Label htmlFor="dr-rname">Nom destinataire</Label>
                        <Input id="dr-rname" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Jean Dupont" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      {groups.map((group) => (
                        <div key={group.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_220px]">
                          <div>
                            <p className="font-medium">{group.name}</p>
                            <p className="text-xs text-muted-foreground">Permission globale appliquée à ce groupe.</p>
                          </div>
                          <Select value={group.permission} onValueChange={(value) => updateGroupPermission(group.id, value as DataroomGroupPreset["permission"])}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(PERMISSION_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold">Checklist et validation</h3>
                      <p className="text-sm text-muted-foreground">Cochez ce qui est déjà prêt. Vous pourrez compléter ensuite depuis la page détail.</p>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-sm font-medium">{selectedTemplate.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedTemplate.sections.join(" · ")}</p>
                    </div>
                    {checklist.length === 0 ? (
                      <p className="rounded-md border p-4 text-sm text-muted-foreground">Aucune checklist pour une dataroom vide.</p>
                    ) : (
                      <div className="grid gap-2">
                        {checklist.map((item) => (
                          <label key={item.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                            <Checkbox checked={item.done === true} onCheckedChange={() => toggleChecklistItem(item.id)} />
                            <span className="flex-1">
                              <span className="font-medium">{item.label}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{item.section}{item.required ? " · requis" : " · optionnel"}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Précédent</Button>
              {step < STEPS.length - 1 && (
                <Button variant="outline" onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}>Suivant</Button>
              )}
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
