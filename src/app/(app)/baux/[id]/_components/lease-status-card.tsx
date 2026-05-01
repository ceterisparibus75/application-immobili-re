"use client";

import { useMemo, useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { updateLease, transferLeaseTenant } from "@/actions/lease";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Gavel,
  History,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Repeat2,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";
import type {
  LeaseStatus,
  LeaseTenantTransferType,
  LegalEventStatus,
  LegalEventType,
  TenantEntityType,
} from "@/generated/prisma/client";

const STATUS_CONFIG: Record<
  LeaseStatus,
  {
    label: string;
    description: string;
    color: string;
    variant: "success" | "secondary" | "warning" | "destructive" | "default";
    icon: React.ElementType;
  }
> = {
  EN_COURS: {
    label: "En cours",
    description: "Bail actif, loyer dû par le titulaire actuel selon les conditions convenues.",
    color: "text-emerald-600",
    variant: "success",
    icon: CheckCircle2,
  },
  RESILIE: {
    label: "Résilié",
    description: "Bail terminé par le locataire ou le bailleur. Le lot est libéré.",
    color: "text-gray-500",
    variant: "secondary",
    icon: Ban,
  },
  RENOUVELE: {
    label: "Renouvelé",
    description: "Bail reconduit pour une nouvelle période aux mêmes conditions ou modifiées.",
    color: "text-blue-600",
    variant: "default",
    icon: RefreshCcw,
  },
  EN_NEGOCIATION: {
    label: "En négociation",
    description: "Les conditions du bail sont en cours de discussion entre les parties.",
    color: "text-amber-600",
    variant: "warning",
    icon: MessageSquare,
  },
  CONTENTIEUX: {
    label: "Contentieux",
    description: "Litige en cours entre le bailleur et le locataire.",
    color: "text-red-600",
    variant: "destructive",
    icon: Gavel,
  },
};

const TRANSITIONS: Record<
  LeaseStatus,
  {
    target: LeaseStatus;
    label: string;
    icon: React.ElementType;
    variant: "default" | "outline" | "destructive" | "secondary";
  }[]
> = {
  EN_COURS: [
    { target: "RESILIE", label: "Résilier le bail", icon: Ban, variant: "destructive" },
    { target: "RENOUVELE", label: "Renouveler", icon: RefreshCcw, variant: "default" },
    { target: "EN_NEGOCIATION", label: "Passer en négociation", icon: MessageSquare, variant: "outline" },
    { target: "CONTENTIEUX", label: "Déclarer un contentieux", icon: Gavel, variant: "destructive" },
  ],
  EN_NEGOCIATION: [
    { target: "EN_COURS", label: "Repasser en cours", icon: CheckCircle2, variant: "default" },
    { target: "RESILIE", label: "Résilier le bail", icon: Ban, variant: "destructive" },
    { target: "CONTENTIEUX", label: "Déclarer un contentieux", icon: Gavel, variant: "destructive" },
  ],
  CONTENTIEUX: [
    { target: "EN_COURS", label: "Retour en cours", icon: CheckCircle2, variant: "default" },
    { target: "RESILIE", label: "Résilier le bail", icon: Ban, variant: "destructive" },
  ],
  RENOUVELE: [
    { target: "EN_COURS", label: "Passer en cours", icon: CheckCircle2, variant: "default" },
    { target: "RESILIE", label: "Résilier", icon: Ban, variant: "destructive" },
  ],
  RESILIE: [],
};

const TRANSFER_TYPE_LABELS: Record<LeaseTenantTransferType, string> = {
  CESSION_FONDS: "Cession du fonds de commerce",
  CESSION_DROIT_BAIL: "Cession du droit au bail",
  SUBSTITUTION: "Substitution de locataire",
  FUSION_ABSORPTION: "Fusion / absorption",
  AUTRE: "Autre changement",
};

const LEGAL_EVENT_TYPE_LABELS: Record<LegalEventType, string> = {
  CESSION: "Cession",
  CONGE: "Congé",
  EVICTION: "Éviction",
  COMMANDEMENT_PAYER: "Commandement de payer",
  ACTE_HUISSIER: "Acte d'huissier",
  RENOUVELLEMENT_CONTESTE: "Renouvellement contesté",
  SOUS_LOCATION: "Sous-location",
  DESPECIALISATION: "Déspécialisation",
  MISE_EN_DEMEURE: "Mise en demeure",
  AUTRE: "Autre",
};

const LEGAL_EVENT_STATUS_LABELS: Record<LegalEventStatus, string> = {
  OUVERT: "Ouvert",
  EN_COURS: "En cours",
  RESOLU: "Résolu",
  CLASSE: "Classé",
};

type TenantOption = {
  id: string;
  entityType: TenantEntityType;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

type TenantHistory = {
  id: string;
  startDate: Date;
  endDate: Date | null;
  transferType: LeaseTenantTransferType | null;
  transferReason: string | null;
  tenant: TenantOption;
  transferDocument: {
    id: string;
    fileName: string;
    storagePath: string | null;
    fileUrl: string;
  } | null;
};

type LegalEventRow = {
  id: string;
  type: LegalEventType;
  title: string;
  description: string | null;
  eventDate: Date;
  status: LegalEventStatus;
};

type InspectionRow = {
  id: string;
  type: string;
  performedAt: Date;
  performedBy: string | null;
};

interface LeaseLifeCardProps {
  leaseId: string;
  societyId: string;
  currentStatus: LeaseStatus;
  tenants: TenantOption[];
  tenantHistories: TenantHistory[];
  legalEvents: LegalEventRow[];
  legalEventsCount: number;
  inspections: InspectionRow[];
  inspectionsCount: number;
}

function tenantName(t: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "—")
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—";
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("fr-FR");
}

export function LeaseStatusCard({
  leaseId,
  societyId,
  currentStatus,
  tenants,
  tenantHistories,
  legalEvents,
  legalEventsCount,
  inspections,
  inspectionsCount,
}: LeaseLifeCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmTarget, setConfirmTarget] = useState<LeaseStatus | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const currentTenantId = tenantHistories.find((h) => !h.endDate)?.tenant.id;
  const transferTenantOptions = useMemo(
    () =>
      tenants
        .filter((tenant) => tenant.id !== currentTenantId)
        .map((tenant) => ({
          value: tenant.id,
          label: `${tenantName(tenant)}${tenant.email ? ` · ${tenant.email}` : ""}`,
        })),
    [currentTenantId, tenants]
  );
  const [transferForm, setTransferForm] = useState({
    newTenantId: "",
    effectiveDate: new Date().toISOString().slice(0, 10),
    transferType: "CESSION_FONDS" as LeaseTenantTransferType,
    transferReason: "",
  });

  const config = STATUS_CONFIG[currentStatus];
  const transitions = TRANSITIONS[currentStatus];
  const StatusIcon = config.icon;

  function handleTransition(target: LeaseStatus) {
    if ((target === "RESILIE" || target === "CONTENTIEUX") && confirmTarget !== target) {
      setConfirmTarget(target);
      return;
    }

    setConfirmTarget(null);
    startTransition(async () => {
      const result = await updateLease(societyId, { id: leaseId, status: target });
      if (result.success) {
        toast.success(`Statut passé à "${STATUS_CONFIG[target].label}"`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors du changement de statut");
      }
    });
  }

  function handleTransfer() {
    if (!transferForm.newTenantId) {
      toast.error("Sélectionnez le nouveau locataire");
      return;
    }
    startTransition(async () => {
      const result = await transferLeaseTenant(societyId, {
        leaseId,
        newTenantId: transferForm.newTenantId,
        effectiveDate: transferForm.effectiveDate,
        transferType: transferForm.transferType,
        transferReason: transferForm.transferReason || undefined,
      });
      if (result.success) {
        toast.success("Titulaire du bail mis à jour");
        setTransferOpen(false);
        setTransferForm({
          newTenantId: "",
          effectiveDate: new Date().toISOString().slice(0, 10),
          transferType: "CESSION_FONDS",
          transferReason: "",
        });
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors du changement de locataire");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4" />
              Vie du bail
            </CardTitle>
            {currentStatus !== "RESILIE" && (
              <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Repeat2 className="h-4 w-4" />
                    Changer le locataire
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Changer le titulaire du bail</DialogTitle>
                    <DialogDescription>
                      Enregistre une cession ou substitution sans créer de nouveau bail.
                      Les anciennes factures restent attachées à l'ancien locataire.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nouveau locataire</Label>
                      <NativeSelect
                        value={transferForm.newTenantId}
                        placeholder="Sélectionner un locataire"
                        options={transferTenantOptions}
                        onChange={(event) =>
                          setTransferForm({ ...transferForm, newTenantId: event.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label>Date d'effet</Label>
                        <Input
                          type="date"
                          value={transferForm.effectiveDate}
                          onChange={(event) =>
                            setTransferForm({ ...transferForm, effectiveDate: event.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Nature du changement</Label>
                        <NativeSelect
                          value={transferForm.transferType}
                          options={Object.entries(TRANSFER_TYPE_LABELS).map(([value, label]) => ({
                            value,
                            label,
                          }))}
                          onChange={(event) =>
                            setTransferForm({
                              ...transferForm,
                              transferType: event.target.value as LeaseTenantTransferType,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Note interne</Label>
                      <Textarea
                        rows={3}
                        placeholder="Ex: cession du fonds, acte signé, reprise des conditions du bail..."
                        value={transferForm.transferReason}
                        onChange={(event) =>
                          setTransferForm({ ...transferForm, transferReason: event.target.value })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setTransferOpen(false)}>
                      Annuler
                    </Button>
                    <Button
                      onClick={handleTransfer}
                      disabled={isPending || !transferForm.newTenantId}
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserRoundCheck className="h-4 w-4" />
                      )}
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${config.color}`}>
              <StatusIcon className="h-5 w-5" />
            </div>
            <div>
              <Badge variant={config.variant} className="text-xs">
                {config.label}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
            </div>
          </div>

          {transitions.length > 0 ? (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium mb-2">
                Actions de vie du bail :
              </p>
              <div className="flex flex-wrap gap-2">
                {transitions.map((transition) => {
                  const Icon = transition.icon;
                  return (
                    <Button
                      key={transition.target}
                      variant={transition.variant}
                      size="sm"
                      className="text-xs h-8"
                      disabled={isPending}
                      onClick={() => handleTransition(transition.target)}
                    >
                      {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                      {transition.label}
                    </Button>
                  );
                })}
              </div>

              {confirmTarget && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-2 mt-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">
                        Confirmer le passage en "{STATUS_CONFIG[confirmTarget].label}" ?
                      </p>
                      {confirmTarget === "RESILIE" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Cette action libérera le(s) lot(s) associé(s) au bail.
                        </p>
                      )}
                      {confirmTarget === "CONTENTIEUX" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Le bail sera marqué en litige. Les factures et relances restent actives.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs h-7"
                      disabled={isPending}
                      onClick={() => handleTransition(confirmTarget)}
                    >
                      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmer"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() => setConfirmTarget(null)}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground italic">
                Ce bail est terminé. Pour relouer ce lot, créez un nouveau bail.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Titulaires successifs ({tenantHistories.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenantHistories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun historique de titulaire enregistré
            </p>
          ) : (
            <div className="divide-y">
              {tenantHistories.map((history) => (
                <div key={history.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{tenantName(history.tenant)}</p>
                      <p className="text-xs text-muted-foreground">
                        Depuis le {formatDate(history.startDate)}
                        {history.endDate ? ` jusqu'au ${formatDate(history.endDate)}` : " · titulaire actuel"}
                      </p>
                      {history.transferReason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {history.transferReason}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {!history.endDate && <Badge variant="success">Actuel</Badge>}
                      {history.transferType && (
                        <Badge variant="outline">
                          {TRANSFER_TYPE_LABELS[history.transferType]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Événements ({legalEventsCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {legalEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun événement enregistré
              </p>
            ) : (
              <div className="divide-y">
                {legalEvents.map((event) => (
                  <div key={event.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {LEGAL_EVENT_TYPE_LABELS[event.type]} · {formatDate(event.eventDate)}
                        </p>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <Badge variant={event.status === "RESOLU" ? "success" : "secondary"}>
                        {LEGAL_EVENT_STATUS_LABELS[event.status]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              États des lieux ({inspectionsCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inspections.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun état des lieux enregistré
              </p>
            ) : (
              <div className="divide-y">
                {inspections.map((inspection) => (
                  <div key={inspection.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium">
                      {inspection.type === "ENTREE" ? "Entrée" : "Sortie"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(inspection.performedAt)}
                      {inspection.performedBy ? ` · ${inspection.performedBy}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Separator />
    </div>
  );
}
