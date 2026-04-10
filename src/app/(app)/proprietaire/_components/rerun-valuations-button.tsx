"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { rerunAllValuations } from "@/actions/valuation";
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

export function RerunValuationsButton() {
  const [loading, setLoading] = useState(false);

  async function handleRerun() {
    setLoading(true);
    try {
      const result = await rerunAllValuations();
      if (result.success) {
        const { created, errors } = result.data!;
        toast.success(
          `Réévaluation terminée : ${created} immeuble${created > 1 ? "s" : ""} analysé${created > 1 ? "s" : ""}${errors.length > 0 ? ` (${errors.length} erreur${errors.length > 1 ? "s" : ""})` : ""}`
        );
        if (errors.length > 0) {
          console.error("[rerunValuations] errors:", errors);
        }
      } else {
        toast.error(result.error ?? "Erreur lors de la réévaluation");
      }
    } catch {
      toast.error("Erreur lors de la réévaluation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
          {loading ? "Réévaluation en cours..." : "Réévaluer tous les biens (IA)"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Réévaluer tous les biens ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action va supprimer toutes les évaluations IA existantes et
            relancer une analyse pour chaque immeuble. Cela peut prendre
            plusieurs minutes et consommer des crédits API.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleRerun}>
            Confirmer la réévaluation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
