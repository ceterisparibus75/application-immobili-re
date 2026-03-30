"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, RefreshCw } from "lucide-react";
import { deleteLoan, regenerateAmortizationTable } from "@/actions/loan";
import { toast } from "sonner";

export function LoanActionsClient({
  loanId,
  societyId,
  loanLabel,
}: {
  loanId: string;
  societyId: string;
  loanLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"delete" | "regen" | null>(null);

  function handleDelete() {
    setAction("delete");
    startTransition(async () => {
      const result = await deleteLoan(societyId, loanId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Emprunt supprimé");
        router.push("/emprunts");
      }
      setAction(null);
    });
  }

  function handleRegenerate() {
    setAction("regen");
    startTransition(async () => {
      const result = await regenerateAmortizationTable(societyId, loanId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Tableau régénéré (${result.data?.linesCount} échéances)`);
        router.refresh();
      }
      setAction(null);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRegenerate}
        disabled={isPending}
      >
        <RefreshCw className={`h-4 w-4 ${action === "regen" && isPending ? "animate-spin" : ""}`} />
        Régénérer le tableau
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={isPending}>
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet emprunt ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;emprunt &laquo; {loanLabel} &raquo; et tout son tableau d&apos;amortissement seront définitivement supprimés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {action === "delete" && isPending ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
