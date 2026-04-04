"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calculator, Pencil } from "lucide-react";
import { recalculateBankBalance, correctBankBalance } from "@/actions/bank";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface RecalculateButtonProps {
  bankAccountId: string;
  societyId: string;
}

export default function RecalculateButton({ bankAccountId, societyId }: RecalculateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [correctValue, setCorrectValue] = useState("");
  const [open, setOpen] = useState(false);

  async function handleRecalculate() {
    setIsLoading(true);
    const result = await recalculateBankBalance(societyId, bankAccountId);
    setIsLoading(false);

    if (result.success) {
      toast.success(
        `Solde recalculé : ${result.data?.newBalance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`
      );
    } else {
      toast.error(result.error ?? "Erreur lors du recalcul");
    }
  }

  async function handleCorrect() {
    const value = parseFloat(correctValue.replace(",", ".").replace(/\s/g, ""));
    if (isNaN(value)) {
      toast.error("Veuillez saisir un montant valide");
      return;
    }
    setIsLoading(true);
    const result = await correctBankBalance(societyId, bankAccountId, value);
    setIsLoading(false);
    setOpen(false);

    if (result.success) {
      toast.success(`Solde corrigé : ${result.data?.newBalance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`);
    } else {
      toast.error(result.error ?? "Erreur lors de la correction");
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={isLoading}>
        <Calculator className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        {isLoading ? "Recalcul..." : "Recalculer"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading}>
            <Pencil className="h-4 w-4" />
            Corriger le solde
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corriger le solde du compte</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Saisissez le solde réel du compte. Le solde initial sera ajusté automatiquement.
          </p>
          <Input
            type="text"
            placeholder="ex: 17429,38"
            value={correctValue}
            onChange={(e) => setCorrectValue(e.target.value)}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button onClick={handleCorrect} disabled={isLoading || !correctValue.trim()}>
              {isLoading ? "Correction..." : "Corriger"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
