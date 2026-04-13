"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/providers/society-provider";
import {
  validateStatement,
  verifyManagementStatement,
  markStatementConforme,
  markStatementLitige,
  deleteStatement,
} from "@/actions/third-party-statement";
import { Button } from "@/components/ui/button";
import { CheckCircle, Search, ShieldCheck, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  statementId: string;
  status: string;
  type: string;
}

export function StatementDetailActions({ statementId, status, type }: Props) {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const societyId = activeSociety?.id;
  const [isPending, startTransition] = useTransition();

  function action(fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) {
    if (!societyId) return;
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(successMsg);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      {status === "BROUILLON" && (
        <>
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => action(
              () => deleteStatement(societyId!, statementId),
              "Décompte supprimé"
            )}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span className="ml-1.5">Supprimer</span>
          </Button>
          <Button
            size="sm"
            disabled={isPending}
            className="gap-1.5"
            onClick={() => action(
              () => validateStatement(societyId!, statementId),
              "Décompte validé"
            )}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Valider
          </Button>
        </>
      )}

      {(status === "VALIDE" || status === "BROUILLON") && type === "DECOMPTE_GESTION" && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          className="gap-1.5"
          onClick={() => action(
            async () => {
              const res = await verifyManagementStatement(societyId!, statementId);
              return { success: res.success, error: res.error };
            },
            "Vérification effectuée"
          )}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Lancer la vérification
        </Button>
      )}

      {status === "VERIFIE" && (
        <>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            className="gap-1.5"
            onClick={() => action(
              () => markStatementLitige(societyId!, statementId),
              "Litige signalé"
            )}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Signaler un litige
          </Button>
          <Button
            size="sm"
            disabled={isPending}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => action(
              () => markStatementConforme(societyId!, statementId),
              "Marqué conforme"
            )}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Marquer conforme
          </Button>
        </>
      )}
    </div>
  );
}
