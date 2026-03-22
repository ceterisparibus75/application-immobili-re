"use client";

import { useState, useTransition } from "react";
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
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface DeleteConfirmButtonProps {
  /** Texte affiché dans la boîte de confirmation */
  description: string;
  /** Où rediriger après suppression */
  redirectTo: string;
  /** Action serveur de suppression */
  onDelete: () => Promise<{ success: boolean; error?: string }>;
  /** Désactiver le bouton (ex: si l'entité a des dépendances) */
  disabled?: boolean;
  /** Message d'info affiché à la place du bouton quand désactivé */
  disabledReason?: string;
}

export function DeleteConfirmButton({
  description,
  redirectTo,
  onDelete,
  disabled,
  disabledReason,
}: DeleteConfirmButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const result = await onDelete();
      if (result.success) {
        toast.success("Suppression effectuée");
        setOpen(false);
        router.push(redirectTo);
      } else {
        toast.error(result.error ?? "Erreur lors de la suppression");
        setOpen(false);
      }
    });
  }

  if (disabled) {
    return (
      <p className="text-xs text-muted-foreground">{disabledReason}</p>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4" />
          Supprimer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Suppression...
              </>
            ) : (
              "Supprimer définitivement"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
