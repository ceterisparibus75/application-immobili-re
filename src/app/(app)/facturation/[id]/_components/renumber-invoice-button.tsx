"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Hash, Loader2 } from "lucide-react";
import { renumberInvoice } from "@/actions/invoice-admin";
import { toast } from "sonner";

interface Props {
  invoiceId: string;
  societyId: string;
  currentNumber: string | null;
}

/**
 * Correction manuelle du numéro d'un AVOIR — réservé ADMIN_SOCIETE+.
 *
 * Les factures (hors AVOIR) sont soumises à l'inaltérabilité des numéros
 * (CGI art. 289 et 242 nonies A). Le composant n'est rendu que pour les
 * avoirs ; le serveur refuse également toute tentative sur une facture.
 */
export function RenumberInvoiceButton({ invoiceId, societyId, currentNumber }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newNumber, setNewNumber] = useState(currentNumber ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await renumberInvoice(societyId, invoiceId, newNumber);
      if (res.success && res.data) {
        toast.success(`Renuméroté : ${res.data.previousNumber ?? "—"} → ${res.data.newNumber}`);
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Erreur");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Corriger le numéro d'avoir (admin)">
          <Hash className="h-4 w-4" />
          Renuméroter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Renuméroter l&apos;avoir</DialogTitle>
            <DialogDescription>
              Action réservée aux administrateurs, uniquement disponible sur les avoirs
              (les numéros de facture étant inaltérables, CGI art. 289). À utiliser pour
              corriger un doublon issu d&apos;un bug historique de compteur. L&apos;ancien numéro
              est conservé dans le journal d&apos;audit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="currentNumber">Numéro actuel</Label>
            <Input
              id="currentNumber"
              value={currentNumber ?? "— (brouillon)"}
              disabled
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newNumber">Nouveau numéro *</Label>
            <Input
              id="newNumber"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="Ex: MTGFINVAV-2026-0002"
              className="font-mono text-sm"
              maxLength={60}
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Lettres, chiffres, tirets et underscores uniquement. Le numéro doit être unique
              pour cette société.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending || !newNumber.trim() || newNumber.trim() === currentNumber}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
              Appliquer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
