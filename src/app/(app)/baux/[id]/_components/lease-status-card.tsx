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
  CardDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  MoreHorizontal,
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

type TimelineItem = {
  id: string;
  date: Date;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  detail?: string | null;
  badge?: string | null;
};

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
  const currentTenantHistory = tenantHistories.find((history) => !history.endDate);
  const currentTenantLabel = currentTenantHistory ? tenantName(currentTenantHistory.tenant) : "—";
  const timelineItems = useMemo<TimelineItem[]>(() => {
    const tenantItems = tenantHistories.map((history, index) => {
      const isCurrent = !history.endDate;
      const hasTransfer = Boolean(history.transferType);
      return {
        id: `tenant-${history.id}`,
        date: new Date(history.startDate),
        icon: hasTransfer ? Repeat2 : UserRoundCheck,
        title: hasTransfer ? "Changement de titulaire" : index === 0 ? "Début du bail" : "Titulaire du bail",
        subtitle: `${tenantName(history.tenant)}${isCurrent ? " devient le titulaire actuel" : " a été titulaire du bail"}`,
        detail: history.transferReason,
        badge: isCurrent ? "Actuel" : history.transferType ? TRANSFER_TYPE_LABELS[history.transferType] : null,
      };
    });

    const eventItems = legalEvents.map((event) => ({
      id: `event-${event.id}`,
      date: new Date(event.eventDate),
      icon: CalendarDays,
      title: event.title,
      subtitle: LEGAL_EVENT_TYPE_LABELS[event.type],
      detail: event.description,
      badge: LEGAL_EVENT_STATUS_LABELS[event.status],
    }));

    const inspectionItems = inspections.map((inspection) => ({
      id: `inspection-${inspection.id}`,
      date: new Date(inspection.performedAt),
      icon: ClipboardList,
      title: `État des lieux ${inspection.type === "ENTREE" ? "d'entrée" : "de sortie"}`,
      subtitle: inspection.performedBy ? `Réalisé par ${inspection.performedBy}` : "État des lieux",
      detail: null,
      badge: null,
    }));

    return [...tenantItems, ...eventItems, ...inspectionItems].sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );
  }, [inspections, legalEvents, tenantHistories]);

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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4" />
                Situation actuelle
              </CardTitle>
              <CardDescription>
                Titulaire, statut et actions juridiques du bail en cours.
              </CardDescription>
            </div>
            {currentStatus !== "RESILIE" && (
              <div className="flex flex-wrap items-center gap-2">
                <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
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

                {transitions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                        Autres actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {transitions.map((transition) => {
                        const Icon = transition.icon;
                        return (
                          <DropdownMenuItem
                            key={transition.target}
                            className={transition.variant === "destructive" ? "text-destructive" : ""}
                            disabled={isPending}
                            onClick={() => handleTransition(transition.target)}
                          >
                            <Icon className="h-4 w-4" />
                            {transition.label}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Statut du bail</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusIcon className={`h-4 w-4 ${config.color}`} />
                <Badge variant={config.variant} className="text-xs">
                  {config.label}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{config.description}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Titulaire actuel</p>
              <p className="mt-2 text-sm font-semibold">{currentTenantLabel}</p>
              {currentTenantHistory && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Depuis le {formatDate(currentTenantHistory.startDate)}
                </p>
              )}
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Historique</p>
              <p className="mt-2 text-sm font-semibold">
                {tenantHistories.length} titulaire{tenantHistories.length > 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {legalEventsCount} événement{legalEventsCount > 1 ? "s" : ""} · {inspectionsCount} état
                {inspectionsCount > 1 ? "s" : ""} des lieux
              </p>
            </div>
          </div>

          {confirmTarget && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-2">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Chronologie du bail
          </CardTitle>
          <CardDescription>
            Titulaires, événements juridiques et états des lieux classés du plus récent au plus ancien.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timelineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucun événement enregistré
            </p>
          ) : (
            <div className="space-y-0">
              {timelineItems.map((item, index) => {
                const Icon = item.icon;
                const isLast = index === timelineItems.length - 1;
                return (
                  <div key={item.id} className="grid grid-cols-[118px_24px_minmax(0,1fr)] gap-3">
                    <div className="py-3 text-xs tabular-nums text-muted-foreground">
                      {formatDate(item.date)}
                    </div>
                    <div className="relative flex justify-center">
                      {!isLast && <div className="absolute top-9 bottom-0 w-px bg-border" />}
                      <div className="mt-3 flex h-6 w-6 items-center justify-center rounded-full border bg-background">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                    </div>
                    <div className="py-3 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.badge && (
                          <Badge variant="outline" className="text-[11px]">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
                      {item.detail && (
                        <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Historique des titulaires ({tenantHistories.length})
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
      <Separator />
    </div>
  );
}
