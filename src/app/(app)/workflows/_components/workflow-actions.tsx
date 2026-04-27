"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play, Trash2 } from "lucide-react";
import { deleteWorkflow, runWorkflow, toggleWorkflow } from "@/actions/workflow";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

type WorkflowActionsProps = {
  societyId: string;
  workflowId: string;
  workflowName: string;
  isActive: boolean;
};

export function WorkflowActions({
  societyId,
  workflowId,
  workflowName,
  isActive,
}: WorkflowActionsProps) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [isToggling, startToggle] = useTransition();
  const [isRunning, startRun] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleToggle(nextActive: boolean) {
    setActive(nextActive);
    startToggle(async () => {
      const result = await toggleWorkflow(societyId, workflowId, nextActive);
      if (result.success) {
        toast.success(nextActive ? "Workflow activé" : "Workflow désactivé");
        router.refresh();
      } else {
        setActive(!nextActive);
        toast.error(result.error ?? "Erreur lors du changement d'état");
      }
    });
  }

  function handleRun() {
    startRun(async () => {
      const result = await runWorkflow(societyId, workflowId);
      if (result.success) {
        toast.success("Workflow exécuté");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de l'exécution");
      }
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteWorkflow(societyId, workflowId);
      if (result.success) {
        toast.success("Workflow supprimé");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la suppression");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
      <div className="flex items-center gap-2">
        <Switch
          checked={active}
          onCheckedChange={handleToggle}
          disabled={isToggling}
          aria-label={active ? "Désactiver le workflow" : "Activer le workflow"}
        />
        <span className="text-xs text-muted-foreground">
          {active ? "Actif" : "Inactif"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleRun} disabled={isRunning || isDeleting}>
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Exécuter
        </Button>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isDeleting} aria-label="Supprimer le workflow">
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer le workflow ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le workflow "{workflowName}" et son historique d'exécution seront supprimés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Suppression..." : "Supprimer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
