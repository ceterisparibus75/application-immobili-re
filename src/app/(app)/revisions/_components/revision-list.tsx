"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Building2, CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { validateRevision, rejectRevision } from "@/actions/rent-revision";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { IndexType } from "@/generated/prisma/client";

type RevisionItem = {
  id: string;
  effectiveDate: Date;
  previousRentHT: number;
  newRentHT: number;
  indexType: IndexType;
  baseIndexValue: number;
  newIndexValue: number;
  formula: string | null;
  isValidated: boolean;
  createdAt: Date;
  lease: {
    id: string;
    startDate: Date;
    currentRentHT: number;
    tenant: {
      id: string;
      entityType: string;
      companyName: string | null;
      firstName: string | null;
      lastName: string | null;
    };
    lot: {
      number: string;
      building: { id: string; name: string; city: string };
    };
  };
};
function getTenantName(t: RevisionItem["lease"]["tenant"]): string {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "—")
    : [t.firstName, t.lastName].filter(Boolean).join(" ") || "—";
}

function getVariationPercent(prev: number, next: number): string {
  if (prev === 0) return "+0,00 %";
  const pct = ((next - prev) / prev) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2).replace(".", ",")} %`;
}

export function RevisionList({
  revisions,
  societyId,
}: {
  revisions: RevisionItem[];
  societyId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleValidate = async (revisionId: string) => {
    setLoading(revisionId);
    const result = await validateRevision(societyId, revisionId);
    setLoading(null);
    if (result.success) {
      toast.success("Révision validée, loyer mis à jour");
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  };

  const handleReject = async (revisionId: string) => {
    setLoading(revisionId);
    const result = await rejectRevision(societyId, revisionId);
    setLoading(null);
    if (result.success) {
      toast.success("Révision rejetée");
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  };
  if (revisions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-[var(--color-status-positive)] mb-3" />
          <p className="text-sm text-muted-foreground">
            Aucune révision de loyer en attente de validation.
          </p>
        </CardContent>
      </Card>
    );
  }

  const byBuilding: Record<string, RevisionItem[]> = {};
  for (const rev of revisions) {
    const key = rev.lease.lot.building.name;
    if (!byBuilding[key]) byBuilding[key] = [];
    byBuilding[key].push(rev);
  }

  return (
    <div className="space-y-4">
      {Object.entries(byBuilding)
        .sort(([a], [b]) => a.localeCompare(b, "fr"))
        .map(([buildingName, revs]) => (
          <Card key={buildingName}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                {buildingName}
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {revs.length} révision{revs.length > 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {revs.map((rev) => {
                  const isLoading = loading === rev.id;
                  const variation = getVariationPercent(rev.previousRentHT, rev.newRentHT);
                  const isIncrease = rev.newRentHT > rev.previousRentHT;

                  return (
                    <div key={rev.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              Lot {rev.lease.lot.number} — {getTenantName(rev.lease.tenant)}
                            </p>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {rev.indexType}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Date d&apos;effet : {formatDate(rev.effectiveDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right hidden sm:block">
                            <div className="flex items-center gap-1 text-sm">
                              <span className="text-muted-foreground">{formatCurrency(rev.previousRentHT)}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">{formatCurrency(rev.newRentHT)}</span>
                            </div>
                            <p className={`text-xs font-medium ${isIncrease ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-positive)]"}`}>
                              {variation}
                            </p>
                          </div>
                        </div>
                      </div>

                      {rev.formula && (
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 font-mono">
                          {rev.formula}
                        </p>
                      )}
                      <div className="flex items-center gap-2 justify-end">
                        <Link href={`/baux/${rev.lease.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs">
                            Voir le bail
                          </Button>
                        </Link>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-xs text-destructive" disabled={isLoading}>
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Rejeter
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Rejeter cette révision ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                La révision sera supprimée. Le loyer restera inchangé.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleReject(rev.id)}>
                                Confirmer le rejet
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <Button size="sm" className="text-xs" onClick={() => handleValidate(rev.id)} disabled={isLoading}>
                          {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          )}
                          Valider
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
