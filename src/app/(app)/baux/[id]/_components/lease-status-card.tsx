"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLease } from "@/actions/lease";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import type { LeaseStatus } from "@/generated/prisma/client";

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
    description: "Bail actif, loyer du par le locataire selon les conditions convenues.",
    color: "text-emerald-600",
    variant: "success",
    icon: CheckCircle2,
  },
  RESILIE: {
    label: "Resilie",
    description: "Bail termine par le locataire ou le bailleur. Le lot est libere.",
    color: "text-gray-500",
    variant: "secondary",
    icon: Ban,
  },
  RENOUVELE: {
    label: "Renouvele",
    description: "Bail reconduit pour une nouvelle periode aux memes conditions ou modifiees.",
    color: "text-blue-600",
    variant: "default",
    icon: RefreshCcw,
  },
  EN_NEGOCIATION: {
    label: "En negociation",
    description: "Les conditions du bail sont en cours de discussion entre les parties.",
    color: "text-amber-600",
    variant: "warning",
    icon: MessageSquare,
  },
  CONTENTIEUX: {
    label: "Contentieux",
    description: "Litige en cours entre le bailleur et le locataire (impaye, trouble, etc.).",
    color: "text-red-600",
    variant: "destructive",
    icon: Gavel,
  },
};

// Transitions autorisees depuis chaque statut
const TRANSITIONS: Record<LeaseStatus, { target: LeaseStatus; label: string; icon: React.ElementType; variant: "default" | "outline" | "destructive" | "secondary" }[]> = {
  EN_COURS: [
    { target: "RESILIE", label: "Resilier le bail", icon: Ban, variant: "destructive" },
    { target: "RENOUVELE", label: "Renouveler", icon: RefreshCcw, variant: "default" },
    { target: "EN_NEGOCIATION", label: "Passer en negociation", icon: MessageSquare, variant: "outline" },
    { target: "CONTENTIEUX", label: "Declarer un contentieux", icon: Gavel, variant: "destructive" },
  ],
  EN_NEGOCIATION: [
    { target: "EN_COURS", label: "Repasser en cours", icon: CheckCircle2, variant: "default" },
    { target: "RESILIE", label: "Resilier le bail", icon: Ban, variant: "destructive" },
    { target: "CONTENTIEUX", label: "Declarer un contentieux", icon: Gavel, variant: "destructive" },
  ],
  CONTENTIEUX: [
    { target: "EN_COURS", label: "Retour en cours", icon: CheckCircle2, variant: "default" },
    { target: "RESILIE", label: "Resilier le bail", icon: Ban, variant: "destructive" },
  ],
  RENOUVELE: [
    { target: "EN_COURS", label: "Passer en cours", icon: CheckCircle2, variant: "default" },
    { target: "RESILIE", label: "Resilier", icon: Ban, variant: "destructive" },
  ],
  RESILIE: [],
};

interface LeaseStatusCardProps {
  leaseId: string;
  societyId: string;
  currentStatus: LeaseStatus;
}

export function LeaseStatusCard({ leaseId, societyId, currentStatus }: LeaseStatusCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmTarget, setConfirmTarget] = useState<LeaseStatus | null>(null);

  const config = STATUS_CONFIG[currentStatus];
  const transitions = TRANSITIONS[currentStatus];
  const StatusIcon = config.icon;

  function handleTransition(target: LeaseStatus) {
    // Demander confirmation pour resiliation et contentieux
    if ((target === "RESILIE" || target === "CONTENTIEUX") && confirmTarget !== target) {
      setConfirmTarget(target);
      return;
    }

    setConfirmTarget(null);
    startTransition(async () => {
      const result = await updateLease(societyId, { id: leaseId, status: target });
      if (result.success) {
        toast.success(`Statut passe a "${STATUS_CONFIG[target].label}"`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors du changement de statut");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Statut du bail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statut actuel */}
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${config.color}`}>
            <StatusIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant={config.variant} className="text-xs">
                {config.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {config.description}
            </p>
          </div>
        </div>

        {/* Actions de transition */}
        {transitions.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium mb-2">
              Changer le statut :
            </p>
            <div className="flex flex-wrap gap-2">
              {transitions.map((t) => {
                const Icon = t.icon;
                return (
                  <Button
                    key={t.target}
                    variant={t.variant}
                    size="sm"
                    className="text-xs h-8"
                    disabled={isPending}
                    onClick={() => handleTransition(t.target)}
                  >
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                    {t.label}
                  </Button>
                );
              })}
            </div>

            {/* Message de confirmation */}
            {confirmTarget && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-2 mt-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      Confirmer le passage en &quot;{STATUS_CONFIG[confirmTarget].label}&quot; ?
                    </p>
                    {confirmTarget === "RESILIE" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Cette action liberera le(s) lot(s) associe(s) au bail.
                        Le bail ne pourra plus etre reactive — il faudra en creer un nouveau.
                      </p>
                    )}
                    {confirmTarget === "CONTENTIEUX" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Le bail sera marque en litige. Les factures et relances
                        restent actives.
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
                    {isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Confirmer"
                    )}
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
        )}

        {/* Bail resilie = pas d'action */}
        {transitions.length === 0 && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground italic">
              Ce bail est termine. Pour relouer ce lot, creez un nouveau bail.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
