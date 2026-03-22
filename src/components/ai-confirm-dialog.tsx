"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sparkles } from "lucide-react";

export interface AiConfirmLine {
  label: string;
  value: string | null | undefined;
}

interface AiConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Décrit ce qui va être enregistré, ex: "Emprunt BNP 250 000 €" */
  description?: string;
  lines: AiConfirmLine[];
}

export function AiConfirmDialog({
  open,
  onConfirm,
  onCancel,
  description,
  lines,
}: AiConfirmDialogProps) {
  const visible = lines.filter((l) => l.value != null && l.value !== "");

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Confirmer l&apos;enregistrement
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ces données ont été extraites automatiquement par l&apos;IA.
            {description ? ` ${description}.` : ""} Vérifiez qu&apos;elles sont
            correctes avant d&apos;enregistrer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {visible.length > 0 && (
          <div className="my-1 max-h-72 overflow-y-auto rounded-md border bg-muted/40 p-3 space-y-1.5">
            {visible.map((line, i) => (
              <div key={i} className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground shrink-0">{line.label}</span>
                <span className="font-medium text-right">{line.value}</span>
              </div>
            ))}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Enregistrer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
