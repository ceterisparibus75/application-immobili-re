"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSociety } from "@/providers/society-provider";
import { archiveBankAccount, deleteBankAccount, setBankAccountActive } from "@/actions/bank";
import { Archive, MoreHorizontal, RotateCcw, Trash2, Loader2 } from "lucide-react";

interface Props {
  bankAccountId: string;
  accountName: string;
  isActive: boolean;
}

/**
 * Menu d'actions destructives sur un compte bancaire.
 * - Archiver : soft-delete, réversible, l'historique reste accessible.
 * - Supprimer définitivement : hard delete (refusé si écritures comptables).
 * - Réactiver : si déjà archivé.
 */
export function BankAccountActionsMenu({ bankAccountId, accountName, isActive }: Props) {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleArchive() {
    if (!activeSociety) return;
    if (
      !confirm(
        `Archiver le compte « ${accountName} » ?\n\nIl ne sera plus synchronisé ni affiché dans les listes actives, mais ses transactions, rapprochements et écritures restent accessibles. Opération réversible.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await archiveBankAccount(activeSociety.id, bankAccountId);
      if (!res.success) setError(res.error ?? "Erreur");
      else router.push("/banque");
    });
  }

  function handleReactivate() {
    if (!activeSociety) return;
    setError(null);
    startTransition(async () => {
      const res = await setBankAccountActive(activeSociety.id, bankAccountId, true);
      if (!res.success) setError(res.error ?? "Erreur");
      else router.refresh();
    });
  }

  function handleDelete() {
    if (!activeSociety) return;
    const confirmation = prompt(
      `Suppression DÉFINITIVE du compte « ${accountName} ».\n\nToutes les transactions importées seront supprimées. Les factures fournisseurs liées resteront, sans compte source.\n\nPour confirmer, retapez le nom du compte :`,
    );
    if (confirmation !== accountName) {
      if (confirmation !== null) {
        setError("Suppression annulée (nom non confirmé).");
      }
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteBankAccount(activeSociety.id, bankAccountId);
      if (!res.success) {
        setError(res.error ?? "Erreur");
      } else {
        router.push("/banque");
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Gestion du compte</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isActive ? (
            <DropdownMenuItem onClick={handleArchive}>
              <Archive className="h-4 w-4" />
              Archiver (réversible)
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleReactivate}>
              <RotateCcw className="h-4 w-4" />
              Réactiver
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer définitivement
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <p className="text-xs text-destructive max-w-xs text-right">{error}</p>}
    </div>
  );
}
