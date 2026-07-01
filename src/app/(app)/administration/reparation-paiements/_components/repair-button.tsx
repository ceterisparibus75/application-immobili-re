"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { repairOverAllocation } from "@/actions/bank-repair";
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

export function RepairButton({
  societyId,
  transactionId,
}: {
  societyId: string;
  transactionId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = await repairOverAllocation(societyId, transactionId);
    setLoading(false);
    if (result.success) {
      toast.success(
        `Correction appliquée sur ${result.data?.touchedInvoices.length ?? 0} facture(s)`,
      );
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur lors de la correction");
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={loading} className="gap-1.5">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wrench className="h-3.5 w-3.5" />
          )}
          Corriger
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Corriger ce rapprochement ?</AlertDialogTitle>
          <AlertDialogDescription>
            Les <code>BankReconciliation.amount</code> et{" "}
            <code>Payment.amount</code> seront réduits proportionnellement pour
            que la somme allouée corresponde au montant réellement reçu. Le
            statut des factures concernées sera recalculé automatiquement.
            Cette opération est enregistrée dans l&apos;audit.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Confirmer la correction
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
