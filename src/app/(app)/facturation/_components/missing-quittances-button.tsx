"use client";

import { useState } from "react";
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
import { FileCheck2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateMissingQuittances } from "@/actions/invoice";

export function MissingQuittancesButton({ societyId }: { societyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGenerate(): Promise<void> {
    setLoading(true);
    try {
      const result = await generateMissingQuittances(societyId);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Erreur lors du rattrapage des quittances");
        return;
      }
      const { generated, failed, remaining } = result.data;
      if (generated === 0 && failed === 0) {
        toast.success("Aucune quittance manquante");
      } else {
        toast.success(
          `${generated} quittance${generated > 1 ? "s" : ""} générée${generated > 1 ? "s" : ""} et envoyée${generated > 1 ? "s" : ""}` +
            (failed > 0 ? ` — ${failed} en échec` : "") +
            (remaining > 0 ? ` — ${remaining} restante${remaining > 1 ? "s" : ""}, relancez le rattrapage` : "")
        );
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
          Générer les quittances manquantes
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Générer les quittances manquantes ?</AlertDialogTitle>
          <AlertDialogDescription>
            Une quittance sera créée pour chaque appel de loyer payé qui n&apos;en a pas encore, puis
            envoyée par email au locataire et déposée dans son espace. Traitement par lots de 15.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleGenerate} disabled={loading}>
            {loading ? "Génération…" : "Générer et envoyer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
