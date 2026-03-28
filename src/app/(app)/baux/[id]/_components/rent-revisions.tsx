"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, XCircle, Loader2, ArrowRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { validateRevision, rejectRevision } from "@/actions/rent-revision";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { IndexType } from "@/generated/prisma/client";

type RevisionData = {
  id: string;
  effectiveDate: Date;
  previousRentHT: number;
  newRentHT: number;
  indexType: IndexType;
  baseIndexValue: number;
  newIndexValue: number;
  formula: string | null;
  isValidated: boolean;
  validatedAt: Date | null;
};

export function RentRevisions({
  revisions,
  societyId,
  isActive,
}: {
  revisions: RevisionData[];
  societyId: string;
  isActive: boolean;
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
      <p className="text-sm text-muted-foreground">Aucune révision enregistrée</p>
    );
  }

  return (
    <div className="divide-y">
      {revisions.map((rev) => {
        const isLoading = loading === rev.id;
        const isPending = !rev.isValidated;

        return (
          <div key={rev.id} className="py-3 space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {formatDate(rev.effectiveDate)}
                  </p>
                  {isPending ? (
                    <Badge variant="warning" className="text-xs">
                      <Clock className="h-3 w-3 mr-0.5" />
                      En attente
                    </Badge>
                  ) : (
                    <Badge variant="success" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-0.5" />
                      Validée
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Indice {rev.indexType} : {rev.baseIndexValue} → {rev.newIndexValue}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground">{formatCurrency(rev.previousRentHT)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{formatCurrency(rev.newRentHT)}</span>
                </div>
              </div>
            </div>

            {rev.formula && (
              <p className="text-xs text-muted-foreground font-mono">{rev.formula}</p>
            )}

            {isPending && isActive && (
              <div className="flex items-center gap-2 pt-1">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs h-7 text-destructive" disabled={isLoading}>
                      <XCircle className="h-3 w-3 mr-1" />
                      Rejeter
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Rejeter cette révision ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Le loyer restera inchangé.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleReject(rev.id)}>
                        Confirmer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button size="sm" className="text-xs h-7" onClick={() => handleValidate(rev.id)} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  )}
                  Valider et appliquer
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
