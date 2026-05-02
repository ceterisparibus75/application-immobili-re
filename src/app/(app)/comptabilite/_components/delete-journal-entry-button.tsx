"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { deleteJournalEntry } from "@/actions/accounting";
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
import { Button } from "@/components/ui/button";

export function DeleteJournalEntryButton({
  societyId,
  entryId,
  redirectTo,
  size = "sm",
}: {
  societyId: string;
  entryId: string;
  redirectTo?: string;
  size?: "sm" | "lg";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteJournalEntry(societyId, entryId);
      if (result.success) {
        toast.success("Écriture supprimée");
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
        return;
      }
      toast.error(result.error ?? "Erreur lors de la suppression");
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size={size} className="text-destructive hover:text-destructive">
          <Trash2 className="h-3 w-3" />
          Supprimer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette écriture ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action supprime uniquement le brouillon comptable. Une écriture validée ou clôturée ne peut pas être supprimée.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
